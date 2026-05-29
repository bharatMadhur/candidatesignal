from __future__ import annotations


VERSION = "20260528_0028_retention_and_campaign_summaries"
DESCRIPTION = "Add retention archives/runs and campaign pipeline summary read model"


def upgrade(conn) -> None:
    _create_retention_tables(conn)
    _create_campaign_pipeline_summary(conn)
    _seed_campaign_pipeline_summaries(conn)
    _add_rls(conn)


def _create_retention_tables(conn) -> None:
    conn.execute(
        """
        create table if not exists data_retention_runs (
          id uuid primary key default gen_random_uuid(),
          table_name text not null,
          cutoff_at timestamptz,
          dry_run boolean not null default true,
          rows_selected integer not null default 0,
          rows_archived integer not null default 0,
          rows_deleted integer not null default 0,
          status text not null default 'running',
          error_message text,
          started_at timestamptz not null default now(),
          completed_at timestamptz
        )
        """
    )
    conn.execute(
        """
        create table if not exists data_retention_archives (
          id uuid primary key default gen_random_uuid(),
          table_name text not null,
          tenant_id uuid references tenants(id) on delete set null,
          source_row jsonb not null,
          source_created_at timestamptz,
          retention_run_id uuid references data_retention_runs(id) on delete set null,
          archived_at timestamptz not null default now()
        )
        """
    )
    conn.execute(
        """
        create index if not exists data_retention_runs_table_started_idx
        on data_retention_runs (table_name, started_at desc)
        """
    )
    conn.execute(
        """
        create index if not exists data_retention_archives_table_tenant_idx
        on data_retention_archives (table_name, tenant_id, archived_at desc)
        """
    )


