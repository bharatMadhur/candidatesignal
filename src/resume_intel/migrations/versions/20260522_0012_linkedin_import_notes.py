from __future__ import annotations

from psycopg import Connection


VERSION = "20260522_0012_linkedin_import_notes"
DESCRIPTION = "Store recruiter notes with asynchronous LinkedIn candidate imports"


def upgrade(conn: Connection) -> None:
    conn.execute("alter table linkedin_import_jobs add column if not exists note_name text")
    conn.execute("alter table linkedin_import_jobs add column if not exists note_content text")
