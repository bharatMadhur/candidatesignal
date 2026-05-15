from __future__ import annotations

import re
from typing import Any

from psycopg.types.json import Jsonb

from .db import db


def list_copilot_threads(tenant_id: str, *, limit: int = 50) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 100))
    with db() as conn:
        rows = conn.execute(
            """
            select copilot_threads.*,
                   count(copilot_messages.id) as message_count,
                   max(copilot_messages.created_at) as last_message_at
            from copilot_threads
            left join copilot_messages on copilot_messages.thread_id = copilot_threads.id
              and copilot_messages.tenant_id = copilot_threads.tenant_id
            where copilot_threads.tenant_id=%s
              and copilot_threads.status='active'
            group by copilot_threads.id
            order by copilot_threads.updated_at desc
            limit %s
            """,
            (tenant_id, limit),
        ).fetchall()
    return [_thread_row(row) for row in rows]


def create_copilot_thread(tenant_id: str, user_id: str, title: str | None = None) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            insert into copilot_threads (tenant_id, created_by_user_id, title)
            values (%s, %s, %s)
            returning *
            """,
            (tenant_id, user_id, _safe_title(title) or "New Copilot Thread"),
        ).fetchone()
        conn.execute(
            """
            insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
            values (%s, %s, 'copilot.thread_created', 'copilot_thread', %s, %s)
            """,
            (tenant_id, user_id, str(row["id"]), Jsonb({"title": row["title"]})),
        )
        conn.commit()
    return get_copilot_thread(str(row["id"]), tenant_id)


def get_copilot_thread(thread_id: str, tenant_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            "select * from copilot_threads where id=%s and tenant_id=%s and status='active'",
            (thread_id, tenant_id),
        ).fetchone()
        messages = conn.execute(
            """
            select *
            from copilot_messages
            where thread_id=%s and tenant_id=%s
            order by created_at asc
            """,
            (thread_id, tenant_id),
        ).fetchall()
    if not row:
        raise FileNotFoundError(thread_id)
    return _thread_row(row) | {"messages": [_message_row(message) for message in messages]}


def append_copilot_message(
    tenant_id: str,
    thread_id: str,
    user_id: str | None,
    role: str,
    content: str,
    *,
    query: str | None = None,
    candidates: list[dict[str, Any]] | None = None,
    clarifying_questions: list[str] | None = None,
    suggested_actions: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if role not in {"user", "assistant"}:
        raise ValueError("role must be user or assistant")
    with db() as conn:
        thread = conn.execute(
            "select id, title from copilot_threads where id=%s and tenant_id=%s and status='active'",
            (thread_id, tenant_id),
        ).fetchone()
        if not thread:
            raise FileNotFoundError(thread_id)
        row = conn.execute(
            """
            insert into copilot_messages (
              tenant_id, thread_id, user_id, role, content, query,
              candidates_snapshot, clarifying_questions, suggested_actions, metadata
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            returning *
            """,
            (
                tenant_id,
                thread_id,
                user_id,
                role,
                content,
                query,
                Jsonb(candidates or []),
                Jsonb(clarifying_questions or []),
                Jsonb(suggested_actions or []),
                Jsonb(metadata or {}),
            ),
        ).fetchone()
        updates: list[str] = ["updated_at=now()"]
        values: list[Any] = []
        if role == "user" and thread["title"] == "New Copilot Thread":
            updates.append("title=%s")
            values.append(_title_from_message(content))
        values.extend([thread_id, tenant_id])
        conn.execute(
            f"update copilot_threads set {', '.join(updates)} where id=%s and tenant_id=%s",
            tuple(values),
        )
        conn.commit()
    return _message_row(row)


def archive_copilot_thread(thread_id: str, tenant_id: str, user_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            update copilot_threads
            set status='archived', updated_at=now()
            where id=%s and tenant_id=%s and status='active'
            returning *
            """,
            (thread_id, tenant_id),
        ).fetchone()
        if row:
            conn.execute(
                """
                insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id)
                values (%s, %s, 'copilot.thread_archived', 'copilot_thread', %s)
                """,
                (tenant_id, user_id, thread_id),
            )
        conn.commit()
    if not row:
        raise FileNotFoundError(thread_id)
    return _thread_row(row)


def _safe_title(title: str | None) -> str | None:
    cleaned = re.sub(r"\s+", " ", (title or "").strip())
    return cleaned[:120] or None


def _title_from_message(message: str) -> str:
    cleaned = _safe_title(message) or "New Copilot Thread"
    return cleaned[:72] + ("..." if len(cleaned) > 72 else "")


def _thread_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "tenant_id": str(row["tenant_id"]),
        "created_by_user_id": str(row["created_by_user_id"]) if row.get("created_by_user_id") else None,
        "title": row["title"],
        "status": row["status"],
        "message_count": int(row.get("message_count") or 0),
        "last_message_at": row["last_message_at"].isoformat() if row.get("last_message_at") else None,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


def _message_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "tenant_id": str(row["tenant_id"]),
        "thread_id": str(row["thread_id"]),
        "user_id": str(row["user_id"]) if row.get("user_id") else None,
        "role": row["role"],
        "content": row["content"],
        "query": row.get("query"),
        "candidates": row.get("candidates_snapshot") or [],
        "clarifying_questions": row.get("clarifying_questions") or [],
        "suggested_actions": row.get("suggested_actions") or [],
        "metadata": row.get("metadata") or {},
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }
