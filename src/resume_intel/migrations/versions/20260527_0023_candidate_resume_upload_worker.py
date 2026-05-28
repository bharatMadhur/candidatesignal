from __future__ import annotations

from psycopg import Connection


VERSION = "20260527_0023_candidate_resume_upload_worker"
DESCRIPTION = "Durable worker metadata for candidate resume uploads"


def upgrade(conn: Connection) -> None:
    conn.execute("alter table candidate_resume_uploads add column if not exists storage_backend text;")
    conn.execute("alter table candidate_resume_uploads add column if not exists storage_key text;")
    conn.execute("alter table candidate_resume_uploads add column if not exists attempt_count integer not null default 0;")
    conn.execute("alter table candidate_resume_uploads add column if not exists max_attempts integer not null default 2;")
    conn.execute("alter table candidate_resume_uploads add column if not exists worker_id text;")
    conn.execute("alter table candidate_resume_uploads add column if not exists started_at timestamptz;")
    conn.execute("alter table candidate_resume_uploads add column if not exists next_retry_at timestamptz;")
    conn.execute(
        """
        create index if not exists candidate_resume_uploads_worker_queue_idx
        on candidate_resume_uploads (status, next_retry_at, created_at)
        where status in ('queued', 'retrying', 'running')
        """
    )
