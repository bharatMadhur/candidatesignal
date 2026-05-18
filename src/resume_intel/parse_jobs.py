from __future__ import annotations

import socket
from pathlib import Path
from typing import Any, BinaryIO

from psycopg.types.json import Jsonb

from .db import db
from .db_store import add_note_db, llm_usage_cost_for_document, save_candidate_db
from .entity_resolution import find_matches_for_record, persist_matches
from .pipeline import SUPPORTED_EXTENSIONS, parse_file
from .settings import load_settings
from .storage import document_storage


ROOT = Path(__file__).resolve().parents[2]
TENANT_DATA_DIR = ROOT / "data" / "tenants"

TERMINAL_JOB_STATUSES = {"succeeded", "completed", "failed", "cancelled"}
TERMINAL_CAMPAIGN_STATUSES = {"shortlisted", "contacted", "replied", "screened", "submitted", "interviewing", "offer", "placed", "rejected", "archived"}
STAGE_PROGRESS = {
    "queued": (5, "Queued"),
    "extracting_text": (15, "Extracting text / OCR"),
    "llm_factual_pass": (35, "Factual LLM extraction"),
    "running": (35, "Parsing resume"),
    "saving": (78, "Saving candidate and metadata"),
    "embedding": (88, "Indexing semantic search"),
    "entity_resolution": (94, "Checking candidate versions"),
    "succeeded": (100, "Completed"),
    "completed": (100, "Completed"),
    "failed": (100, "Failed"),
    "retrying": (10, "Retry queued"),
    "cancelled": (100, "Cancelled"),
}


def create_parse_batch(
    tenant_id: str,
    user_id: str,
    files: list[tuple[str, BinaryIO]],
    name: str | None = None,
    initial_note_name: str | None = None,
    initial_note_content: str | None = None,
    campaign_id: str | None = None,
    context_note: str | None = None,
) -> dict[str, Any]:
    if not files:
        raise ValueError("no files provided")
    batch_name = name or "Bulk resume upload"
    with db() as conn:
        batch = conn.execute(
            """
            insert into parse_batches (tenant_id, campaign_id, created_by_user_id, name, source_type, total_files, queued_count, status, context_note)
            values (%s, %s, %s, %s, %s, %s, %s, 'queued', %s)
            returning *
            """,
            (tenant_id, campaign_id, user_id, batch_name, "campaign_upload" if campaign_id else "bulk_upload", len(files), len(files), (context_note or "").strip() or None),
        ).fetchone()
        conn.commit()

    jobs = []
    for filename, file_obj in files:
        jobs.append(
            _create_job_for_file(
                str(batch["id"]),
                tenant_id,
                user_id,
                filename,
                file_obj,
                initial_note_name,
                initial_note_content,
                campaign_id,
            )
        )
    return get_parse_batch(str(batch["id"]), tenant_id) | {"jobs": jobs}


def create_reparse_job_for_candidate(document_id: str, tenant_id: str, user_id: str) -> dict[str, Any]:
    """Queue a full deep parse using the candidate's stored original document."""
    source = _candidate_reparse_source(document_id, tenant_id)
    storage = document_storage(source["storage_backend"])
    source_path = storage.open_for_processing(source["storage_key"])
    with db() as conn:
        batch = conn.execute(
            """
            insert into parse_batches (tenant_id, created_by_user_id, name, source_type, total_files, queued_count, status)
            values (%s, %s, %s, 'candidate_reparse', 1, 1, 'queued')
            returning *
            """,
            (tenant_id, user_id, f"Reparse {source['original_filename']}"),
        ).fetchone()
        job = conn.execute(
            """
            insert into parse_jobs (
              tenant_id, batch_id, created_by_user_id, source_file, storage_backend, storage_key,
              source_hash, original_filename, mime_type, size_bytes, warning_message, status, stage
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'queued', 'queued')
            returning *
            """,
            (
                tenant_id,
                str(batch["id"]),
                user_id,
                str(source_path),
                source["storage_backend"],
                source["storage_key"],
                source.get("sha256"),
                source["original_filename"],
                source.get("mime_type"),
                source.get("size_bytes"),
                "Full reparse queued from stored original CV.",
            ),
        ).fetchone()
        conn.execute(
            """
            insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
            values (%s, %s, 'candidate.reparse_queued', 'candidate', %s, %s)
            """,
            (
                tenant_id,
                user_id,
                document_id,
                Jsonb({"parse_job_id": str(job["id"]), "batch_id": str(batch["id"]), "original_filename": source["original_filename"]}),
            ),
        )
        conn.commit()
    _record_job_event(
        str(job["id"]),
        tenant_id,
        "queued",
        "queued",
        "queued",
        "Queued existing candidate document for full deep reparse.",
        batch_id=str(batch["id"]),
        metadata={"document_id": document_id, "original_filename": source["original_filename"], "storage_backend": source["storage_backend"]},
    )
    return {"batch": get_parse_batch(str(batch["id"]), tenant_id), "job": _job_row(job)}


