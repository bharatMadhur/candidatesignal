from __future__ import annotations

from typing import Any

from psycopg.types.json import Jsonb

from .campaigns import get_campaign, run_campaign_match
from .db import db


ACTIVE_MATCH_JOB_STATUSES = {"queued", "retrying", "running"}
TERMINAL_MATCH_JOB_STATUSES = {"succeeded", "failed", "cancelled"}
MATCH_RETRY_BACKOFF_SECONDS = 60
STALE_RUNNING_MINUTES = 60


def create_campaign_match_job(
    campaign_id: str,
    tenant_id: str,
    user_id: str,
    *,
    mode: str = "full",
    candidate_ids: list[str] | None = None,
) -> dict[str, Any]:
    campaign = get_campaign(campaign_id, tenant_id)
    requirement_id = campaign.get("requirement_id")
    if not requirement_id:
        raise ValueError("campaign has no requirement profile")
    match_mode = (mode or "full").strip().lower()
    if match_mode not in {"full", "incremental"}:
        raise ValueError(f"unsupported campaign match mode: {mode}")
    scoped_candidate_ids = _dedupe_ids(candidate_ids or [])
    with db() as conn:
        row = conn.execute(
            """
            insert into campaign_match_jobs (
              tenant_id, campaign_id, requirement_id, created_by_user_id, mode, candidate_ids, status, stage
            )
            values (%s, %s, %s, %s, %s, %s, 'queued', 'queued')
            returning *
            """,
            (tenant_id, campaign_id, requirement_id, user_id, match_mode, Jsonb(scoped_candidate_ids)),
        ).fetchone()
        conn.execute(
            """
            insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
            values (%s, %s, 'campaign.match_queued', 'campaign_match_job', %s, %s)
            """,
            (tenant_id, user_id, str(row["id"]), Jsonb({"campaign_id": campaign_id, "mode": match_mode, "candidate_count": len(scoped_candidate_ids)})),
        )
        conn.commit()
    return match_job_row(row)


def get_campaign_match_job(job_id: str, tenant_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            "select * from campaign_match_jobs where id=%s and tenant_id=%s",
            (job_id, tenant_id),
        ).fetchone()
    if not row:
        raise FileNotFoundError(job_id)
    return match_job_row(row)


def list_campaign_match_jobs(campaign_id: str, tenant_id: str, *, limit: int = 10) -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            """
            select * from campaign_match_jobs
            where campaign_id=%s and tenant_id=%s
            order by created_at desc
            limit %s
            """,
            (campaign_id, tenant_id, limit),
        ).fetchall()
    return [match_job_row(row) for row in rows]


def retry_campaign_match_job(job_id: str, tenant_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            update campaign_match_jobs
            set status='queued', stage='queued', error_message=null, completed_at=null, updated_at=now()
            where id=%s and tenant_id=%s and status in ('failed', 'cancelled')
            returning *
            """,
            (job_id, tenant_id),
        ).fetchone()
        conn.commit()
    if not row:
        raise FileNotFoundError(job_id)
    return match_job_row(row)


def cancel_campaign_match_job(job_id: str, tenant_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            update campaign_match_jobs
            set status='cancelled', stage='cancelled', completed_at=now(), updated_at=now()
            where id=%s and tenant_id=%s and status in ('queued', 'retrying', 'running')
            returning *
            """,
            (job_id, tenant_id),
        ).fetchone()
        conn.commit()
    if not row:
        raise FileNotFoundError(job_id)
    return match_job_row(row)


def run_next_match_job(tenant_id: str | None = None) -> dict[str, Any] | None:
    reconcile_campaign_match_jobs(tenant_id=tenant_id)
    with db() as conn:
        row = conn.execute(
            """
            select *
            from campaign_match_jobs
            where status in ('queued', 'retrying')
              and (%s::uuid is null or tenant_id=%s)
              and (status <> 'retrying' or updated_at <= now() - (%s * interval '1 second'))
            order by created_at
            for update skip locked
            limit 1
            """,
            (tenant_id, tenant_id, MATCH_RETRY_BACKOFF_SECONDS),
        ).fetchone()
        if not row:
            return None
        conn.execute(
            """
            update campaign_match_jobs
            set status='running', stage='matching', attempt_count=attempt_count + 1,
                started_at=coalesce(started_at, now()), updated_at=now()
            where id=%s
            """,
            (row["id"],),
        )
        conn.commit()
    return run_campaign_match_job(str(row["id"]), str(row["tenant_id"]))


