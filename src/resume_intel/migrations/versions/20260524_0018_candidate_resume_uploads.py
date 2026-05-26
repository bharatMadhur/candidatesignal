from __future__ import annotations

from psycopg import Connection


VERSION = "20260524_0018_candidate_resume_uploads"
DESCRIPTION = "Candidate resume uploads, parse status, and parsed profile review"


def upgrade(conn: Connection) -> None:
    conn.execute(
        """
        create table if not exists candidate_resume_uploads (
          id uuid primary key default gen_random_uuid(),
          candidate_user_id uuid not null references users(id) on delete cascade,
          resume_version_id uuid references candidate_resume_versions(id) on delete set null,
          original_filename text not null,
          stored_path text not null,
          mime_type text,
          size_bytes bigint,
          sha256 text,
          target_role text,
          candidate_note text,
          status text not null default 'queued',
          stage text not null default 'queued',
          progress integer not null default 5,
          error_message text,
          parsed_profile_json jsonb not null default '{}'::jsonb,
          parsed_resume_json jsonb not null default '{}'::jsonb,
          parsed_record_json jsonb not null default '{}'::jsonb,
          parse_quality_json jsonb not null default '{}'::jsonb,
          needs_review_json jsonb not null default '[]'::jsonb,
          raw_text text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          completed_at timestamptz
        )
        """
    )
    conn.execute(
        "create index if not exists candidate_resume_uploads_user_idx on candidate_resume_uploads (candidate_user_id, updated_at desc);"
    )
    conn.execute(
        "create index if not exists candidate_resume_uploads_status_idx on candidate_resume_uploads (candidate_user_id, status, updated_at desc);"
    )
