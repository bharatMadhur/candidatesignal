from __future__ import annotations

import psycopg


VERSION = "20260513_0003_invitation_seat_hardening"
DESCRIPTION = "Indexes for tenant invitation seat reservation and one-company invite checks"


def upgrade(conn: psycopg.Connection) -> None:
    conn.execute(
        """
        create index if not exists tenant_invitations_pending_email_idx
        on tenant_invitations (lower(email), status, expires_at desc)
        """
    )
    conn.execute(
        """
        create index if not exists tenant_invitations_tenant_status_idx
        on tenant_invitations (tenant_id, status, expires_at desc)
        """
    )
