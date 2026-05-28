from __future__ import annotations

from psycopg import Connection


VERSION = "20260526_0021_candidate_ai_editor"
DESCRIPTION = "Candidate-side AI editor learning events"


def upgrade(conn: Connection) -> None:
    conn.execute(
        """
        create table if not exists candidate_ai_learning_events (
            id uuid primary key default gen_random_uuid(),
            candidate_user_id uuid not null references users(id) on delete cascade,
            event_type text not null,
            source text not null default 'candidate_editor',
            original_text text,
            suggested_text text,
            accepted boolean,
            metadata_json jsonb not null default '{}'::jsonb,
            created_at timestamptz not null default now()
        );
        """
    )
    conn.execute(
        """
        create index if not exists candidate_ai_learning_events_user_created_idx
        on candidate_ai_learning_events (candidate_user_id, created_at desc);
        """
    )
    conn.execute(
        """
        create index if not exists candidate_ai_learning_events_type_idx
        on candidate_ai_learning_events (candidate_user_id, event_type, created_at desc);
        """
    )
