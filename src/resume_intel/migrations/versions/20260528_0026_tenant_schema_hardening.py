from __future__ import annotations


VERSION = "20260528_0026_tenant_schema_hardening"
DESCRIPTION = "Harden tenant-scoped database ownership, summaries, and high-growth table operations"


TENANT_REQUIRED_TABLES = (
    "candidates",
    "notes",
    "candidate_version_matches",
    "requirements",
    "requirement_matches",
    "requirement_match_runs",
    "requirement_embeddings",
)

CANDIDATE_CHILD_TABLES = (
    ("notes", "document_id"),
    ("candidate_documents", "document_id"),
    ("document_pages", "document_id"),
    ("requirement_matches", "candidate_id"),
    ("candidate_search_chunks", "document_id"),
    ("llm_usage_events", "document_id"),
    ("candidate_skills", "document_id"),
    ("candidate_experience", "document_id"),
    ("candidate_education", "document_id"),
    ("candidate_certifications", "document_id"),
    ("candidate_domain_years", "document_id"),
    ("candidate_locations", "document_id"),
    ("pii_access_events", "document_id"),
    ("candidate_activity_events", "document_id"),
    ("training_data_examples", "document_id"),
    ("collaboration_comments", "document_id"),
)

HIGH_GROWTH_TABLES = (
    ("audit_logs", "created_at"),
    ("parse_job_events", "created_at"),
    ("llm_usage_events", "created_at"),
    ("candidate_search_chunks", "created_at"),
    ("requirement_matches", "created_at"),
    ("requirement_match_runs", "created_at"),
    ("campaign_match_jobs", "created_at"),
    ("copilot_messages", "created_at"),
)

RLS_TENANT_TABLES = (
    "candidates",
    "notes",
    "candidate_documents",
    "document_pages",
    "candidate_version_matches",
    "requirements",
    "requirement_matches",
    "requirement_match_runs",
    "job_campaigns",
    "campaign_match_jobs",
    "campaign_candidates",
    "parse_batches",
    "parse_jobs",
    "parse_job_events",
    "parse_job_dead_letters",
    "copilot_threads",
    "copilot_messages",
    "audit_logs",
    "candidate_search_chunks",
    "candidate_profile_summaries",
    "llm_usage_events",
    "candidate_skills",
    "candidate_experience",
    "candidate_education",
    "candidate_certifications",
    "candidate_domain_years",
    "candidate_locations",
    "pii_access_events",
    "operational_alerts",
    "mail_messages",
    "mail_events",
    "collaboration_comments",
    "recruiter_tasks",
    "recruiter_notifications",
    "saved_workspace_views",
)


def upgrade(conn) -> None:
    """Add DB-layer guardrails without requiring a destructive legacy rewrite.

    The application already filters by tenant_id. These constraints make new
    writes harder to corrupt and prepare the schema for DB-enforced tenant
    isolation. Legacy rows are not force-validated here; follow-up maintenance
    can validate each constraint after production data has been audited.
    """

    _add_tenant_required_checks(conn)
    _add_candidate_composite_references(conn)
    _create_candidate_profile_summary_table(conn)
    _create_candidate_summary_refresh_function(conn)
    _create_candidate_summary_trigger(conn)
    _seed_candidate_profile_summaries(conn)
    _add_high_growth_indexes(conn)
    _add_rls_policies(conn)


def _add_tenant_required_checks(conn) -> None:
    for table in TENANT_REQUIRED_TABLES:
        constraint = f"{table}_tenant_id_required"
        conn.execute(
            f"""
            do $$
            begin
              if not exists (
                select 1
                from pg_constraint
                where conname = '{constraint}'
              ) then
                alter table {table}
                add constraint {constraint}
                check (tenant_id is not null)
                not valid;
              end if;
            end $$;
            """
        )


def _add_candidate_composite_references(conn) -> None:
    conn.execute(
        """
        create unique index if not exists candidates_tenant_document_uidx
        on candidates (tenant_id, document_id)
        """
    )
    for table, column in CANDIDATE_CHILD_TABLES:
        constraint = f"{table}_{column}_tenant_candidate_fk"
        conn.execute(
            f"""
            do $$
            begin
              if not exists (
                select 1
                from pg_constraint
                where conname = '{constraint}'
              ) then
                alter table {table}
                add constraint {constraint}
                foreign key (tenant_id, {column})
                references candidates (tenant_id, document_id)
                on delete cascade
                not valid;
              end if;
            end $$;
            """
        )
    for column in ("left_document_id", "right_document_id"):
        conn.execute(
            f"""
            do $$
            begin
              if not exists (
                select 1
                from pg_constraint
                where conname = 'candidate_version_matches_{column}_tenant_candidate_fk'
              ) then
                alter table candidate_version_matches
                add constraint candidate_version_matches_{column}_tenant_candidate_fk
                foreign key (tenant_id, {column})
                references candidates (tenant_id, document_id)
                on delete cascade
                not valid;
              end if;
            end $$;
            """
        )


