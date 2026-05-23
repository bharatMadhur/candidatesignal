from __future__ import annotations

from psycopg import Connection


VERSION = "20260523_0015_mail_module"
DESCRIPTION = "Tenant-scoped mail messages and provider delivery events"


def upgrade(conn: Connection) -> None:
    conn.execute(
        """
        create table if not exists mail_messages (
          id uuid primary key default gen_random_uuid(),
          tenant_id uuid references tenants(id) on delete cascade,
          user_id uuid references users(id) on delete set null,
          provider text not null,
          message_type text not null,
          status text not null default 'queued',
          to_email text not null,
          from_email text not null,
          from_name text,
          subject text not null,
          text_body text,
          html_body text,
          reply_to text,
          provider_message_id text,
          provider_response jsonb not null default '{}'::jsonb,
          error_message text,
          metadata jsonb not null default '{}'::jsonb,
          sent_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
        """
    )
    conn.execute(
        """
        create table if not exists mail_events (
          id uuid primary key default gen_random_uuid(),
          mail_message_id uuid not null references mail_messages(id) on delete cascade,
          tenant_id uuid references tenants(id) on delete cascade,
          provider text not null,
          event_type text not null,
          payload jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now()
        )
        """
    )
    conn.execute("create index if not exists mail_messages_tenant_status_idx on mail_messages (tenant_id, status, created_at desc);")
    conn.execute("create index if not exists mail_messages_provider_message_idx on mail_messages (provider, provider_message_id);")
    conn.execute("create index if not exists mail_events_message_idx on mail_events (mail_message_id, created_at desc);")
    conn.execute("create index if not exists mail_events_tenant_idx on mail_events (tenant_id, event_type, created_at desc);")
