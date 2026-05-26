from __future__ import annotations

from psycopg import Connection


VERSION = "20260525_0020_candidate_application_tracking"
DESCRIPTION = "Candidate-side resume application and share tracking fields"


def upgrade(conn: Connection) -> None:
    conn.execute("alter table candidate_applications add column if not exists destination_name text;")
    conn.execute("alter table candidate_applications add column if not exists destination_type text not null default 'manual';")
    conn.execute("alter table candidate_applications add column if not exists job_title text;")
    conn.execute("alter table candidate_applications add column if not exists job_url text;")
    conn.execute("alter table candidate_applications add column if not exists shared_at timestamptz not null default now();")
    conn.execute("alter table candidate_applications add column if not exists resume_share_id uuid references candidate_resume_shares(id) on delete set null;")
    conn.execute(
        "create index if not exists candidate_applications_shared_idx on candidate_applications (candidate_user_id, shared_at desc);"
    )
    conn.execute(
        "create index if not exists candidate_applications_version_idx on candidate_applications (candidate_user_id, resume_version_id, shared_at desc);"
    )