def _create_candidate_profile_summary_table(conn) -> None:
    conn.execute(
        """
        create table if not exists candidate_profile_summaries (
          tenant_id uuid not null references tenants(id) on delete cascade,
          document_id text not null,
          name text,
          email text,
          phone text,
          current_title text,
          current_company text,
          current_location text,
          total_years_experience numeric,
          seniority text,
          countries text[] not null default '{}'::text[],
          domains text[] not null default '{}'::text[],
          skills text[] not null default '{}'::text[],
          completeness_score numeric,
          version_signal text,
          source_sha256 text,
          updated_at timestamptz not null default now(),
          primary key (tenant_id, document_id),
          foreign key (tenant_id, document_id)
            references candidates (tenant_id, document_id)
            on delete cascade
        )
        """
    )
    conn.execute(
        """
        create index if not exists candidate_profile_summaries_tenant_updated_idx
        on candidate_profile_summaries (tenant_id, updated_at desc)
        """
    )
    conn.execute(
        """
        create index if not exists candidate_profile_summaries_tenant_years_idx
        on candidate_profile_summaries (tenant_id, total_years_experience desc nulls last)
        """
    )
    conn.execute(
        """
        create index if not exists candidate_profile_summaries_tenant_title_idx
        on candidate_profile_summaries (tenant_id, lower(current_title))
        where current_title is not null and current_title <> ''
        """
    )
    conn.execute(
        """
        create index if not exists candidate_profile_summaries_countries_gin
        on candidate_profile_summaries using gin (countries)
        """
    )
    conn.execute(
        """
        create index if not exists candidate_profile_summaries_domains_gin
        on candidate_profile_summaries using gin (domains)
        """
    )
    conn.execute(
        """
        create index if not exists candidate_profile_summaries_skills_gin
        on candidate_profile_summaries using gin (skills)
        """
    )


def _create_candidate_summary_refresh_function(conn) -> None:
    conn.execute(
        """
        create or replace function refresh_candidate_profile_summary()
        returns trigger
        language plpgsql
        as $$
        declare
          hr_profile jsonb;
          location_intelligence jsonb;
          coverage jsonb;
          first_experience jsonb;
          country_values text[];
          domain_values text[];
          skill_values text[];
          countries_json jsonb;
          structured_locations_json jsonb;
          derived_domain_years_json jsonb;
          root_domain_years_json jsonb;
          skills_json jsonb;
          years_text text;
          coverage_text text;
        begin
          if new.tenant_id is null then
            return new;
          end if;

          hr_profile := coalesce(new.record_json #> '{derived,hr_profile}', '{}'::jsonb);
          location_intelligence := coalesce(new.record_json #> '{derived,location_intelligence}', '{}'::jsonb);
          coverage := coalesce(new.record_json -> 'primary_key_coverage', '{}'::jsonb);
          first_experience := coalesce(new.record_json #> '{experience,0}', '{}'::jsonb);
          countries_json := case
            when jsonb_typeof(new.record_json #> '{derived,countries_associated}') = 'array'
            then new.record_json #> '{derived,countries_associated}'
            else '[]'::jsonb
          end;
          structured_locations_json := case
            when jsonb_typeof(location_intelligence -> 'structured_locations') = 'array'
            then location_intelligence -> 'structured_locations'
            else '[]'::jsonb
          end;
          derived_domain_years_json := case
            when jsonb_typeof(new.record_json #> '{derived,domain_years}') = 'array'
            then new.record_json #> '{derived,domain_years}'
            else '[]'::jsonb
          end;
          root_domain_years_json := case
            when jsonb_typeof(new.record_json -> 'domain_years') = 'array'
            then new.record_json -> 'domain_years'
            else '[]'::jsonb
          end;
          skills_json := case
            when jsonb_typeof(new.record_json -> 'skills') = 'array'
            then new.record_json -> 'skills'
            else '[]'::jsonb
          end;
          years_text := nullif(hr_profile ->> 'total_years_experience', '');
          coverage_text := nullif(coverage ->> 'score', '');

          select coalesce(array_agg(distinct value) filter (where value is not null and value <> ''), '{}'::text[])
          into country_values
          from (
            select item ->> 'country' as value
            from jsonb_array_elements(countries_json) item
            union all
            select item #>> '{}'
            from jsonb_array_elements(structured_locations_json) item
          ) countries;

          select coalesce(array_agg(distinct value) filter (where value is not null and value <> ''), '{}'::text[])
          into domain_values
          from (
            select item ->> 'domain' as value
            from jsonb_array_elements(derived_domain_years_json) item
            union all
            select item ->> 'domain'
            from jsonb_array_elements(root_domain_years_json) item
          ) domains;

          select coalesce(array_agg(distinct value) filter (where value is not null and value <> ''), '{}'::text[])
          into skill_values
          from (
            select item #>> '{}' as value
            from jsonb_array_elements(skills_json) item
          ) skills;

          insert into candidate_profile_summaries (
            tenant_id,
            document_id,
            name,
            email,
            phone,
            current_title,
            current_company,
            current_location,
            total_years_experience,
            seniority,
            countries,
            domains,
            skills,
            completeness_score,
            version_signal,
            source_sha256,
            updated_at
          )
          values (
            new.tenant_id,
            new.document_id,
            new.name,
            new.email,
            new.phone,
            nullif(coalesce(hr_profile ->> 'current_title', first_experience ->> 'title'), ''),
            nullif(coalesce(hr_profile ->> 'current_company', first_experience ->> 'company'), ''),
            nullif(coalesce(location_intelligence ->> 'current_location', new.record_json #>> '{contact,location}'), ''),
            case when years_text ~ '^[0-9]+(\\.[0-9]+)?$' then years_text::numeric else null end,
            nullif(hr_profile ->> 'seniority_level', ''),
            country_values,
            domain_values,
            skill_values,
            case when coverage_text ~ '^[0-9]+(\\.[0-9]+)?$' then coverage_text::numeric else null end,
            coalesce(new.record_json #>> '{derived,version_signal,status}', 'unique'),
            new.source_sha256,
            now()
          )
          on conflict (tenant_id, document_id) do update set
            name = excluded.name,
            email = excluded.email,
            phone = excluded.phone,
            current_title = excluded.current_title,
            current_company = excluded.current_company,
            current_location = excluded.current_location,
            total_years_experience = excluded.total_years_experience,
            seniority = excluded.seniority,
            countries = excluded.countries,
            domains = excluded.domains,
            skills = excluded.skills,
            completeness_score = excluded.completeness_score,
            version_signal = excluded.version_signal,
            source_sha256 = excluded.source_sha256,
            updated_at = now();

          return new;
        end;
        $$;
        """
    )


