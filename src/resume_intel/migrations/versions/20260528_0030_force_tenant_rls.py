from __future__ import annotations


VERSION = "20260528_0030_force_tenant_rls"
DESCRIPTION = "Force tenant row-level security on tenant-scoped application tables"


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
    for table in RLS_TENANT_TABLES:
        conn.execute(f"alter table {table} enable row level security")
        conn.execute(f"alter table {table} force row level security")
