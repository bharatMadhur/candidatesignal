from __future__ import annotations

import os
from typing import Any

from psycopg.types.json import Jsonb

from .db import db
from .db_store import save_candidate_db
from .derive import add_derived_fields, normalize_domain_years
from .schema import ResumeRecord
from .timeline import build_timeline_profile


TERMINAL_STATUSES = {"succeeded", "completed_with_errors", "failed", "cancelled"}


def rederive_candidate_record(record: dict[str, Any], raw_text: str | None) -> dict[str, Any]:
    """Rebuild deterministic candidate intelligence without calling OCR or LLMs."""

    canonical = ResumeRecord.model_validate(record)
    enriched = add_derived_fields(canonical, raw_text)
    deterministic = enriched.model_dump(mode="json")
    for key in (
        "name",
        "contact",
        "summary",
        "skills",
        "experience",
        "education",
        "projects",
        "certifications",
        "awards",
        "publications",
        "languages",
        "notes",
        "other_sections",
        "derived",
    ):
        record[key] = deterministic.get(key)
    timeline_profile = build_timeline_profile(record)
    record.setdefault("derived", {})["timeline"] = timeline_profile
    record["derived"].setdefault("hr_profile", {})["total_years_experience"] = timeline_profile["experience_accounting"]["total_years_unique"]
    record["derived"]["hr_profile"]["total_months_experience"] = timeline_profile["experience_accounting"]["total_months_unique"]
    normalize_domain_years(record, raw_text)
    return record


def create_candidate_rederive_job(
    tenant_id: str,
    user_id: str,
    *,
    refresh_embeddings: bool = False,
) -> dict[str, Any]:
    if refresh_embeddings and not _embedding_refresh_allowed():
        raise ValueError("embedding refresh is disabled for maintenance jobs")
    with db() as conn:
        count_row = conn.execute(
            "select count(*) as count from candidates where tenant_id=%s",
            (tenant_id,),
        ).fetchone()
        total = int(count_row["count"] or 0)
        row = conn.execute(
            """
            insert into candidate_maintenance_jobs (
              tenant_id, created_by_user_id, job_type, status, stage,
              progress_percent, total_candidates, refresh_embeddings
            )
            values (%s, %s, 'candidate_rederive', 'queued', 'queued', 0, %s, %s)
            returning *
            """,
            (tenant_id, user_id, total, refresh_embeddings),
        ).fetchone()
        conn.execute(
            """
            insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
            values (%s, %s, 'candidate_maintenance.queued', 'candidate_maintenance_job', %s, %s)
            """,
            (
                tenant_id,
                user_id,
                str(row["id"]),
                Jsonb({"total_candidates": total, "refresh_embeddings": refresh_embeddings}),
            ),
        )
        conn.commit()
    return _maintenance_job_row(row)


def list_candidate_maintenance_jobs(tenant_id: str, *, limit: int = 20) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 100))
    with db() as conn:
        rows = conn.execute(
            """
            select candidate_maintenance_jobs.*, users.email as created_by_email
            from candidate_maintenance_jobs
            left join users on users.id = candidate_maintenance_jobs.created_by_user_id
            where candidate_maintenance_jobs.tenant_id=%s
            order by candidate_maintenance_jobs.created_at desc
            limit %s
            """,
            (tenant_id, limit),
        ).fetchall()
    return [_maintenance_job_row(row) for row in rows]


def retry_candidate_maintenance_job(job_id: str, tenant_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            update candidate_maintenance_jobs
            set status='queued',
                stage='queued',
                progress_percent=0,
                processed_candidates=0,
                failed_candidates=0,
                error_message=null,
                result_json='{}'::jsonb,
                started_at=null,
                completed_at=null,
                updated_at=now()
            where id=%s
              and tenant_id=%s
              and status in ('failed', 'completed_with_errors', 'cancelled')
            returning *
            """,
            (job_id, tenant_id),
        ).fetchone()
        conn.commit()
    if not row:
        raise FileNotFoundError(job_id)
    return _maintenance_job_row(row)


def cancel_candidate_maintenance_job(job_id: str, tenant_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            update candidate_maintenance_jobs
            set status='cancelled',
                stage='cancelled',
                progress_percent=100,
                completed_at=now(),
                updated_at=now()
            where id=%s
              and tenant_id=%s
              and status in ('queued', 'running')
            returning *
            """,
            (job_id, tenant_id),
        ).fetchone()
        conn.commit()
    if not row:
        raise FileNotFoundError(job_id)
    return _maintenance_job_row(row)


