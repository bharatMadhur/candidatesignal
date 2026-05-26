from __future__ import annotations

from psycopg import Connection


VERSION = "20260524_0017_candidate_portal"
DESCRIPTION = "Candidate-owned profile, resume versions, and self-match records"


def upgrade(conn: Connection) -> None:
    conn.execute(
        """
        create table if not exists candidate_profiles (
          user_id uuid primary key references users(id) on delete cascade,
          display_name text,
          headline text,
          profile_json jsonb not null default '{}'::jsonb,
          privacy_settings jsonb not null default '{"pii_visible_to_recruiters": false, "allow_linkedin_verification": false}'::jsonb,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
        """
    )
    conn.execute(
        """
        create table if not exists candidate_resume_versions (
          id uuid primary key default gen_random_uuid(),
          candidate_user_id uuid not null references users(id) on delete cascade,
          title text not null,
          target_role text,
          resume_json jsonb not null default '{}'::jsonb,
          profile_snapshot_json jsonb not null default '{}'::jsonb,
          status text not null default 'draft',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
        """
    )
    conn.execute(
        """
        create table if not exists candidate_requirement_matches (
          id uuid primary key default gen_random_uuid(),
          candidate_user_id uuid not null references users(id) on delete cascade,
          resume_version_id uuid not null references candidate_resume_versions(id) on delete cascade,
          requirement_text text not null,
          match_json jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now()
        )
        """
    )
    conn.execute(
        """
        create table if not exists candidate_applications (
          id uuid primary key default gen_random_uuid(),
          candidate_user_id uuid not null references users(id) on delete cascade,
          tenant_id uuid references tenants(id) on delete cascade,
          campaign_id uuid references job_campaigns(id) on delete set null,
          resume_version_id uuid references candidate_resume_versions(id) on delete set null,
          status text not null default 'submitted',
          pii_visibility_status text not null default 'hidden',
          candidate_note text,
          recruiter_visible_profile_snapshot jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
        """
    )
    conn.execute("create index if not exists candidate_resume_versions_user_idx on candidate_resume_versions (candidate_user_id, updated_at desc);")
    conn.execute("create index if not exists candidate_requirement_matches_user_idx on candidate_requirement_matches (candidate_user_id, created_at desc);")
    conn.execute("create index if not exists candidate_applications_user_idx on candidate_applications (candidate_user_id, updated_at desc);")
    conn.execute("create index if not exists candidate_applications_campaign_idx on candidate_applications (tenant_id, campaign_id, status);")
