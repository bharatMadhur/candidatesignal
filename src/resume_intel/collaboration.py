from __future__ import annotations

import re
from typing import Any

from psycopg.types.json import Jsonb

from .db import db


ENTITY_TYPES = {"candidate", "campaign", "campaign_candidate"}
COMMENT_VISIBILITIES = {"team", "private", "client_ready"}
TASK_STATUSES = {"open", "in_progress", "done", "cancelled"}
TASK_PRIORITIES = {"low", "normal", "high", "urgent"}
VIEW_VISIBILITIES = {"private", "team"}
VIEW_TYPES = {"candidate_search", "campaign", "copilot", "upload_review"}


def list_comments(tenant_id: str, user_id: str, entity_type: str, entity_id: str) -> list[dict[str, Any]]:
    _validate_entity_type(entity_type)
    with db() as conn:
        _entity_context(conn, tenant_id, entity_type, entity_id)
        rows = conn.execute(
            """
            select collaboration_comments.*, users.email as user_email, users.name as user_name
            from collaboration_comments
            left join users on users.id = collaboration_comments.user_id
            where collaboration_comments.tenant_id=%s
              and collaboration_comments.entity_type=%s
              and collaboration_comments.entity_id=%s
              and collaboration_comments.deleted_at is null
              and (
                collaboration_comments.visibility <> 'private'
                or collaboration_comments.user_id=%s
              )
            order by collaboration_comments.created_at asc
            """,
            (tenant_id, entity_type, entity_id, user_id),
        ).fetchall()
    return [_comment_row(row) for row in rows]


