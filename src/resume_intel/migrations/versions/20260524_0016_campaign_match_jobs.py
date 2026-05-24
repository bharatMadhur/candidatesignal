from __future__ import annotations

from psycopg import Connection


VERSION = "20260524_0016_campaign_match_jobs"
DESCRIPTION = "Durable tenant-scoped campaign matching jobs"


def upgrade(conn: Connection) -> None:
    conn.execute(
        """
        create table if not exists campaign_match_jobs (
          id uuid primary key default gen_random_uuid(),
          tenant_id uuid not null references tenants(id) on delete cascade,
          campaign_id uuid not null references job_campaigns(id) on delete cascade,
          requirement_id uuid references requirements(id) on delete set null,
          created_by_user_id uuid references users(id) on delete set null,
          mode text not null default 'full',
          candidate_ids jsonb not null default '[]'::jsonb,
          status text not null default 'queued',
          stage text not null default 'queued',
          attempt_count integer not null default 0,
          max_attempts integer not null default 2,
          result jsonb not null default '{}'::jsonb,
          error_message text,
          started_at timestamptz,
          completed_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
        """
    )
    conn.execute("create index if not exists campaign_match_jobs_tenant_status_idx on campaign_match_jobs (tenant_id, status, created_at);")
    conn.execute("create index if not exists campaign_match_jobs_campaign_idx on campaign_match_jobs (tenant_id, campaign_id, created_at desc);")
