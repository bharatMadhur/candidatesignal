from __future__ import annotations

from psycopg import Connection


VERSION = "20260528_0024_session_workspace_persona"
DESCRIPTION = "Session-scoped active workspace persona"


def upgrade(conn: Connection) -> None:
    conn.execute("alter table sessions add column if not exists active_workspace_access text;")
    conn.execute(
        """
        alter table sessions
        drop constraint if exists sessions_active_workspace_access_check
        """
    )
    conn.execute(
        """
        alter table sessions
        add constraint sessions_active_workspace_access_check
        check (
          active_workspace_access is null
          or active_workspace_access in ('candidate', 'tenant_member', 'platform_admin')
        )
        """
    )
    conn.execute(
        """
        create index if not exists sessions_active_workspace_access_idx
        on sessions (active_workspace_access)
        where active_workspace_access is not null
        """
    )