def create_comment(
    tenant_id: str,
    user_id: str,
    entity_type: str,
    entity_id: str,
    body: str,
    visibility: str = "team",
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    _validate_entity_type(entity_type)
    visibility = _validate_choice(visibility or "team", COMMENT_VISIBILITIES, "visibility")
    body = body.strip()
    if not body:
        raise ValueError("comment body is required")
    with db() as conn:
        context = _entity_context(conn, tenant_id, entity_type, entity_id)
        row = conn.execute(
            """
            with inserted as (
              insert into collaboration_comments (
                tenant_id, entity_type, entity_id, document_id, campaign_id,
                campaign_candidate_id, user_id, body, visibility, metadata
              )
              values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
              returning *
            )
            select inserted.*, users.email as user_email, users.name as user_name
            from inserted
            left join users on users.id = inserted.user_id
            """,
            (
                tenant_id,
                entity_type,
                entity_id,
                context.get("document_id"),
                context.get("campaign_id"),
                context.get("campaign_candidate_id"),
                user_id,
                body,
                visibility,
                Jsonb(metadata or {}),
            ),
        ).fetchone()
        _notify_mentions(conn, tenant_id, user_id, body, entity_type, entity_id, "comment.mentioned", "Mentioned in a comment")
        _audit(conn, tenant_id, user_id, "collaboration.comment_created", "collaboration_comment", str(row["id"]), {"entity_type": entity_type, "entity_id": entity_id, "visibility": visibility})
        conn.commit()
    return _comment_row(row)


def delete_comment(tenant_id: str, user_id: str, comment_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            update collaboration_comments
            set deleted_at=now(), updated_at=now()
            where id=%s
              and tenant_id=%s
              and deleted_at is null
              and (user_id=%s or %s in (
                select user_id::text from tenant_memberships
                where tenant_id=%s and status='active' and role in ('tenant_owner', 'tenant_admin')
              ))
            returning id, entity_type, entity_id
            """,
            (comment_id, tenant_id, user_id, user_id, tenant_id),
        ).fetchone()
        if not row:
            raise FileNotFoundError(comment_id)
        _audit(conn, tenant_id, user_id, "collaboration.comment_deleted", "collaboration_comment", comment_id, {"entity_type": row["entity_type"], "entity_id": row["entity_id"]})
        conn.commit()
    return {"id": comment_id, "deleted": True}


def list_tasks(
    tenant_id: str,
    user_id: str,
    *,
    status: str | None = None,
    assignee: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
) -> list[dict[str, Any]]:
    if status:
        status = _validate_choice(status, TASK_STATUSES, "status")
    if entity_type:
        _validate_entity_type(entity_type)
    assignee_user_id = user_id if assignee == "me" else assignee
    with db() as conn:
        rows = conn.execute(
            """
            select recruiter_tasks.*,
                   assignee.email as assignee_email,
                   assignee.name as assignee_name,
                   creator.email as created_by_email,
                   creator.name as created_by_name
            from recruiter_tasks
            left join users assignee on assignee.id = recruiter_tasks.assignee_user_id
            left join users creator on creator.id = recruiter_tasks.created_by_user_id
            where recruiter_tasks.tenant_id=%s
              and recruiter_tasks.deleted_at is null
              and (%s::text is null or recruiter_tasks.status=%s)
              and (%s::text is null or recruiter_tasks.assignee_user_id::text=%s)
              and (%s::text is null or recruiter_tasks.entity_type=%s)
              and (%s::text is null or recruiter_tasks.entity_id=%s)
            order by
              case recruiter_tasks.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
              recruiter_tasks.due_at nulls last,
              recruiter_tasks.created_at desc
            limit 200
            """,
            (tenant_id, status, status, assignee_user_id, assignee_user_id, entity_type, entity_type, entity_id, entity_id),
        ).fetchall()
    return [_task_row(row) for row in rows]


def create_task(
    tenant_id: str,
    user_id: str,
    entity_type: str,
    entity_id: str,
    title: str,
    *,
    body: str | None = None,
    assignee_user_id: str | None = None,
    due_at: str | None = None,
    priority: str = "normal",
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    _validate_entity_type(entity_type)
    priority = _validate_choice(priority or "normal", TASK_PRIORITIES, "priority")
    title = title.strip()
    if not title:
        raise ValueError("task title is required")
    with db() as conn:
        context = _entity_context(conn, tenant_id, entity_type, entity_id)
        if assignee_user_id:
            _tenant_user(conn, tenant_id, assignee_user_id)
        row = conn.execute(
            """
            with inserted as (
              insert into recruiter_tasks (
                tenant_id, entity_type, entity_id, document_id, campaign_id,
                campaign_candidate_id, title, body, priority, due_at,
                assignee_user_id, created_by_user_id, metadata
              )
              values (%s, %s, %s, %s, %s, %s, %s, %s, %s, nullif(%s, '')::timestamptz, %s, %s, %s)
              returning *
            )
            select inserted.*,
                   assignee.email as assignee_email,
                   assignee.name as assignee_name,
                   creator.email as created_by_email,
                   creator.name as created_by_name
            from inserted
            left join users assignee on assignee.id = inserted.assignee_user_id
            left join users creator on creator.id = inserted.created_by_user_id
            """,
            (
                tenant_id,
                entity_type,
                entity_id,
                context.get("document_id"),
                context.get("campaign_id"),
                context.get("campaign_candidate_id"),
                title,
                (body or "").strip() or None,
                priority,
                due_at or "",
                assignee_user_id,
                user_id,
                Jsonb(metadata or {}),
            ),
        ).fetchone()
        if assignee_user_id and assignee_user_id != user_id:
            _insert_notification(
                conn,
                tenant_id,
                assignee_user_id,
                user_id,
                "task.assigned",
                f"Task assigned: {title}",
                (body or "").strip() or None,
                entity_type,
                entity_id,
                {"task_id": str(row["id"])},
            )
        _notify_mentions(conn, tenant_id, user_id, f"{title} {body or ''}", entity_type, entity_id, "task.mentioned", "Mentioned in a task")
        _audit(conn, tenant_id, user_id, "collaboration.task_created", "recruiter_task", str(row["id"]), {"entity_type": entity_type, "entity_id": entity_id, "assignee_user_id": assignee_user_id})
        conn.commit()
    return _task_row(row)


def update_task(
    tenant_id: str,
    user_id: str,
    task_id: str,
    *,
    title: str | None = None,
    body: str | None = None,
    status: str | None = None,
    assignee_user_id: str | None = None,
    due_at: str | None = None,
    priority: str | None = None,
) -> dict[str, Any]:
    if status:
        status = _validate_choice(status, TASK_STATUSES, "status")
    if priority:
        priority = _validate_choice(priority, TASK_PRIORITIES, "priority")
    with db() as conn:
        existing = conn.execute("select * from recruiter_tasks where id=%s and tenant_id=%s and deleted_at is null", (task_id, tenant_id)).fetchone()
        if not existing:
            raise FileNotFoundError(task_id)
        next_assignee = assignee_user_id if assignee_user_id is not None else existing.get("assignee_user_id")
        if next_assignee:
            _tenant_user(conn, tenant_id, str(next_assignee))
        next_status = status or existing["status"]
        row = conn.execute(
            """
            with updated as (
              update recruiter_tasks
              set title=coalesce(nullif(%s, ''), title),
                  body=case when %s::boolean then nullif(%s, '') else body end,
                  status=%s,
                  priority=coalesce(%s, priority),
                  due_at=case when %s::boolean then nullif(%s, '')::timestamptz else due_at end,
                  assignee_user_id=%s,
                  completed_at=case when %s='done' and completed_at is null then now() when %s <> 'done' then null else completed_at end,
                  updated_at=now()
              where id=%s and tenant_id=%s and deleted_at is null
              returning *
            )
            select updated.*,
                   assignee.email as assignee_email,
                   assignee.name as assignee_name,
                   creator.email as created_by_email,
                   creator.name as created_by_name
            from updated
            left join users assignee on assignee.id = updated.assignee_user_id
            left join users creator on creator.id = updated.created_by_user_id
            """,
            (
                (title or "").strip(),
                body is not None,
                (body or "").strip(),
                next_status,
                priority,
                due_at is not None,
                due_at or "",
                next_assignee,
                next_status,
                next_status,
                task_id,
                tenant_id,
            ),
        ).fetchone()
        if next_assignee and str(next_assignee) != str(existing.get("assignee_user_id") or "") and str(next_assignee) != user_id:
            _insert_notification(
                conn,
                tenant_id,
                str(next_assignee),
                user_id,
                "task.assigned",
                f"Task assigned: {row['title']}",
                row.get("body"),
                row["entity_type"],
                row["entity_id"],
                {"task_id": str(row["id"])},
            )
        _audit(conn, tenant_id, user_id, "collaboration.task_updated", "recruiter_task", task_id, {"status": next_status, "assignee_user_id": str(next_assignee) if next_assignee else None})
        conn.commit()
    return _task_row(row)


def delete_task(tenant_id: str, user_id: str, task_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            update recruiter_tasks
            set deleted_at=now(), updated_at=now(), status='cancelled'
            where id=%s and tenant_id=%s and deleted_at is null
            returning id
            """,
            (task_id, tenant_id),
        ).fetchone()
        if not row:
            raise FileNotFoundError(task_id)
        _audit(conn, tenant_id, user_id, "collaboration.task_deleted", "recruiter_task", task_id, {})
        conn.commit()
    return {"id": task_id, "deleted": True}


def list_notifications(tenant_id: str, user_id: str, unread_only: bool = False, limit: int = 50) -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            """
            select recruiter_notifications.*, actor.email as actor_email, actor.name as actor_name
            from recruiter_notifications
            left join users actor on actor.id = recruiter_notifications.actor_user_id
            where recruiter_notifications.tenant_id=%s
              and recruiter_notifications.user_id=%s
              and (%s::boolean=false or recruiter_notifications.read_at is null)
            order by recruiter_notifications.created_at desc
            limit %s
            """,
            (tenant_id, user_id, unread_only, max(1, min(200, int(limit or 50)))),
        ).fetchall()
    return [_notification_row(row) for row in rows]