def _create_campaign_pipeline_summary(conn) -> None:
    conn.execute(
        """
        create table if not exists campaign_pipeline_summaries (
          tenant_id uuid not null references tenants(id) on delete cascade,
          campaign_id uuid not null references job_campaigns(id) on delete cascade,
          candidate_count integer not null default 0,
          strong_match_count integer not null default 0,
          review_worthy_count integer not null default 0,
          weak_match_count integer not null default 0,
          below_threshold_count integer not null default 0,
          shortlisted_count integer not null default 0,
          active_pipeline_count integer not null default 0,
          rejected_count integer not null default 0,
          archived_count integer not null default 0,
          upload_batch_count integer not null default 0,
          failed_upload_count integer not null default 0,
          latest_match_job_id uuid,
          latest_match_job_status text,
          latest_match_job_stage text,
          latest_match_job_updated_at timestamptz,
          updated_at timestamptz not null default now(),
          primary key (tenant_id, campaign_id)
        )
        """
    )
    conn.execute(
        """
        create index if not exists campaign_pipeline_summaries_tenant_updated_idx
        on campaign_pipeline_summaries (tenant_id, updated_at desc)
        """
    )
    conn.execute(
        """
        create or replace function refresh_campaign_pipeline_summary(p_tenant_id uuid, p_campaign_id uuid)
        returns void
        language plpgsql
        as $$
        declare
          latest_job record;
        begin
          if p_tenant_id is null or p_campaign_id is null then
            return;
          end if;

          select id, status, stage, updated_at
          into latest_job
          from campaign_match_jobs
          where tenant_id = p_tenant_id and campaign_id = p_campaign_id
          order by updated_at desc
          limit 1;

          insert into campaign_pipeline_summaries (
            tenant_id,
            campaign_id,
            candidate_count,
            strong_match_count,
            review_worthy_count,
            weak_match_count,
            below_threshold_count,
            shortlisted_count,
            active_pipeline_count,
            rejected_count,
            archived_count,
            upload_batch_count,
            failed_upload_count,
            latest_match_job_id,
            latest_match_job_status,
            latest_match_job_stage,
            latest_match_job_updated_at,
            updated_at
          )
          select
            p_tenant_id,
            p_campaign_id,
            coalesce(candidate_counts.candidate_count, 0),
            coalesce(candidate_counts.strong_match_count, 0),
            coalesce(candidate_counts.review_worthy_count, 0),
            coalesce(candidate_counts.weak_match_count, 0),
            coalesce(candidate_counts.below_threshold_count, 0),
            coalesce(candidate_counts.shortlisted_count, 0),
            coalesce(candidate_counts.active_pipeline_count, 0),
            coalesce(candidate_counts.rejected_count, 0),
            coalesce(candidate_counts.archived_count, 0),
            coalesce(batch_counts.upload_batch_count, 0),
            coalesce(batch_counts.failed_upload_count, 0),
            latest_job.id,
            latest_job.status,
            latest_job.stage,
            latest_job.updated_at,
            now()
          from (
            select
              count(*)::integer as candidate_count,
              count(*) filter (where score >= 80)::integer as strong_match_count,
              count(*) filter (where score >= 65 and score < 80)::integer as review_worthy_count,
              count(*) filter (where score >= 30 and score < 65)::integer as weak_match_count,
              count(*) filter (where score < 30 or status='below_threshold')::integer as below_threshold_count,
              count(*) filter (where status='shortlisted')::integer as shortlisted_count,
              count(*) filter (where status in ('shortlisted', 'contacted', 'replied', 'screened', 'submitted', 'interviewing', 'offer', 'placed'))::integer as active_pipeline_count,
              count(*) filter (where status='rejected')::integer as rejected_count,
              count(*) filter (where status='archived')::integer as archived_count
            from campaign_candidates
            where tenant_id = p_tenant_id and campaign_id = p_campaign_id
          ) candidate_counts,
          (
            select
              count(*)::integer as upload_batch_count,
              coalesce(sum(failed_count), 0)::integer as failed_upload_count
            from parse_batches
            where tenant_id = p_tenant_id and campaign_id = p_campaign_id
          ) batch_counts
          on conflict (tenant_id, campaign_id) do update set
            candidate_count = excluded.candidate_count,
            strong_match_count = excluded.strong_match_count,
            review_worthy_count = excluded.review_worthy_count,
            weak_match_count = excluded.weak_match_count,
            below_threshold_count = excluded.below_threshold_count,
            shortlisted_count = excluded.shortlisted_count,
            active_pipeline_count = excluded.active_pipeline_count,
            rejected_count = excluded.rejected_count,
            archived_count = excluded.archived_count,
            upload_batch_count = excluded.upload_batch_count,
            failed_upload_count = excluded.failed_upload_count,
            latest_match_job_id = excluded.latest_match_job_id,
            latest_match_job_status = excluded.latest_match_job_status,
            latest_match_job_stage = excluded.latest_match_job_stage,
            latest_match_job_updated_at = excluded.latest_match_job_updated_at,
            updated_at = now();
        end;
        $$;
        """
    )
    conn.execute(
        """
        create or replace function refresh_campaign_pipeline_summary_trigger()
        returns trigger
        language plpgsql
        as $$
        declare
          row_tenant_id uuid;
          row_campaign_id uuid;
        begin
          row_tenant_id := coalesce(new.tenant_id, old.tenant_id);
          row_campaign_id := coalesce(new.campaign_id, old.campaign_id);
          perform refresh_campaign_pipeline_summary(row_tenant_id, row_campaign_id);
          return null;
        end;
        $$;
        """
    )
    for table in ("campaign_candidates", "campaign_match_jobs", "parse_batches"):
        conn.execute(f"drop trigger if exists {table}_refresh_campaign_pipeline_summary on {table}")
        conn.execute(
            f"""
            create trigger {table}_refresh_campaign_pipeline_summary
            after insert or update or delete on {table}
            for each row
            execute function refresh_campaign_pipeline_summary_trigger()
            """
        )


def _seed_campaign_pipeline_summaries(conn) -> None:
    conn.execute(
        """
        select refresh_campaign_pipeline_summary(tenant_id, id)
        from job_campaigns
        where tenant_id is not null and deleted_at is null
        """
    )


def _add_rls(conn) -> None:
    for table in ("campaign_pipeline_summaries", "data_retention_archives"):
        conn.execute(f"alter table {table} enable row level security")
        conn.execute(f"drop policy if exists {table}_tenant_isolation_policy on {table}")
        conn.execute(
            f"""
            create policy {table}_tenant_isolation_policy on {table}
            using (
              app_current_tenant_id() is null
              or tenant_id is null
              or tenant_id = app_current_tenant_id()
            )
            with check (
              app_current_tenant_id() is null
              or tenant_id is null
              or tenant_id = app_current_tenant_id()
            )
            """
        )