def _create_job_for_file(
    batch_id: str,
    tenant_id: str,
    user_id: str,
    filename: str,
    file_obj: BinaryIO,
    initial_note_name: str | None = None,
    initial_note_content: str | None = None,
    campaign_id: str | None = None,
) -> dict[str, Any]:
    suffix = Path(filename or "resume.pdf").suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"unsupported file type: {suffix}")
    safe_name = Path(filename or f"resume{suffix}").name
    stored = document_storage().save_upload(
        tenant_id=tenant_id,
        namespace=f"resumes/{batch_id}",
        filename=safe_name,
        file_obj=file_obj,
    )
    duplicate_warning = _duplicate_upload_warning(tenant_id, stored.sha256)
    with db() as conn:
        row = conn.execute(
            """
            insert into parse_jobs (
              tenant_id, batch_id, campaign_id, created_by_user_id, source_file, storage_backend, storage_key,
              source_hash, original_filename, mime_type, size_bytes, warning_message,
              initial_note_name, initial_note_content, status, stage
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'queued', 'queued')
            returning *
            """,
            (
                tenant_id,
                batch_id,
                campaign_id,
                user_id,
                str(stored.local_path),
                stored.backend,
                stored.key,
                stored.sha256,
                stored.original_filename,
                stored.content_type,
                stored.size_bytes,
                duplicate_warning,
                (initial_note_name or "").strip() or None,
                (initial_note_content or "").strip() or None,
            ),
        ).fetchone()
        conn.commit()
    _record_job_event(
        str(row["id"]),
        tenant_id,
        "queued",
        "queued",
        "queued",
        f"Queued {stored.original_filename} for deep parsing.",
        batch_id=str(batch_id),
            metadata={
                "original_filename": stored.original_filename,
                "size_bytes": stored.size_bytes,
                "storage_backend": stored.backend,
                "duplicate_warning": duplicate_warning,
                "campaign_id": campaign_id,
            },
    )
    return _job_row(row)


def list_parse_batches(tenant_id: str) -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            "select * from parse_batches where tenant_id=%s order by updated_at desc",
            (tenant_id,),
        ).fetchall()
    return [_batch_row(row) for row in rows]


def reconcile_parse_jobs(*, stale_after_hours: int = 24, tenant_id: str | None = None) -> dict[str, Any]:
    """Repair historical parse-job state without reparsing or deleting candidate data."""
    batch_keys: set[tuple[str, str]] = set()
    with db() as conn:
        normalized_rows = conn.execute(
            """
            update parse_jobs
            set status='succeeded', stage='succeeded', updated_at=now(),
                completed_at=coalesce(completed_at, updated_at)
            where status='completed'
              and (%s::uuid is null or tenant_id=%s)
            returning batch_id, tenant_id
            """,
            (tenant_id, tenant_id),
        ).fetchall()
        stale_rows = conn.execute(
            """
            update parse_jobs
            set status='cancelled',
                stage='cancelled',
                error_message=coalesce(error_message, 'Cancelled by parse-job reconciliation because the job was stale.'),
                updated_at=now()
            where status in ('queued', 'retrying', 'running', 'processing')
              and updated_at < now() - (%s * interval '1 hour')
              and (%s::uuid is null or tenant_id=%s)
            returning batch_id, tenant_id
            """,
            (stale_after_hours, tenant_id, tenant_id),
        ).fetchall()
        all_batch_rows = conn.execute(
            """
            select distinct batch_id, tenant_id
            from parse_jobs
            where batch_id is not null
              and (%s::uuid is null or tenant_id=%s)
            """,
            (tenant_id, tenant_id),
        ).fetchall()
        conn.commit()
    for row in [*normalized_rows, *stale_rows, *all_batch_rows]:
        if row.get("batch_id"):
            batch_keys.add((str(row["batch_id"]), str(row["tenant_id"])))
    for batch_id, row_tenant_id in batch_keys:
        _refresh_batch_counts(batch_id, row_tenant_id)
    return {
        "normalized_completed_jobs": len(normalized_rows),
        "cancelled_stale_jobs": len(stale_rows),
        "refreshed_batches": len(batch_keys),
        "stale_after_hours": stale_after_hours,
        "tenant_id": tenant_id,
    }