def mark_notification_read(tenant_id: str, user_id: str, notification_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            update recruiter_notifications
            set read_at=coalesce(read_at, now())
            where id=%s and tenant_id=%s and user_id=%s
            returning *
            """,
            (notification_id, tenant_id, user_id),
        ).fetchone()
        if not row:
            raise FileNotFoundError(notification_id)
        conn.commit()
    return _notification_row(row)


def list_saved_views(tenant_id: str, user_id: str, view_type: str | None = None) -> list[dict[str, Any]]:
    if view_type:
        view_type = _validate_choice(view_type, VIEW_TYPES, "view_type")
    with db() as conn:
        rows = conn.execute(
            """
            select saved_workspace_views.*, users.email as user_email, users.name as user_name
            from saved_workspace_views
            left join users on users.id = saved_workspace_views.user_id
            where saved_workspace_views.tenant_id=%s
              and saved_workspace_views.deleted_at is null
              and (%s::text is null or saved_workspace_views.view_type=%s)
              and (saved_workspace_views.visibility='team' or saved_workspace_views.user_id=%s)
            order by saved_workspace_views.updated_at desc
            """,
            (tenant_id, view_type, view_type, user_id),
        ).fetchall()
    return [_saved_view_row(row) for row in rows]


def save_workspace_view(
    tenant_id: str,
    user_id: str,
    name: str,
    view_type: str,
    *,
    query: str | None = None,
    filters: dict[str, Any] | None = None,
    visibility: str = "private",
) -> dict[str, Any]:
    view_type = _validate_choice(view_type, VIEW_TYPES, "view_type")
    visibility = _validate_choice(visibility or "private", VIEW_VISIBILITIES, "visibility")
    name = name.strip()
    if not name:
        raise ValueError("saved view name is required")
    with db() as conn:
        row = conn.execute(
            """
            insert into saved_workspace_views (tenant_id, user_id, name, view_type, query, filters, visibility)
            values (%s, %s, %s, %s, %s, %s, %s)
            returning *
            """,
            (tenant_id, user_id, name, view_type, (query or "").strip() or None, Jsonb(filters or {}), visibility),
        ).fetchone()
        _audit(conn, tenant_id, user_id, "collaboration.saved_view_created", "saved_workspace_view", str(row["id"]), {"view_type": view_type, "visibility": visibility})
        conn.commit()
    return _saved_view_row(row)


def delete_saved_view(tenant_id: str, user_id: str, view_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            update saved_workspace_views
            set deleted_at=now(), updated_at=now()
            where id=%s
              and tenant_id=%s
              and deleted_at is null
              and (user_id=%s or %s in (
                select user_id::text from tenant_memberships
                where tenant_id=%s and status='active' and role in ('tenant_owner', 'tenant_admin')
              ))
            returning id
            """,
            (view_id, tenant_id, user_id, user_id, tenant_id),
        ).fetchone()
        if not row:
            raise FileNotFoundError(view_id)
        _audit(conn, tenant_id, user_id, "collaboration.saved_view_deleted", "saved_workspace_view", view_id, {})
        conn.commit()
    return {"id": view_id, "deleted": True}