def run_campaign_match_job(job_id: str, tenant_id: str) -> dict[str, Any]:
    job = get_campaign_match_job(job_id, tenant_id)
    if job["status"] == "cancelled":
        return job
    try:
        _set_match_stage(job_id, tenant_id, "running", "retrieving_candidates")
        campaign = run_campaign_match(
            job["campaign_id"],
            tenant_id,
            job["created_by_user_id"],
            mode=job["mode"],
            candidate_ids=job["candidate_ids"],
        )
    except Exception as exc:
        return _mark_failed_or_retrying(job, exc)
    current = get_campaign_match_job(job_id, tenant_id)
    if current["status"] == "cancelled":
        return current
    with db() as conn:
        row = conn.execute(
            """
            update campaign_match_jobs
            set status='succeeded', stage='succeeded', result=%s, error_message=null,
                completed_at=now(), updated_at=now()
            where id=%s and tenant_id=%s and status <> 'cancelled'
            returning *
            """,
            (
                Jsonb({
                    "campaign_id": campaign.get("id"),
                    "match_count": len(campaign.get("matches") or []),
                    "match_mode": campaign.get("match_mode"),
                }),
                job_id,
                tenant_id,
            ),
        ).fetchone()
        conn.commit()
    if not row:
        return get_campaign_match_job(job_id, tenant_id)
    return match_job_row(row)


def reconcile_campaign_match_jobs(*, tenant_id: str | None = None, stale_after_minutes: int = STALE_RUNNING_MINUTES) -> dict[str, int]:
    with db() as conn:
        rows = conn.execute(
            """
            update campaign_match_jobs
            set status=case when attempt_count < max_attempts then 'retrying' else 'failed' end,
                stage=case when attempt_count < max_attempts then 'retrying' else 'failed' end,
                error_message='Worker heartbeat/stage timeout while matching campaign.',
                completed_at=case when attempt_count >= max_attempts then now() else completed_at end,
                updated_at=now()
            where status='running'
              and updated_at <= now() - (%s * interval '1 minute')
              and (%s::uuid is null or tenant_id=%s)
            returning status
            """,
            (stale_after_minutes, tenant_id, tenant_id),
        ).fetchall()
        conn.commit()
    return {
        "retrying": sum(1 for row in rows if row["status"] == "retrying"),
        "failed": sum(1 for row in rows if row["status"] == "failed"),
    }


def match_job_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "tenant_id": str(row["tenant_id"]),
        "campaign_id": str(row["campaign_id"]),
        "requirement_id": str(row["requirement_id"]) if row.get("requirement_id") else None,
        "created_by_user_id": str(row["created_by_user_id"]) if row.get("created_by_user_id") else None,
        "mode": row["mode"],
        "candidate_ids": list(row.get("candidate_ids") or []),
        "status": row["status"],
        "stage": row["stage"],
        "attempt_count": int(row.get("attempt_count") or 0),
        "max_attempts": int(row.get("max_attempts") or 0),
        "result": row.get("result") or {},
        "error_message": row.get("error_message"),
        "started_at": row["started_at"].isoformat() if row.get("started_at") else None,
        "completed_at": row["completed_at"].isoformat() if row.get("completed_at") else None,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


def _mark_failed_or_retrying(job: dict[str, Any], exc: Exception) -> dict[str, Any]:
    next_status = "retrying" if job["attempt_count"] < job["max_attempts"] else "failed"
    with db() as conn:
        row = conn.execute(
            """
            update campaign_match_jobs
            set status=%s, stage=%s, error_message=%s,
                completed_at=case when %s='failed' then now() else completed_at end,
                updated_at=now()
            where id=%s and tenant_id=%s and status <> 'cancelled'
            returning *
            """,
            (next_status, next_status, str(exc), next_status, job["id"], job["tenant_id"]),
        ).fetchone()
        conn.commit()
    return match_job_row(row) if row else get_campaign_match_job(job["id"], job["tenant_id"])


def _set_match_stage(job_id: str, tenant_id: str, status: str, stage: str) -> None:
    with db() as conn:
        conn.execute(
            """
            update campaign_match_jobs
            set status=%s, stage=%s, updated_at=now()
            where id=%s and tenant_id=%s and status <> 'cancelled'
            """,
            (status, stage, job_id, tenant_id),
        )
        conn.commit()


def _dedupe_ids(values: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        text = str(value or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        deduped.append(text)
    return deduped
