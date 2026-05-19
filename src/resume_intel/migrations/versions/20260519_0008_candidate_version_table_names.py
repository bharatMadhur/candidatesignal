from __future__ import annotations

from psycopg import Connection


VERSION = "20260519_0008_candidate_version_table_names"
DESCRIPTION = "Rename legacy entity-resolution persistence to candidate-version persistence"


def upgrade(conn: Connection) -> None:
    conn.execute(
        """
        do $$
        begin
          if to_regclass('public.candidate_version_matches') is null
             and to_regclass('public.entity_resolution_matches') is not null then
            alter table entity_resolution_matches rename to candidate_version_matches;
          end if;
        end $$;
        """
    )
    conn.execute(
        """
        create table if not exists candidate_version_matches (
          id uuid primary key default gen_random_uuid(),
          tenant_id uuid references tenants(id) on delete cascade,
          left_document_id text not null references candidates(document_id) on delete cascade,
          right_document_id text not null references candidates(document_id) on delete cascade,
          score numeric not null,
          reasons jsonb not null,
          status text not null default 'suggested',
          decided_by uuid references users(id) on delete set null,
          decided_at timestamptz,
          created_at timestamptz not null default now(),
          unique (left_document_id, right_document_id)
        )
        """
    )
    conn.execute(
        """
        do $$
        begin
          if to_regclass('public.entity_resolution_matches') is not null then
            insert into candidate_version_matches (
              id, tenant_id, left_document_id, right_document_id, score, reasons,
              status, decided_by, decided_at, created_at
            )
            select id, tenant_id, left_document_id, right_document_id, score, reasons,
                   status, decided_by, decided_at, created_at
            from entity_resolution_matches
            on conflict (left_document_id, right_document_id) do update set
              tenant_id=excluded.tenant_id,
              score=excluded.score,
              reasons=excluded.reasons,
              status=excluded.status,
              decided_by=excluded.decided_by,
              decided_at=excluded.decided_at;
          end if;
        end $$;
        """
    )
    conn.execute(
        """
        do $$
        begin
          if to_regclass('public.candidate_version_events') is null
             and to_regclass('public.candidate_merge_events') is not null then
            alter table candidate_merge_events rename to candidate_version_events;
          end if;
        end $$;
        """
    )
    conn.execute(
        """
        create table if not exists candidate_version_events (
          id uuid primary key default gen_random_uuid(),
          tenant_id uuid not null references tenants(id) on delete cascade,
          canonical_document_id text not null,
          merged_document_id text not null,
          match_id uuid references candidate_version_matches(id) on delete set null,
          decided_by uuid references users(id) on delete set null,
          metadata jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now()
        )
        """
    )
    conn.execute(
        """
        do $$
        begin
          if to_regclass('public.candidate_merge_events') is not null then
            insert into candidate_version_events (
              id, tenant_id, canonical_document_id, merged_document_id,
              match_id, decided_by, metadata, created_at
            )
            select id, tenant_id, canonical_document_id, merged_document_id,
                   match_id, decided_by, metadata, created_at
            from candidate_merge_events
            on conflict (id) do nothing;
          end if;
        end $$;
        """
    )
    conn.execute("create index if not exists candidate_version_events_tenant_idx on candidate_version_events (tenant_id, canonical_document_id, created_at desc);")
