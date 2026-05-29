from __future__ import annotations


VERSION = "20260528_0029_strict_explicit_rls"
DESCRIPTION = "Require explicit tenant match or internal DB access for tenant RLS policies"


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
    "campaign_pipeline_summaries",
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
    "data_retention_archives",
)


def upgrade(conn) -> None:
    conn.execute(
        """
        create or replace function app_internal_access()
        returns boolean
        language sql
        stable
        as $$
          select lower(coalesce(current_setting('app.internal_access', true), 'false'))
                 in ('1', 'true', 'yes', 'on')
        $$;
        """
    )
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
              app_internal_access()
              or (
                app_current_tenant_id() is not null
                and tenant_id = app_current_tenant_id()
              )
            )
            with check (
              app_internal_access()
              or (
                app_current_tenant_id() is not null
                and tenant_id = app_current_tenant_id()
              )
            )
            """
        )
