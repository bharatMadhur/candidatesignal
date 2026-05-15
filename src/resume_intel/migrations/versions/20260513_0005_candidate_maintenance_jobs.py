from __future__ import annotations

import psycopg


VERSION = "20260513_0005_candidate_maintenance_jobs"
DESCRIPTION = "Tenant-scoped candidate intelligence maintenance jobs"


def upgrade(conn: psycopg.Connection) -> None:
    conn.execute(
        """
        create table if not exists candidate_maintenance_jobs (
          id uuid primary key default gen_random_uuid(),
          tenant_id uuid not null references tenants(id) on delete cascade,
          created_by_user_id uuid references users(id) on delete set null,
          job_type text not null default 'candidate_rederive',
          status text not null default 'queued',
          stage text not null default 'queued',
          progress_percent integer not null default 0,
          total_candidates integer not null default 0,
          processed_candidates integer not null default 0,
          failed_candidates integer not null default 0,
          refresh_embeddings boolean not null default false,
          error_message text,
          result_json jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          started_at timestamptz,
          completed_at timestamptz
        )
        """
    )
    conn.execute(
        """
        create index if not exists candidate_maintenance_jobs_tenant_status_idx
        on candidate_maintenance_jobs (tenant_id, status, updated_at desc)
        """
    )
    conn.execute(
        """
        create index if not exists candidate_maintenance_jobs_tenant_created_idx
        on candidate_maintenance_jobs (tenant_id, created_at desc)
        """
    )