def _create_candidate_summary_trigger(conn) -> None:
    conn.execute("drop trigger if exists candidates_refresh_profile_summary on candidates")
    conn.execute(
        """
        create trigger candidates_refresh_profile_summary
        after insert or update of tenant_id, name, email, phone, record_json, source_sha256, updated_at
        on candidates
        for each row
        when (new.deleted_at is null)
        execute function refresh_candidate_profile_summary()
        """
    )
    conn.execute(
        """
        create or replace function delete_candidate_profile_summary()
        returns trigger
        language plpgsql
        as $$
        begin
          delete from candidate_profile_summaries
          where tenant_id = old.tenant_id and document_id = old.document_id;
          return old;
        end;
        $$;
        """
    )
    conn.execute("drop trigger if exists candidates_delete_profile_summary on candidates")
    conn.execute(
        """
        create trigger candidates_delete_profile_summary
        after delete on candidates
        for each row
        execute function delete_candidate_profile_summary()
        """
    )


def _seed_candidate_profile_summaries(conn) -> None:
    conn.execute(
        """
        insert into candidate_profile_summaries (tenant_id, document_id)
        select tenant_id, document_id
        from candidates
        where tenant_id is not null and deleted_at is null
        on conflict do nothing
        """
    )
    conn.execute(
        """
        update candidates
        set updated_at = updated_at
        where tenant_id is not null and deleted_at is null
        """
    )


def _add_high_growth_indexes(conn) -> None:
    for table, timestamp_column in HIGH_GROWTH_TABLES:
        conn.execute(
            f"""
            create index if not exists {table}_tenant_time_idx
            on {table} (tenant_id, {timestamp_column} desc)
            """
        )
    conn.execute(
        """
        create table if not exists data_retention_policies (
          table_name text primary key,
          retention_days integer not null,
          strategy text not null default 'archive_then_delete',
          enabled boolean not null default false,
          updated_at timestamptz not null default now()
        )
        """
    )
    conn.execute(
        """
        insert into data_retention_policies (table_name, retention_days, strategy, enabled)
        values
          ('audit_logs', 2555, 'archive_then_delete', false),
          ('parse_job_events', 365, 'archive_then_delete', false),
          ('llm_usage_events', 1095, 'archive_then_delete', false),
          ('candidate_search_chunks', 0, 'rebuildable_index', false),
          ('requirement_matches', 1095, 'archive_then_delete', false),
          ('campaign_match_jobs', 365, 'archive_then_delete', false),
          ('copilot_messages', 1095, 'archive_then_delete', false)
        on conflict (table_name) do nothing
        """
    )


def _add_rls_policies(conn) -> None:
    conn.execute(
        """
        create or replace function app_current_tenant_id()
        returns uuid
        language sql
        stable
        as $$
          select nullif(current_setting('app.current_tenant_id', true), '')::uuid
        $$;
        """
    )
    for table in RLS_TENANT_TABLES:
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