def get_parse_batch(batch_id: str, tenant_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute("select * from parse_batches where id=%s and tenant_id=%s", (batch_id, tenant_id)).fetchone()
        jobs = conn.execute(
            "select * from parse_jobs where batch_id=%s and tenant_id=%s order by created_at",
            (batch_id, tenant_id),
        ).fetchall()
        events = conn.execute(
            """
            select *
            from parse_job_events
            where batch_id=%s and tenant_id=%s
            order by created_at desc
            limit 100
            """,
            (batch_id, tenant_id),
        ).fetchall()
    if not row:
        raise FileNotFoundError(batch_id)
    return _batch_row(row) | {"jobs": [_job_row(job) for job in jobs], "events": [_job_event_row(event) for event in events]}


def get_parse_job(job_id: str, tenant_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute("select * from parse_jobs where id=%s and tenant_id=%s", (job_id, tenant_id)).fetchone()
        events = conn.execute(
            """
            select *
            from parse_job_events
            where job_id=%s and tenant_id=%s
            order by created_at desc
            limit 50
            """,
            (job_id, tenant_id),
        ).fetchall()
    if not row:
        raise FileNotFoundError(job_id)
    return _job_row(row) | {"events": [_job_event_row(event) for event in events]}


def _get_parse_job_internal(job_id: str, tenant_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute("select * from parse_jobs where id=%s and tenant_id=%s", (job_id, tenant_id)).fetchone()
    if not row:
        raise FileNotFoundError(job_id)
    return _job_row(row, public=False)


def retry_job(job_id: str, tenant_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            update parse_jobs
            set status='queued', stage='queued', error_message=null, updated_at=now()
            where id=%s and tenant_id=%s and status in ('failed', 'retrying', 'cancelled')
            returning *
            """,
            (job_id, tenant_id),
        ).fetchone()
        if row:
            conn.execute(
                """
                update parse_job_dead_letters
                set status='resolved_retry_queued', resolved_at=now(), updated_at=now()
                where job_id=%s and tenant_id=%s and status='open'
                """,
                (job_id, tenant_id),
            )
        conn.commit()
    if not row:
        raise FileNotFoundError(job_id)
    _record_job_event(
        job_id,
        tenant_id,
        "retry_queued",
        "queued",
        "queued",
        "Retry queued by recruiter/admin.",
        batch_id=str(row["batch_id"]) if row.get("batch_id") else None,
        metadata={"attempt_count": int(row["attempt_count"] or 0), "max_attempts": int(row["max_attempts"] or 0)},
    )
    _refresh_batch_counts(str(row["batch_id"]) if row["batch_id"] else None, tenant_id)
    return _job_row(row)


def cancel_job(job_id: str, tenant_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            update parse_jobs
            set status='cancelled', stage='cancelled', updated_at=now()
            where id=%s and tenant_id=%s and status in ('queued', 'retrying', 'failed', 'processing', 'running')
            returning *
            """,
            (job_id, tenant_id),
        ).fetchone()
        conn.commit()
    if not row:
        raise FileNotFoundError(job_id)
    _record_job_event(
        job_id,
        tenant_id,
        "cancelled",
        "cancelled",
        "cancelled",
        "Parse job cancelled. File and existing candidate data are preserved.",
        batch_id=str(row["batch_id"]) if row.get("batch_id") else None,
    )
    _refresh_batch_counts(str(row["batch_id"]) if row["batch_id"] else None, tenant_id)
    return _job_row(row)


def cancel_batch(batch_id: str, tenant_id: str) -> dict[str, Any]:
    with db() as conn:
        conn.execute(
            """
            update parse_jobs
            set status='cancelled', stage='cancelled', updated_at=now()
            where batch_id=%s and tenant_id=%s and status in ('queued', 'retrying', 'failed', 'processing', 'running')
            """,
            (batch_id, tenant_id),
        )
        row = conn.execute(
            """
            update parse_batches
            set status='cancelled', updated_at=now(), completed_at=now()
            where id=%s and tenant_id=%s and status in ('created', 'queued', 'processing', 'running', 'completed_with_errors')
            returning *
            """,
            (batch_id, tenant_id),
        ).fetchone()
        conn.commit()
    if not row:
        raise FileNotFoundError(batch_id)
    _refresh_batch_counts(batch_id, tenant_id)
    return get_parse_batch(batch_id, tenant_id)


def run_next_job(tenant_id: str | None = None, worker_id: str | None = None) -> dict[str, Any] | None:
    if worker_id:
        record_worker_heartbeat(worker_id, status="polling", tenant_id=tenant_id)
    with db() as conn:
        row = conn.execute(
            """
            update parse_jobs
            set status='running', stage='extracting_text', attempt_count=attempt_count+1,
                started_at=coalesce(started_at, now()), updated_at=now()
            where id = (
              select id from parse_jobs
              where status in ('queued', 'retrying')
                and (%s::uuid is null or tenant_id=%s)
              order by created_at
              for update skip locked
              limit 1
            )
            returning *
            """,
            (tenant_id, tenant_id),
        ).fetchone()
        conn.commit()
    if not row:
        if worker_id:
            record_worker_heartbeat(worker_id, status="idle", tenant_id=tenant_id)
        return None
    _record_job_event(
        str(row["id"]),
        str(row["tenant_id"]),
        "started",
        "running",
        "extracting_text",
        "Worker locked the job and started extraction.",
        batch_id=str(row["batch_id"]) if row.get("batch_id") else None,
        metadata={"worker_id": worker_id} if worker_id else {},
    )
    if worker_id:
        record_worker_heartbeat(worker_id, status="running", tenant_id=str(row["tenant_id"]), current_job_id=str(row["id"]))
    return run_job(str(row["id"]), str(row["tenant_id"]), worker_id=worker_id)


def run_job(job_id: str, tenant_id: str, worker_id: str | None = None) -> dict[str, Any]:
    job = _get_parse_job_internal(job_id, tenant_id)
    if job["status"] == "cancelled":
        return job
    try:
        _set_job_stage(job_id, tenant_id, "running", "llm_factual_pass")
        if worker_id:
            record_worker_heartbeat(worker_id, status="running", tenant_id=tenant_id, current_job_id=job_id)
        tenant_root = TENANT_DATA_DIR / tenant_id
        output_dir = tenant_root / "output"
        work_dir = tenant_root / "work"
        source_path = _job_source_path(job)
        storage_metadata = {
            "storage_backend": job.get("storage_backend") or "local",
            "storage_key": job.get("storage_key"),
            "original_filename": job.get("original_filename"),
            "mime_type": job.get("mime_type"),
            "size_bytes": job.get("size_bytes"),
            "sha256": job.get("source_hash"),
        }
        record = parse_file(source_path, output_dir, work_dir, load_settings(), storage_metadata=storage_metadata)
        record["tenant_id"] = tenant_id
        raw_text = Path(record["_metadata"]["raw_text_path"]).read_text() if record.get("_metadata") else None
        _set_job_stage(job_id, tenant_id, "running", "saving")
        if worker_id:
            record_worker_heartbeat(worker_id, status="saving", tenant_id=tenant_id, current_job_id=job_id)
        record = save_candidate_db(record, raw_text, job["created_by_user_id"], tenant_id)
        if job.get("initial_note_content"):
            record = add_note_db(
                record["document_id"],
                job["created_by_user_id"],
                job.get("initial_note_name") or "Recruiter Notes",
                job["initial_note_content"],
                tenant_id,
            )
        if job.get("campaign_id"):
            _attach_campaign_candidate(
                tenant_id,
                job["campaign_id"],
                record["document_id"],
                source="uploaded",
                status="uploaded",
                score=0.0,
                evidence={"parse_job_id": job_id, "batch_id": job.get("batch_id"), "original_filename": job.get("original_filename")},
            )
        _set_job_stage(job_id, tenant_id, "running", "entity_resolution")
        if worker_id:
            record_worker_heartbeat(worker_id, status="entity_resolution", tenant_id=tenant_id, current_job_id=job_id)
        matches = find_matches_for_record(record, tenant_id=tenant_id)
        persist_matches(record, matches, tenant_id)
        totals = record.get("llm_usage_totals") or {}
        _complete_job(
            job_id,
            tenant_id,
            document_id=record["document_id"],
            ocr_used=(record.get("_metadata", {}).get("extraction_method") or "").lower().find("ocr") >= 0,
            input_tokens=int(totals.get("input_tokens") or 0),
            output_tokens=int(totals.get("output_tokens") or 0),
            total_tokens=int(totals.get("total_tokens") or 0),
        )
        _refresh_batch_counts(job["batch_id"], tenant_id)
        if worker_id:
            record_worker_heartbeat(worker_id, status="idle", tenant_id=tenant_id, processed_delta=1)
        return get_parse_job(job_id, tenant_id)
    except Exception as exc:
        _fail_job(job_id, tenant_id, str(exc))
        _refresh_batch_counts(job["batch_id"], tenant_id)
        if worker_id:
            record_worker_heartbeat(worker_id, status="idle", tenant_id=tenant_id, last_error=str(exc), processed_delta=1)
        return get_parse_job(job_id, tenant_id)


def record_worker_heartbeat(
    worker_id: str,
    *,
    status: str,
    tenant_id: str | None = None,
    current_job_id: str | None = None,
    processed_delta: int = 0,
    last_error: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    metadata = metadata or {"host": socket.gethostname()}
    with db() as conn:
        row = conn.execute(
            """
            insert into parse_worker_heartbeats (
              worker_id, tenant_id, status, current_job_id, processed_jobs, last_error, metadata, last_seen_at
            )
            values (%s, %s, %s, %s, %s, %s, %s, now())
            on conflict (worker_id) do update set
              tenant_id=coalesce(excluded.tenant_id, parse_worker_heartbeats.tenant_id),
              status=excluded.status,
              current_job_id=excluded.current_job_id,
              processed_jobs=parse_worker_heartbeats.processed_jobs + excluded.processed_jobs,
              last_error=coalesce(excluded.last_error, parse_worker_heartbeats.last_error),
              metadata=excluded.metadata,
              last_seen_at=now()
            returning worker_id, tenant_id, status, current_job_id, processed_jobs,
                      last_error, metadata, started_at, last_seen_at
            """,
            (worker_id, tenant_id, status, current_job_id, processed_delta, last_error, Jsonb(metadata)),
        ).fetchone()
        conn.commit()
    return _worker_row(row)


def get_worker_status(tenant_id: str | None = None, *, online_seconds: int = 30) -> dict[str, Any]:
    with db() as conn:
        workers = conn.execute(
            """
            select worker_id, tenant_id, status, current_job_id, processed_jobs, last_error,
                   metadata, started_at, last_seen_at,
                   last_seen_at >= now() - (%s * interval '1 second') and status <> 'stopped' as online
            from parse_worker_heartbeats
            where (%s::uuid is null or tenant_id is null or tenant_id=%s)
            order by last_seen_at desc
            limit 10
            """,
            (online_seconds, tenant_id, tenant_id),
        ).fetchall()
        counts = conn.execute(
            """
            select
              count(*) filter (where status in ('queued', 'retrying')) as queued_count,
              count(*) filter (where status in ('running', 'processing')) as running_count,
              count(*) filter (where status='failed') as failed_count
            from parse_jobs
            where (%s::uuid is null or tenant_id=%s)
            """,
            (tenant_id, tenant_id),
        ).fetchone()
        dead_letters = conn.execute(
            """
            select count(*) as dead_letter_count
            from parse_job_dead_letters
            where status='open'
              and (%s::uuid is null or tenant_id=%s)
            """,
            (tenant_id, tenant_id),
        ).fetchone()
    worker_rows = [_worker_row(row) | {"online": bool(row["online"])} for row in workers]
    return {
        "online": any(row["online"] for row in worker_rows),
        "workers": worker_rows,
        "queued_count": int(counts["queued_count"] or 0),
        "running_count": int(counts["running_count"] or 0),
        "failed_count": int(counts["failed_count"] or 0),
        "dead_letter_count": int(dead_letters["dead_letter_count"] or 0),
        "online_window_seconds": online_seconds,
    }


def list_dead_letters(tenant_id: str, *, status: str = "open", limit: int = 50) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 200))
    with db() as conn:
        rows = conn.execute(
            """
            select parse_job_dead_letters.*,
                   parse_jobs.original_filename,
                   parse_jobs.stage as job_stage,
                   parse_jobs.status as job_status,
                   parse_jobs.max_attempts,
                   parse_jobs.updated_at as job_updated_at,
                   parse_batches.name as batch_name
            from parse_job_dead_letters
            join parse_jobs on parse_jobs.id = parse_job_dead_letters.job_id
              and parse_jobs.tenant_id = parse_job_dead_letters.tenant_id
            left join parse_batches on parse_batches.id = parse_job_dead_letters.batch_id
              and parse_batches.tenant_id = parse_job_dead_letters.tenant_id
            where parse_job_dead_letters.tenant_id=%s
              and (%s::text = 'all' or parse_job_dead_letters.status=%s)
            order by parse_job_dead_letters.created_at desc
            limit %s
            """,
            (tenant_id, status, status, limit),
        ).fetchall()
    return [_dead_letter_row(row) for row in rows]


def resolve_dead_letter(dead_letter_id: str, tenant_id: str, user_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            update parse_job_dead_letters
            set status='resolved_acknowledged',
                resolved_by=%s,
                resolved_at=now(),
                updated_at=now()
            where id=%s and tenant_id=%s and status='open'
            returning job_id, batch_id
            """,
            (user_id, dead_letter_id, tenant_id),
        ).fetchone()
        if row:
            conn.execute(
                """
                insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
                values (%s, %s, 'parse.dead_letter_resolved', 'parse_job_dead_letter', %s, %s)
                """,
                (
                    tenant_id,
                    user_id,
                    dead_letter_id,
                    Jsonb({"job_id": str(row["job_id"]), "batch_id": str(row["batch_id"]) if row.get("batch_id") else None}),
                ),
            )
            conn.execute(
                """
                update operational_alerts
                set status='resolved', resolved_at=now()
                where tenant_id=%s
                  and alert_type='parse_dead_letter'
                  and entity_type='parse_job_dead_letter'
                  and entity_id=%s
                  and status='open'
                """,
                (tenant_id, dead_letter_id),
            )
        conn.commit()
    if not row:
        raise FileNotFoundError(dead_letter_id)
    _record_job_event(
        str(row["job_id"]),
        tenant_id,
        "dead_letter_resolved",
        "failed",
        "failed",
        "Dead-letter item was acknowledged by an operator.",
        batch_id=str(row["batch_id"]) if row.get("batch_id") else None,
        metadata={"dead_letter_id": dead_letter_id},
    )
    return _get_dead_letter(dead_letter_id, tenant_id)


def _get_dead_letter(dead_letter_id: str, tenant_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            select parse_job_dead_letters.*,
                   parse_jobs.original_filename,
                   parse_jobs.stage as job_stage,
                   parse_jobs.status as job_status,
                   parse_jobs.max_attempts,
                   parse_jobs.updated_at as job_updated_at,
                   parse_batches.name as batch_name
            from parse_job_dead_letters
            join parse_jobs on parse_jobs.id = parse_job_dead_letters.job_id
              and parse_jobs.tenant_id = parse_job_dead_letters.tenant_id
            left join parse_batches on parse_batches.id = parse_job_dead_letters.batch_id
              and parse_batches.tenant_id = parse_job_dead_letters.tenant_id
            where parse_job_dead_letters.id=%s and parse_job_dead_letters.tenant_id=%s
            """,
            (dead_letter_id, tenant_id),
        ).fetchone()
    if not row:
        raise FileNotFoundError(dead_letter_id)
    return _dead_letter_row(row)


def _set_job_stage(job_id: str, tenant_id: str, status: str, stage: str) -> None:
    with db() as conn:
        row = conn.execute(
            "update parse_jobs set status=%s, stage=%s, updated_at=now() where id=%s and tenant_id=%s returning batch_id",
            (status, stage, job_id, tenant_id),
        ).fetchone()
        conn.commit()
    _record_job_event(
        job_id,
        tenant_id,
        "stage_changed",
        status,
        stage,
        STAGE_PROGRESS.get(stage, (0, stage.replace("_", " ").title()))[1],
        batch_id=str(row["batch_id"]) if row and row.get("batch_id") else None,
    )


def _complete_job(
    job_id: str,
    tenant_id: str,
    *,
    document_id: str,
    ocr_used: bool,
    input_tokens: int,
    output_tokens: int,
    total_tokens: int,
) -> None:
    with db() as conn:
        estimated_cost = llm_usage_cost_for_document(document_id, tenant_id)
        conn.execute(
            """
            update parse_jobs
            set status='succeeded', stage='succeeded', document_id=%s, ocr_used=%s,
                input_tokens=%s, output_tokens=%s, total_tokens=%s,
                estimated_cost=%s,
                completed_at=now(), updated_at=now()
            where id=%s and tenant_id=%s
            """,
            (document_id, ocr_used, input_tokens, output_tokens, total_tokens, estimated_cost, job_id, tenant_id),
        )
        conn.commit()
    _record_job_event(
        job_id,
        tenant_id,
        "succeeded",
        "succeeded",
        "succeeded",
        "Deep parse completed and candidate record was saved.",
        metadata={
            "document_id": document_id,
            "ocr_used": ocr_used,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "estimated_cost": estimated_cost,
        },
    )


def _fail_job(job_id: str, tenant_id: str, error_message: str) -> None:
    with db() as conn:
        row = conn.execute(
            "select attempt_count, max_attempts from parse_jobs where id=%s and tenant_id=%s",
            (job_id, tenant_id),
        ).fetchone()
        retry = row and int(row["attempt_count"]) < int(row["max_attempts"])
        updated = conn.execute(
            """
            update parse_jobs
            set status=%s, stage=%s, error_message=%s, updated_at=now()
            where id=%s and tenant_id=%s
            returning batch_id, attempt_count
            """,
            ("retrying" if retry else "failed", "retrying" if retry else "failed", error_message[:4000], job_id, tenant_id),
        ).fetchone()
        if updated and not retry:
            conn.execute(
                """
                insert into parse_job_dead_letters (tenant_id, batch_id, job_id, error_message, attempt_count, status)
                values (%s, %s, %s, %s, %s, 'open')
                on conflict (job_id) do update set
                  error_message=excluded.error_message,
                  attempt_count=excluded.attempt_count,
                  status='open',
                  resolved_by=null,
                  resolved_at=null,
                  updated_at=now()
                """,
                (tenant_id, updated["batch_id"], job_id, error_message[:4000], int(updated["attempt_count"] or 0)),
            )
        conn.commit()
    _record_job_event(
        job_id,
        tenant_id,
        "retrying" if retry else "failed",
        "retrying" if retry else "failed",
        "retrying" if retry else "failed",
        "Parse failed and was requeued for retry." if retry else "Parse failed and moved to dead-letter review.",
        metadata={"error_message": error_message[:4000]},
    )


def _refresh_batch_counts(batch_id: str | None, tenant_id: str) -> None:
    if not batch_id:
        return
    with db() as conn:
        counts = conn.execute(
            """
            select
              count(*) filter (where status in ('queued', 'retrying')) as queued_count,
              count(*) filter (where status in ('processing', 'running')) as processing_count,
              count(*) filter (where status in ('completed', 'succeeded')) as completed_count,
              count(*) filter (where status='failed') as failed_count,
              count(*) as total_files,
              coalesce(sum(estimated_cost), 0) as estimated_cost
            from parse_jobs where batch_id=%s and tenant_id=%s
            """,
            (batch_id, tenant_id),
        ).fetchone()
        total = int(counts["total_files"] or 0)
        completed = int(counts["completed_count"] or 0)
        failed = int(counts["failed_count"] or 0)
        processing = int(counts["processing_count"] or 0)
        queued = int(counts["queued_count"] or 0)
        cancelled = conn.execute(
            "select count(*) as cancelled_count from parse_jobs where batch_id=%s and tenant_id=%s and status='cancelled'",
            (batch_id, tenant_id),
        ).fetchone()
        cancelled_count = int(cancelled["cancelled_count"] or 0)
        estimated_cost = float(counts["estimated_cost"] or 0)
        if cancelled_count == total and total:
            status = "cancelled"
        elif completed + failed + cancelled_count == total:
            status = "succeeded" if failed == 0 and cancelled_count == 0 else "completed_with_errors"
        elif processing:
            status = "running"
        elif queued:
            status = "queued"
        else:
            status = "created"
        conn.execute(
            """
            update parse_batches
            set total_files=%s, queued_count=%s, processing_count=%s, completed_count=%s,
                failed_count=%s, status=%s, completed_at=case when %s then coalesce(completed_at, now()) else completed_at end,
                estimated_cost=%s,
                updated_at=now()
            where id=%s and tenant_id=%s
            """,
            (total, queued, processing, completed, failed, status, completed + failed + cancelled_count == total, estimated_cost, batch_id, tenant_id),
        )
        conn.commit()


def _batch_row(row: Any) -> dict[str, Any]:
    total = int(row["total_files"] or 0)
    completed = int(row["completed_count"] or 0)
    failed = int(row["failed_count"] or 0)
    terminal = completed + failed
    progress_percent = round((terminal / total) * 100) if total else 0
    return {
        "id": str(row["id"]),
        "tenant_id": str(row["tenant_id"]),
        "campaign_id": str(row["campaign_id"]) if row.get("campaign_id") else None,
        "created_by_user_id": str(row["created_by_user_id"]) if row.get("created_by_user_id") else None,
        "name": row["name"],
        "source_type": row["source_type"],
        "total_files": total,
        "queued_count": int(row["queued_count"] or 0),
        "processing_count": int(row["processing_count"] or 0),
        "completed_count": completed,
        "failed_count": failed,
        "progress_percent": progress_percent,
        "context_note": row.get("context_note"),
        "estimated_cost": float(row.get("estimated_cost") or 0),
        "status": row["status"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        "completed_at": row["completed_at"].isoformat() if row["completed_at"] else None,
    }


def _job_row(row: Any, *, public: bool = True) -> dict[str, Any]:
    status = row["status"]
    stage = row["stage"]
    progress_percent, stage_label = _job_progress(status, stage)
    source_file = row["source_file"]
    if public:
        source_file = row.get("original_filename") or Path(source_file or "Uploaded CV").name
    return {
        "id": str(row["id"]),
        "tenant_id": str(row["tenant_id"]),
        "batch_id": str(row["batch_id"]) if row.get("batch_id") else None,
        "campaign_id": str(row["campaign_id"]) if row.get("campaign_id") else None,
        "created_by_user_id": str(row["created_by_user_id"]) if row.get("created_by_user_id") else None,
        "source_file": source_file,
        "storage_backend": row.get("storage_backend"),
        "storage_key": row.get("storage_key"),
        "source_hash": row["source_hash"],
        "original_filename": row["original_filename"],
        "mime_type": row.get("mime_type"),
        "size_bytes": int(row.get("size_bytes") or 0),
        "warning_message": row.get("warning_message"),
        "document_id": row["document_id"],
        "status": status,
        "stage": stage,
        "stage_label": stage_label,
        "progress_percent": progress_percent,
        "has_initial_note": bool(row.get("initial_note_content")),
        "initial_note_name": row.get("initial_note_name"),
        "attempt_count": int(row["attempt_count"] or 0),
        "max_attempts": int(row["max_attempts"] or 0),
        "error_message": row["error_message"],
        "ocr_used": row["ocr_used"],
        "input_tokens": int(row["input_tokens"] or 0),
        "output_tokens": int(row["output_tokens"] or 0),
        "total_tokens": int(row["total_tokens"] or 0),
        "estimated_cost": float(row["estimated_cost"] or 0),
        "started_at": row["started_at"].isoformat() if row["started_at"] else None,
        "completed_at": row["completed_at"].isoformat() if row["completed_at"] else None,
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


def _attach_campaign_candidate(
    tenant_id: str,
    campaign_id: str,
    candidate_id: str,
    *,
    source: str,
    status: str,
    score: float,
    evidence: dict[str, Any],
) -> None:
    with db() as conn:
        conn.execute(
            """
            insert into campaign_candidates (tenant_id, campaign_id, candidate_id, source, status, score, evidence)
            values (%s, %s, %s, %s, %s, %s, %s)
            on conflict (campaign_id, candidate_id) do update set
              source=excluded.source,
              status=case when campaign_candidates.status = any(%s) then campaign_candidates.status else excluded.status end,
              score=greatest(campaign_candidates.score, excluded.score),
              evidence=excluded.evidence,
              updated_at=now()
            """,
            (tenant_id, campaign_id, candidate_id, source, status, score, Jsonb(evidence), list(TERMINAL_CAMPAIGN_STATUSES)),
        )
        conn.commit()


def _worker_row(row: Any) -> dict[str, Any]:
    return {
        "worker_id": row["worker_id"],
        "tenant_id": str(row["tenant_id"]) if row.get("tenant_id") else None,
        "status": row["status"],
        "current_job_id": str(row["current_job_id"]) if row.get("current_job_id") else None,
        "processed_jobs": int(row["processed_jobs"] or 0),
        "last_error": row.get("last_error"),
        "metadata": row.get("metadata") or {},
        "started_at": row["started_at"].isoformat() if row.get("started_at") else None,
        "last_seen_at": row["last_seen_at"].isoformat() if row.get("last_seen_at") else None,
    }


def _job_event_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "tenant_id": str(row["tenant_id"]),
        "batch_id": str(row["batch_id"]) if row.get("batch_id") else None,
        "job_id": str(row["job_id"]),
        "event_type": row["event_type"],
        "status": row["status"],
        "stage": row["stage"],
        "message": row.get("message"),
        "metadata": row.get("metadata") or {},
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }


def _dead_letter_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "tenant_id": str(row["tenant_id"]),
        "batch_id": str(row["batch_id"]) if row.get("batch_id") else None,
        "batch_name": row.get("batch_name"),
        "job_id": str(row["job_id"]),
        "original_filename": row.get("original_filename"),
        "job_status": row.get("job_status"),
        "job_stage": row.get("job_stage"),
        "error_message": row["error_message"],
        "attempt_count": int(row["attempt_count"] or 0),
        "max_attempts": int(row.get("max_attempts") or 0),
        "status": row["status"],
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
        "job_updated_at": row["job_updated_at"].isoformat() if row.get("job_updated_at") else None,
        "resolved_at": row["resolved_at"].isoformat() if row.get("resolved_at") else None,
    }


def _record_job_event(
    job_id: str,
    tenant_id: str,
    event_type: str,
    status: str,
    stage: str,
    message: str | None = None,
    *,
    batch_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    with db() as conn:
        resolved_batch_id = batch_id
        if not resolved_batch_id:
            row = conn.execute(
                "select batch_id from parse_jobs where id=%s and tenant_id=%s",
                (job_id, tenant_id),
            ).fetchone()
            resolved_batch_id = str(row["batch_id"]) if row and row.get("batch_id") else None
        conn.execute(
            """
            insert into parse_job_events (tenant_id, batch_id, job_id, event_type, status, stage, message, metadata)
            values (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (tenant_id, resolved_batch_id, job_id, event_type, status, stage, message, Jsonb(metadata or {})),
        )
        conn.commit()


def _job_progress(status: str, stage: str) -> tuple[int, str]:
    if status in {"failed", "cancelled", "succeeded", "completed", "retrying"}:
        return STAGE_PROGRESS.get(status, (0, status.replace("_", " ").title()))
    return STAGE_PROGRESS.get(stage, STAGE_PROGRESS.get(status, (0, stage.replace("_", " ").title())))


def _job_source_path(job: dict[str, Any]) -> Path:
    backend = job.get("storage_backend")
    key = job.get("storage_key")
    if backend and key:
        return document_storage(backend).open_for_processing(key)
    return Path(job["source_file"])


def _candidate_reparse_source(document_id: str, tenant_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            select storage_backend, storage_key, original_filename, mime_type, size_bytes, sha256
            from candidate_documents
            where document_id=%s and tenant_id=%s
            order by created_at desc
            limit 1
            """,
            (document_id, tenant_id),
        ).fetchone()
        if not row:
            row = conn.execute(
                """
                select storage_backend, storage_key, original_filename, mime_type, size_bytes, source_sha256 as sha256, source_file
                from candidates
                where document_id=%s and tenant_id=%s
                """,
                (document_id, tenant_id),
            ).fetchone()
    if not row:
        raise FileNotFoundError(document_id)
    storage_backend = row.get("storage_backend") or "local"
    storage_key = row.get("storage_key")
    if not storage_key:
        raise FileNotFoundError(f"candidate {document_id} has no stored source document")
    return {
        "storage_backend": storage_backend,
        "storage_key": storage_key,
        "original_filename": row.get("original_filename") or Path(row.get("source_file") or "resume.pdf").name,
        "mime_type": row.get("mime_type"),
        "size_bytes": int(row.get("size_bytes") or 0),
        "sha256": row.get("sha256"),
    }


def _duplicate_upload_warning(tenant_id: str, sha256: str) -> str | None:
    with db() as conn:
        candidate_rows = conn.execute(
            """
            select document_id, original_filename
            from candidates
            where tenant_id=%s and source_sha256=%s
            order by updated_at desc
            limit 3
            """,
            (tenant_id, sha256),
        ).fetchall()
        job_rows = conn.execute(
            """
            select original_filename
            from parse_jobs
            where tenant_id=%s and source_hash=%s and status not in ('cancelled', 'failed')
            order by created_at desc
            limit 3
            """,
            (tenant_id, sha256),
        ).fetchall()
    names = [row.get("original_filename") or row.get("document_id") for row in [*candidate_rows, *job_rows]]
    names = [str(name) for name in names if name]
    if not names:
        return None
    return f"Possible duplicate file hash already exists: {', '.join(names)}"