def run_candidate_rederive_job(job_id: str, tenant_id: str) -> dict[str, Any]:
    job = _lock_maintenance_job(job_id, tenant_id)
    if not job:
        return get_candidate_maintenance_job(job_id, tenant_id)
    if bool(job.get("refresh_embeddings")) and not _embedding_refresh_allowed():
        _finish_maintenance_job(
            job_id,
            tenant_id,
            "failed",
            "failed",
            0,
            0,
            "embedding refresh is disabled for maintenance jobs",
            {"errors": [{"error": "embedding refresh is disabled for maintenance jobs"}]},
        )
        return get_candidate_maintenance_job(job_id, tenant_id)

    with db() as conn:
        rows = conn.execute(
            """
            select document_id, tenant_id, created_by_user_id, record_json, raw_text
            from candidates
            where tenant_id=%s
            order by updated_at desc
            """,
            (tenant_id,),
        ).fetchall()

    total = len(rows)
    if total == 0:
        _finish_maintenance_job(job_id, tenant_id, "succeeded", "succeeded", 0, 0, None, {"message": "no candidates found"})
        return get_candidate_maintenance_job(job_id, tenant_id)

    processed = 0
    failed = 0
    errors: list[dict[str, str]] = []
    refresh_embeddings = bool(job.get("refresh_embeddings"))
    for row in rows:
        if _maintenance_job_cancelled(job_id, tenant_id):
            _finish_maintenance_job(
                job_id,
                tenant_id,
                "cancelled",
                "cancelled",
                processed,
                failed,
                "cancelled by operator",
                {"errors": errors, "processed_before_cancel": processed},
            )
            return get_candidate_maintenance_job(job_id, tenant_id)
        try:
            record = rederive_candidate_record(row["record_json"], row.get("raw_text"))
            save_candidate_db(
                record,
                row.get("raw_text"),
                str(row["created_by_user_id"]) if row.get("created_by_user_id") else None,
                str(row["tenant_id"]),
                reindex_search=refresh_embeddings,
            )
            processed += 1
        except Exception as exc:
            failed += 1
            errors.append({"document_id": str(row["document_id"]), "error": str(exc)[:1000]})
        _update_maintenance_progress(job_id, tenant_id, total, processed, failed)

    status = "succeeded" if failed == 0 else "completed_with_errors" if processed > 0 else "failed"
    error_message = f"{failed} candidate(s) failed deterministic maintenance" if failed else None
    _finish_maintenance_job(
        job_id,
        tenant_id,
        status,
        status,
        processed,
        failed,
        error_message,
        {"errors": errors, "refresh_embeddings": refresh_embeddings},
    )
    return get_candidate_maintenance_job(job_id, tenant_id)


