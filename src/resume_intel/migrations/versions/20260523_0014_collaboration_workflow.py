from __future__ import annotations

from psycopg import Connection


VERSION = "20260523_0014_collaboration_workflow"
DESCRIPTION = "Tenant-scoped recruiter collaboration comments, tasks, notifications, and saved views"


def upgrade(conn: Connection) -> None:
    conn.execute(
        """
        create table if not exists collaboration_comments (
          id uuid primary key default gen_random_uuid(),
          tenant_id uuid not null references tenants(id) on delete cascade,
          entity_type text not null,
          entity_id text not null,
          document_id text references candidates(document_id) on delete cascade,
          campaign_id uuid references job_campaigns(id) on delete cascade,
          campaign_candidate_id uuid references campaign_candidates(id) on delete cascade,
          user_id uuid references users(id) on delete set null,
          body text not null,
          visibility text not null default 'team',
          metadata jsonb not null default '{}'::jsonb,
          deleted_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          constraint collaboration_comments_visibility_check check (visibility in ('team', 'private', 'client_ready'))
        )
        """
    )
    conn.execute(
        """
        create table if not exists recruiter_tasks (
          id uuid primary key default gen_random_uuid(),
          tenant_id uuid not null references tenants(id) on delete cascade,
          entity_type text not null,
          entity_id text not null,
          document_id text references candidates(document_id) on delete cascade,
          campaign_id uuid references job_campaigns(id) on delete cascade,
          campaign_candidate_id uuid references campaign_candidates(id) on delete cascade,
          title text not null,
          body text,
          status text not null default 'open',
          priority text not null default 'normal',
          due_at timestamptz,
          assignee_user_id uuid references users(id) on delete set null,
          created_by_user_id uuid references users(id) on delete set null,
          completed_at timestamptz,
          metadata jsonb not null default '{}'::jsonb,
          deleted_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          constraint recruiter_tasks_status_check check (status in ('open', 'in_progress', 'done', 'cancelled')),
          constraint recruiter_tasks_priority_check check (priority in ('low', 'normal', 'high', 'urgent'))
        )
        """
    )
    conn.execute(
        """
        create table if not exists recruiter_notifications (
          id uuid primary key default gen_random_uuid(),
          tenant_id uuid not null references tenants(id) on delete cascade,
          user_id uuid not null references users(id) on delete cascade,
          actor_user_id uuid references users(id) on delete set null,
          event_type text not null,
          title text not null,
          body text,
          entity_type text,
          entity_id text,
          metadata jsonb not null default '{}'::jsonb,
          read_at timestamptz,
          created_at timestamptz not null default now()
        )
        """
    )
    conn.execute(
        """
        create table if not exists saved_workspace_views (
          id uuid primary key default gen_random_uuid(),
          tenant_id uuid not null references tenants(id) on delete cascade,
          user_id uuid references users(id) on delete set null,
          name text not null,
          view_type text not null,
          query text,
          filters jsonb not null default '{}'::jsonb,
          visibility text not null default 'private',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          deleted_at timestamptz,
          constraint saved_workspace_views_visibility_check check (visibility in ('private', 'team'))
        )
        """
    )
    conn.execute("create index if not exists collaboration_comments_entity_idx on collaboration_comments (tenant_id, entity_type, entity_id, created_at desc) where deleted_at is null;")
    conn.execute("create index if not exists collaboration_comments_document_idx on collaboration_comments (tenant_id, document_id, created_at desc) where deleted_at is null;")
    conn.execute("create index if not exists recruiter_tasks_assignee_idx on recruiter_tasks (tenant_id, assignee_user_id, status, due_at) where deleted_at is null;")
    conn.execute("create index if not exists recruiter_tasks_entity_idx on recruiter_tasks (tenant_id, entity_type, entity_id, status, created_at desc) where deleted_at is null;")
    conn.execute("create index if not exists recruiter_notifications_user_idx on recruiter_notifications (tenant_id, user_id, read_at, created_at desc);")
    conn.execute("create index if not exists saved_workspace_views_lookup_idx on saved_workspace_views (tenant_id, user_id, view_type, updated_at desc) where deleted_at is null;")
