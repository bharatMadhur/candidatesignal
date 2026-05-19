from __future__ import annotations

import os
import time
from typing import Any

import httpx
from psycopg.types.json import Jsonb

from .db import db


def deliver_operational_alert(alert: dict[str, Any]) -> None:
    """Deliver an alert to configured external sinks.

    This is intentionally opt-in. Without `RESUME_INTEL_ALERT_WEBHOOK_URL`, alerts
    stay in Postgres/UI only and no external network transfer happens.
    """

    webhook_url = (os.getenv("RESUME_INTEL_ALERT_WEBHOOK_URL") or "").strip()
    if not webhook_url:
        return
    payload = _webhook_payload(alert)
    started = time.perf_counter()
    status = "succeeded"
    error_message = None
    status_code = None
    try:
        response = httpx.post(webhook_url, json=payload, timeout=float(os.getenv("RESUME_INTEL_ALERT_WEBHOOK_TIMEOUT_SECONDS", "5")))
        status_code = response.status_code
        response.raise_for_status()
    except Exception as exc:
        status = "failed"
        error_message = str(exc)[:1000]
    finally:
        _record_delivery(
            alert_id=alert["id"],
            tenant_id=alert.get("tenant_id"),
            channel="webhook",
            destination=_redacted_destination(webhook_url),
            status=status,
            status_code=status_code,
            latency_ms=int((time.perf_counter() - started) * 1000),
            error_message=error_message,
            payload=payload,
        )


def _webhook_payload(alert: dict[str, Any]) -> dict[str, Any]:
    return {
        "product": "candidateSignal.ai",
        "alert_id": alert["id"],
        "tenant_id": alert.get("tenant_id"),
        "severity": alert.get("severity"),
        "alert_type": alert.get("alert_type"),
        "title": alert.get("title"),
        "body": alert.get("body"),
        "entity_type": alert.get("entity_type"),
        "entity_id": alert.get("entity_id"),
        "status": alert.get("status"),
        "created_at": alert.get("created_at"),
        "metadata": alert.get("metadata") or {},
    }


def _record_delivery(
    *,
    alert_id: str,
    tenant_id: str | None,
    channel: str,
    destination: str,
    status: str,
    status_code: int | None,
    latency_ms: int,
    error_message: str | None,
    payload: dict[str, Any],
) -> None:
    with db() as conn:
        conn.execute(
            """
            insert into operational_alert_deliveries (
              tenant_id, alert_id, channel, destination, status, status_code,
              latency_ms, error_message, payload
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (tenant_id, alert_id, channel, destination, status, status_code, latency_ms, error_message, Jsonb(payload)),
        )
        conn.commit()


def _redacted_destination(value: str) -> str:
    if "://" not in value:
        return "[configured]"
    prefix, rest = value.split("://", 1)
    host = rest.split("/", 1)[0]
    return f"{prefix}://{host}/..."