def get_candidate_maintenance_job(job_id: str, tenant_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            select candidate_maintenance_jobs.*, users.email as created_by_email
            from candidate_maintenance_jobs
            left join users on users.id = candidate_maintenance_jobs.created_by_user_id
            where candidate_maintenance_jobs.id=%s and candidate_maintenance_jobs.tenant_id=%s
            """,
            (job_id, tenant_id),
        ).fetchone()
    if not row:
        raise FileNotFoundError(job_id)
    return _maintenance_job_row(row)


def _lock_maintenance_job(job_id: str, tenant_id: str) -> dict[str, Any] | None:
    with db() as conn:
        row = conn.execute(
            """
            update candidate_maintenance_jobs
            set status='running',
                stage='rederiving_candidates',
                progress_percent=case when total_candidates = 0 then 100 else 1 end,
                started_at=coalesce(started_at, now()),
                updated_at=now()
            where id = (
              select id
              from candidate_maintenance_jobs
              where id=%s
                and tenant_id=%s
                and status='queued'
              for update skip locked
            )
            returning *
            """,
            (job_id, tenant_id),
        ).fetchone()
        conn.commit()
    return dict(row) if row else None


def _update_maintenance_progress(job_id: str, tenant_id: str, total: int, processed: int, failed: int) -> None:
    progress = round(((processed + failed) / total) * 100) if total else 100
    with db() as conn:
        conn.execute(
            """
            update candidate_maintenance_jobs
            set processed_candidates=%s,
                failed_candidates=%s,
                progress_percent=%s,
                updated_at=now()
            where id=%s and tenant_id=%s and status='running'
            """,
            (processed, failed, progress, job_id, tenant_id),
        )
        conn.commit()


def _finish_maintenance_job(
    job_id: str,
    tenant_id: str,
    status: str,
    stage: str,
    processed: int,
    failed: int,
    error_message: str | None,
    result: dict[str, Any],
) -> None:
    with db() as conn:
        row = conn.execute(
            """
            update candidate_maintenance_jobs
            set status=%s,
                stage=%s,
                progress_percent=100,
                processed_candidates=%s,
                failed_candidates=%s,
                error_message=%s,
                result_json=%s,
                completed_at=now(),
                updated_at=now()
            where id=%s and tenant_id=%s
            returning created_by_user_id, total_candidates
            """,
            (status, stage, processed, failed, error_message, Jsonb(result), job_id, tenant_id),
        ).fetchone()
        if row:
            conn.execute(
                """
                insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
                values (%s, %s, 'candidate_maintenance.completed', 'candidate_maintenance_job', %s, %s)
                """,
                (
                    tenant_id,
                    row["created_by_user_id"],
                    job_id,
                    Jsonb(
                        {
                            "status": status,
                            "processed_candidates": processed,
                            "failed_candidates": failed,
                            "total_candidates": int(row["total_candidates"] or 0),
                        }
                    ),
                ),
            )
        conn.commit()


def _maintenance_job_cancelled(job_id: str, tenant_id: str) -> bool:
    with db() as conn:
        row = conn.execute(
            "select status from candidate_maintenance_jobs where id=%s and tenant_id=%s",
            (job_id, tenant_id),
        ).fetchone()
    return bool(row and row["status"] == "cancelled")


def _maintenance_job_row(row: Any) -> dict[str, Any]:
    result = row.get("result_json") or {}
    return {
        "id": str(row["id"]),
        "tenant_id": str(row["tenant_id"]),
        "created_by_user_id": str(row["created_by_user_id"]) if row.get("created_by_user_id") else None,
        "created_by_email": row.get("created_by_email"),
        "job_type": row["job_type"],
        "status": row["status"],
        "stage": row["stage"],
        "stage_label": _stage_label(row["stage"]),
        "progress_percent": int(row["progress_percent"] or 0),
        "total_candidates": int(row["total_candidates"] or 0),
        "processed_candidates": int(row["processed_candidates"] or 0),
        "failed_candidates": int(row["failed_candidates"] or 0),
        "refresh_embeddings": bool(row["refresh_embeddings"]),
        "error_message": row.get("error_message"),
        "result": result,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
        "started_at": row["started_at"].isoformat() if row.get("started_at") else None,
        "completed_at": row["completed_at"].isoformat() if row.get("completed_at") else None,
    }


def _stage_label(stage: str) -> str:
    return {
        "queued": "Queued",
        "rederiving_candidates": "Recalculating candidate intelligence",
        "succeeded": "Completed",
        "completed_with_errors": "Completed with errors",
        "failed": "Failed",
        "cancelled": "Cancelled",
    }.get(stage, stage.replace("_", " ").title())


def _embedding_refresh_allowed() -> bool:
    return (os.getenv("RESUME_INTEL_ALLOW_MAINTENANCE_EMBEDDING_REFRESH") or "").strip().lower() in {"1", "true", "yes", "on"}
