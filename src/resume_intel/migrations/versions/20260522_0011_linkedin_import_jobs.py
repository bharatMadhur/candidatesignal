from __future__ import annotations

from psycopg import Connection


VERSION = "20260522_0011_linkedin_import_jobs"
DESCRIPTION = "Add asynchronous LinkedIn-only candidate import jobs"


def upgrade(conn: Connection) -> None:
    conn.execute(
        """
        create table if not exists linkedin_import_jobs (
          id uuid primary key default gen_random_uuid(),
          tenant_id uuid not null references tenants(id) on delete cascade,
          requested_by_user_id uuid references users(id) on delete set null,
          campaign_id uuid references job_campaigns(id) on delete set null,
          linkedin_url text not null,
          canonical_url text not null,
          status text not null default 'queued',
          stage text not null default 'queued',
          provider text not null default 'apify_harvestapi',
          actor_id text,
          document_id text references candidates(document_id) on delete set null,
          external_profile_id uuid references external_profiles(id) on delete set null,
          profile_snapshot jsonb not null default '{}'::jsonb,
          error_message text,
          credits_used integer not null default 0,
          started_at timestamptz,
          completed_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
        """
    )
    conn.execute(
        """
        create index if not exists linkedin_import_jobs_tenant_status_idx
        on linkedin_import_jobs (tenant_id, status, created_at desc)
        """
    )