def _entity_context(conn: Any, tenant_id: str, entity_type: str, entity_id: str) -> dict[str, Any]:
    if entity_type == "candidate":
        row = conn.execute(
            "select document_id from candidates where document_id=%s and tenant_id=%s and deleted_at is null",
            (entity_id, tenant_id),
        ).fetchone()
        if not row:
            raise FileNotFoundError(entity_id)
        return {"document_id": row["document_id"], "campaign_id": None, "campaign_candidate_id": None}
    if entity_type == "campaign":
        row = conn.execute(
            "select id from job_campaigns where id=%s and tenant_id=%s and deleted_at is null",
            (entity_id, tenant_id),
        ).fetchone()
        if not row:
            raise FileNotFoundError(entity_id)
        return {"document_id": None, "campaign_id": str(row["id"]), "campaign_candidate_id": None}
    row = conn.execute(
        """
        select id, campaign_id, candidate_id
        from campaign_candidates
        where id=%s and tenant_id=%s
        """,
        (entity_id, tenant_id),
    ).fetchone()
    if not row:
        raise FileNotFoundError(entity_id)
    return {"document_id": row["candidate_id"], "campaign_id": str(row["campaign_id"]), "campaign_candidate_id": str(row["id"])}


def _tenant_user(conn: Any, tenant_id: str, user_id: str) -> dict[str, Any]:
    row = conn.execute(
        """
        select users.id, users.email, users.name
        from users
        join tenant_memberships on tenant_memberships.user_id=users.id
        where users.id=%s
          and tenant_memberships.tenant_id=%s
          and tenant_memberships.status='active'
        """,
        (user_id, tenant_id),
    ).fetchone()
    if not row:
        raise FileNotFoundError(user_id)
    return row


def _notify_mentions(
    conn: Any,
    tenant_id: str,
    actor_user_id: str,
    text: str,
    entity_type: str,
    entity_id: str,
    event_type: str,
    title: str,
) -> None:
    emails = sorted(set(match.lower() for match in re.findall(r"@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})", text or "")))
    if not emails:
        return
    rows = conn.execute(
        """
        select users.id, users.email
        from users
        join tenant_memberships on tenant_memberships.user_id=users.id
        where tenant_memberships.tenant_id=%s
          and tenant_memberships.status='active'
          and lower(users.email) = any(%s)
        """,
        (tenant_id, emails),
    ).fetchall()
    for row in rows:
        mentioned_user_id = str(row["id"])
        if mentioned_user_id == actor_user_id:
            continue
        _insert_notification(
            conn,
            tenant_id,
            mentioned_user_id,
            actor_user_id,
            event_type,
            title,
            text[:500],
            entity_type,
            entity_id,
            {"mentioned_email": row["email"]},
        )


