from __future__ import annotations

from typing import Any

from psycopg.types.json import Jsonb

from .alert_delivery import deliver_operational_alert
from .db import db
from .parse_jobs import get_worker_status, list_dead_letters


def list_operational_alerts(tenant_id: str, *, status: str = "open", limit: int = 100) -> list[dict[str, Any]]:
    refresh_operational_alerts(tenant_id)
    limit = max(1, min(limit, 200))
    with db() as conn:
        rows = conn.execute(
            """
            select *
            from operational_alerts
            where tenant_id=%s
              and (%s::text = 'all' or status=%s)
            order by
              case severity when 'critical' then 0 when 'warning' then 1 else 2 end,
              created_at desc
            limit %s
            """,
            (tenant_id, status, status, limit),
        ).fetchall()
    return [_alert_row(row) for row in rows]


def refresh_operational_alerts(tenant_id: str) -> None:
    worker = get_worker_status(tenant_id)
    if not worker.get("online") and int(worker.get("queued_count") or 0) > 0:
        _upsert_alert(
            tenant_id,
            alert_type="worker_offline",
            severity="critical",
            title="Parse worker offline with queued resumes",
            body=f"{worker.get('queued_count')} queued resume(s) are waiting for a worker.",
            entity_type="parse_worker",
            entity_id=tenant_id,
            metadata=worker,
        )
    else:
        _resolve_alert(tenant_id, "worker_offline", "parse_worker", tenant_id)

    for item in list_dead_letters(tenant_id, status="open", limit=100):
        _upsert_alert(
            tenant_id,
            alert_type="parse_dead_letter",
            severity="critical",
            title=f"Parse failed: {item.get('original_filename') or 'Unknown file'}",
            body=item.get("error_message") or "Parse job failed after all retries.",
            entity_type="parse_job_dead_letter",
            entity_id=item["id"],
            metadata=item,
        )

    with db() as conn:
        stale_embeddings = conn.execute(
            """
            select candidates.document_id, candidates.name, candidates.original_filename
            from candidates
            left join candidate_search_chunks on candidate_search_chunks.tenant_id=candidates.tenant_id
              and candidate_search_chunks.document_id=candidates.document_id
            where candidates.tenant_id=%s
            group by candidates.document_id, candidates.name, candidates.original_filename
            having count(candidate_search_chunks.id)=0
            limit 25
            """,
            (tenant_id,),
        ).fetchall()
        ocr_warnings = conn.execute(
            """
            select document_id, page_number, quality_flags
            from document_pages
            where tenant_id=%s
              and quality_flags <> '[]'::jsonb
            order by created_at desc
            limit 25
            """,
            (tenant_id,),
        ).fetchall()

    for row in stale_embeddings:
        _upsert_alert(
            tenant_id,
            alert_type="stale_embedding",
            severity="warning",
            title=f"Candidate missing semantic index: {row.get('name') or row.get('original_filename') or row['document_id']}",
            body="This candidate may not appear in semantic search or Copilot until reindexed.",
            entity_type="candidate",
            entity_id=row["document_id"],
            metadata={"document_id": row["document_id"]},
        )
    for row in ocr_warnings:
        _upsert_alert(
            tenant_id,
            alert_type="ocr_quality_warning",
            severity="warning",
            title=f"OCR/extraction warning on page {row['page_number']}",
            body=", ".join(row.get("quality_flags") or []) or "Extraction quality warning.",
            entity_type="candidate",
            entity_id=row["document_id"],
            metadata={"document_id": row["document_id"], "page_number": row["page_number"], "quality_flags": row.get("quality_flags") or []},
        )


def acknowledge_alert(alert_id: str, tenant_id: str, user_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            update operational_alerts
            set status='acknowledged',
                acknowledged_by=%s,
                acknowledged_at=now()
            where id=%s and tenant_id=%s and status='open'
            returning *
            """,
            (user_id, alert_id, tenant_id),
        ).fetchone()
        conn.commit()
    if not row:
        raise FileNotFoundError(alert_id)
    return _alert_row(row)


def list_alert_deliveries(tenant_id: str, *, limit: int = 100) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 200))
    with db() as conn:
        rows = conn.execute(
            """
            select *
            from operational_alert_deliveries
            where tenant_id=%s
            order by created_at desc
            limit %s
            """,
            (tenant_id, limit),
        ).fetchall()
    return [
        {
            "id": str(row["id"]),
            "tenant_id": str(row["tenant_id"]) if row.get("tenant_id") else None,
            "alert_id": str(row["alert_id"]),
            "channel": row["channel"],
            "destination": row["destination"],
            "status": row["status"],
            "status_code": row.get("status_code"),
            "latency_ms": row.get("latency_ms"),
            "error_message": row.get("error_message"),
            "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        }
        for row in rows
    ]


def _upsert_alert(
    tenant_id: str,
    *,
    alert_type: str,
    severity: str,
    title: str,
    body: str,
    entity_type: str,
    entity_id: str,
    metadata: dict[str, Any],
) -> None:
    with db() as conn:
        existing = conn.execute(
            """
            select id, status
            from operational_alerts
            where tenant_id=%s
              and alert_type=%s
              and entity_type=%s
              and entity_id=%s
              and status in ('open', 'acknowledged')
            limit 1
            """,
            (tenant_id, alert_type, entity_type, entity_id),
        ).fetchone()
        if existing:
            conn.execute(
                """
                update operational_alerts
                set severity=%s, title=%s, body=%s, metadata=%s
                where id=%s
                """,
                (severity, title, body, Jsonb(metadata), existing["id"]),
            )
            row = None
        else:
            row = conn.execute(
                """
                insert into operational_alerts (tenant_id, alert_type, severity, title, body, entity_type, entity_id, metadata)
                values (%s, %s, %s, %s, %s, %s, %s, %s)
                returning *
                """,
                (tenant_id, alert_type, severity, title, body, entity_type, entity_id, Jsonb(metadata)),
            ).fetchone()
        conn.commit()
    if row:
        deliver_operational_alert(_alert_row(row))


def _resolve_alert(tenant_id: str, alert_type: str, entity_type: str, entity_id: str) -> None:
    with db() as conn:
        conn.execute(
            """
            update operational_alerts
            set status='resolved', resolved_at=now()
            where tenant_id=%s and alert_type=%s and entity_type=%s and entity_id=%s and status='open'
            """,
            (tenant_id, alert_type, entity_type, entity_id),
        )
        conn.commit()


def _alert_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "tenant_id": str(row["tenant_id"]) if row.get("tenant_id") else None,
        "alert_type": row["alert_type"],
        "severity": row["severity"],
        "title": row["title"],
        "body": row["body"],
        "entity_type": row.get("entity_type"),
        "entity_id": row.get("entity_id"),
        "status": row["status"],
        "metadata": row.get("metadata") or {},
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "acknowledged_at": row["acknowledged_at"].isoformat() if row.get("acknowledged_at") else None,
        "resolved_at": row["resolved_at"].isoformat() if row.get("resolved_at") else None,
    }
