from __future__ import annotations

from psycopg import Connection


VERSION = "20260522_0009_candidate_review_signals"
DESCRIPTION = "Persist candidate review-center decisions"


def upgrade(conn: Connection) -> None:
    conn.execute(
        """
        create table if not exists candidate_review_signals (
          id uuid primary key default gen_random_uuid(),
          tenant_id uuid not null references tenants(id) on delete cascade,
          document_id text not null references candidates(document_id) on delete cascade,
          signal_key text not null,
          status text not null default 'reviewed',
          reviewed_by_user_id uuid references users(id) on delete set null,
          reviewed_at timestamptz not null default now(),
          note text,
          metadata jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (tenant_id, document_id, signal_key)
        )
        """
    )
    conn.execute(
        """
        create index if not exists candidate_review_signals_doc_idx
        on candidate_review_signals (tenant_id, document_id, signal_key, status)
        """
    )
