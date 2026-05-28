from __future__ import annotations

from psycopg import Connection


VERSION = "20260526_0022_candidate_google_oauth"
DESCRIPTION = "Allow Better Auth Google OAuth candidate users"


def upgrade(conn: Connection) -> None:
    conn.execute("alter table users alter column password_hash drop not null;")
    conn.execute(
        """
        create index if not exists accounts_user_provider_idx
        on accounts (user_id, provider_id);
        """
    )