def _insert_notification(
    conn: Any,
    tenant_id: str,
    user_id: str,
    actor_user_id: str | None,
    event_type: str,
    title: str,
    body: str | None,
    entity_type: str | None,
    entity_id: str | None,
    metadata: dict[str, Any] | None = None,
) -> None:
    conn.execute(
        """
        insert into recruiter_notifications (
          tenant_id, user_id, actor_user_id, event_type, title, body,
          entity_type, entity_id, metadata
        )
        values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (tenant_id, user_id, actor_user_id, event_type, title[:300], body, entity_type, entity_id, Jsonb(metadata or {})),
    )


def _audit(conn: Any, tenant_id: str, user_id: str | None, action: str, entity_type: str, entity_id: str, metadata: dict[str, Any]) -> None:
    conn.execute(
        """
        insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
        values (%s, %s, %s, %s, %s, %s)
        """,
        (tenant_id, user_id, action, entity_type, entity_id, Jsonb(metadata)),
    )


def _validate_entity_type(value: str) -> str:
    return _validate_choice(value, ENTITY_TYPES, "entity_type")


def _validate_choice(value: str, choices: set[str], field: str) -> str:
    normalized = (value or "").strip().lower()
    if normalized not in choices:
        raise ValueError(f"unsupported {field}: {value}")
    return normalized


def _comment_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "tenant_id": str(row["tenant_id"]),
        "entity_type": row["entity_type"],
        "entity_id": row["entity_id"],
        "document_id": row.get("document_id"),
        "campaign_id": str(row["campaign_id"]) if row.get("campaign_id") else None,
        "campaign_candidate_id": str(row["campaign_candidate_id"]) if row.get("campaign_candidate_id") else None,
        "user_id": str(row["user_id"]) if row.get("user_id") else None,
        "user_email": row.get("user_email"),
        "user_name": row.get("user_name"),
        "body": row["body"],
        "visibility": row["visibility"],
        "metadata": row.get("metadata") or {},
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


def _task_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "tenant_id": str(row["tenant_id"]),
        "entity_type": row["entity_type"],
        "entity_id": row["entity_id"],
        "document_id": row.get("document_id"),
        "campaign_id": str(row["campaign_id"]) if row.get("campaign_id") else None,
        "campaign_candidate_id": str(row["campaign_candidate_id"]) if row.get("campaign_candidate_id") else None,
        "title": row["title"],
        "body": row.get("body"),
        "status": row["status"],
        "priority": row["priority"],
        "due_at": row["due_at"].isoformat() if row.get("due_at") else None,
        "assignee_user_id": str(row["assignee_user_id"]) if row.get("assignee_user_id") else None,
        "assignee_email": row.get("assignee_email"),
        "assignee_name": row.get("assignee_name"),
        "created_by_user_id": str(row["created_by_user_id"]) if row.get("created_by_user_id") else None,
        "created_by_email": row.get("created_by_email"),
        "created_by_name": row.get("created_by_name"),
        "completed_at": row["completed_at"].isoformat() if row.get("completed_at") else None,
        "metadata": row.get("metadata") or {},
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


def _notification_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "tenant_id": str(row["tenant_id"]),
        "user_id": str(row["user_id"]),
        "actor_user_id": str(row["actor_user_id"]) if row.get("actor_user_id") else None,
        "actor_email": row.get("actor_email"),
        "actor_name": row.get("actor_name"),
        "event_type": row["event_type"],
        "title": row["title"],
        "body": row.get("body"),
        "entity_type": row.get("entity_type"),
        "entity_id": row.get("entity_id"),
        "metadata": row.get("metadata") or {},
        "read_at": row["read_at"].isoformat() if row.get("read_at") else None,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }


def _saved_view_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "tenant_id": str(row["tenant_id"]),
        "user_id": str(row["user_id"]) if row.get("user_id") else None,
        "user_email": row.get("user_email"),
        "user_name": row.get("user_name"),
        "name": row["name"],
        "view_type": row["view_type"],
        "query": row.get("query"),
        "filters": row.get("filters") or {},
        "visibility": row["visibility"],
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }
