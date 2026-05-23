from __future__ import annotations

from psycopg import Connection


VERSION = "20260522_0013_campaign_soft_delete"
DESCRIPTION = "Add soft-delete metadata for job campaigns"


def upgrade(conn: Connection) -> None:
    conn.execute("alter table job_campaigns add column if not exists deleted_at timestamptz;")
    conn.execute("alter table job_campaigns add column if not exists deleted_by_user_id uuid references users(id) on delete set null;")
    conn.execute("alter table job_campaigns add column if not exists deleted_reason text;")
    conn.execute(
        """
        create index if not exists job_campaigns_active_tenant_idx
        on job_campaigns (tenant_id, updated_at desc)
        where deleted_at is null
        """
    )
