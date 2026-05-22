from __future__ import annotations

from psycopg import Connection


VERSION = "20260522_0010_linkedin_verification_sources"
DESCRIPTION = "Add LinkedIn verification sources and structured recruiter-note signals"


def upgrade(conn: Connection) -> None:
    conn.execute(
        """
        create table if not exists external_profiles (
          id uuid primary key default gen_random_uuid(),
          provider text not null,
          provider_profile_id text,
          public_identifier text,
          canonical_url text not null,
          full_name text,
          headline text,
          location_text text,
          raw_profile_json jsonb not null default '{}'::jsonb,
          profile_snapshot jsonb not null default '{}'::jsonb,
          first_seen_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (provider, canonical_url)
        )
        """
    )
    conn.execute(
        """
        create unique index if not exists external_profiles_provider_profile_id_idx
        on external_profiles (provider, provider_profile_id)
        where provider_profile_id is not null
        """
    )
    conn.execute(
        """
        create table if not exists linkedin_verification_runs (
          id uuid primary key default gen_random_uuid(),
          tenant_id uuid not null references tenants(id) on delete cascade,
          document_id text not null references candidates(document_id) on delete cascade,
          requested_by_user_id uuid references users(id) on delete set null,
          linkedin_url text not null,
          canonical_url text not null,
          status text not null default 'queued',
          stage text not null default 'queued',
          provider text not null default 'apify_harvestapi',
          actor_id text,
          result_status text,
          match_confidence numeric,
          comparison_json jsonb not null default '{}'::jsonb,
          profile_diff_json jsonb not null default '{}'::jsonb,
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
        create index if not exists linkedin_verification_runs_candidate_idx
        on linkedin_verification_runs (tenant_id, document_id, created_at desc)
        """
    )
    conn.execute(
        """
        create table if not exists candidate_external_profiles (
          id uuid primary key default gen_random_uuid(),
          tenant_id uuid not null references tenants(id) on delete cascade,
          document_id text not null references candidates(document_id) on delete cascade,
          external_profile_id uuid not null references external_profiles(id) on delete cascade,
          provider text not null,
          source text not null default 'manual_verify',
          status text not null default 'linked',
          verification_status text,
          match_confidence numeric,
          latest_run_id uuid references linkedin_verification_runs(id) on delete set null,
          linked_by_user_id uuid references users(id) on delete set null,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (tenant_id, document_id, external_profile_id)
        )
        """
    )
    conn.execute(
        """
        create index if not exists candidate_external_profiles_candidate_idx
        on candidate_external_profiles (tenant_id, document_id, provider, verification_status)
        """
    )
    conn.execute(
        """
        create table if not exists candidate_note_signals (
          id uuid primary key default gen_random_uuid(),
          tenant_id uuid not null references tenants(id) on delete cascade,
          document_id text not null references candidates(document_id) on delete cascade,
          note_id uuid references notes(id) on delete cascade,
          category text not null,
          label text not null,
          value text,
          confidence numeric not null default 0.75,
          source_text text,
          metadata jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
        """
    )
    conn.execute(
        """
        create index if not exists candidate_note_signals_candidate_idx
        on candidate_note_signals (tenant_id, document_id, category, label)
        """
    )
    conn.execute(
        """
        create index if not exists candidate_note_signals_note_idx
        on candidate_note_signals (tenant_id, note_id)
        """
    )
