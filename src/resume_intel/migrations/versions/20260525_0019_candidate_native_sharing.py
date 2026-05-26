from __future__ import annotations

from psycopg import Connection


VERSION = "20260525_0019_candidate_native_sharing"
DESCRIPTION = "Candidate-owned share links and recruiter access requests"


def upgrade(conn: Connection) -> None:
    conn.execute(
        """
        create table if not exists candidate_resume_shares (
          id uuid primary key default gen_random_uuid(),
          candidate_user_id uuid not null references users(id) on delete cascade,
          resume_version_id uuid not null references candidate_resume_versions(id) on delete cascade,
          label text not null,
          access_token text not null unique,
          permissions_json jsonb not null default '{"include_pii": false}'::jsonb,
          status text not null default 'active',
          expires_at timestamptz,
          created_at timestamptz not null default now(),
          revoked_at timestamptz
        )
        """
    )
    conn.execute(
        """
        create table if not exists candidate_native_access_requests (
          id uuid primary key default gen_random_uuid(),
          candidate_user_id uuid not null references users(id) on delete cascade,
          recruiter_user_id uuid references users(id) on delete set null,
          tenant_id uuid references tenants(id) on delete set null,
          resume_version_id uuid references candidate_resume_versions(id) on delete set null,
          status text not null default 'pending',
          request_message text,
          permissions_json jsonb not null default '{"include_pii": true}'::jsonb,
          approved_snapshot_json jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          decided_at timestamptz
        )
        """
    )
    conn.execute(
        "create index if not exists candidate_resume_shares_user_idx on candidate_resume_shares (candidate_user_id, created_at desc);"
    )
    conn.execute(
        "create index if not exists candidate_resume_shares_token_idx on candidate_resume_shares (access_token, status);"
    )
    conn.execute(
        "create index if not exists candidate_native_access_candidate_idx on candidate_native_access_requests (candidate_user_id, status, created_at desc);"
    )
    conn.execute(
        "create index if not exists candidate_native_access_tenant_idx on candidate_native_access_requests (tenant_id, status, created_at desc);"
    )
