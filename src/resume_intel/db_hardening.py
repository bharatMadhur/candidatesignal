from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from psycopg.types.json import Jsonb

from .db import db


RETENTION_TABLES: dict[str, str] = {
    "audit_logs": "created_at",
    "parse_job_events": "created_at",
    "llm_usage_events": "created_at",
    "requirement_matches": "created_at",
    "requirement_match_runs": "created_at",
    "campaign_match_jobs": "created_at",
    "copilot_messages": "created_at",
}


@dataclass(frozen=True)
class RetentionRunOptions:
    dry_run: bool = True
    table_name: str | None = None
    limit: int = 5000


def list_invalid_hardening_constraints() -> list[dict[str, Any]]:
    with db(internal=True) as conn:
        rows = conn.execute(
            """
            select conname, conrelid::regclass::text as table_name, contype, convalidated
            from pg_constraint
            where conname like '%tenant%required'
               or conname like '%tenant_candidate_fk'
            order by conrelid::regclass::text, conname
            """
        ).fetchall()
    return [
        {
            "constraint": row["conname"],
            "table_name": row["table_name"],
            "type": row["contype"],
            "validated": bool(row["convalidated"]),
        }
        for row in rows
        if not row["convalidated"]
    ]


def validate_hardening_constraints(*, dry_run: bool = True) -> dict[str, Any]:
    invalid = list_invalid_hardening_constraints()
    if dry_run:
        return {"dry_run": True, "validated": [], "remaining_invalid": invalid}
    validated: list[str] = []
    with db(internal=True) as conn:
        for item in invalid:
            table_name = _safe_identifier(item["table_name"])
            constraint = _safe_identifier(item["constraint"])
            conn.execute(f"alter table {table_name} validate constraint {constraint}")
            validated.append(item["constraint"])
        conn.commit()
    return {"dry_run": False, "validated": validated, "remaining_invalid": list_invalid_hardening_constraints()}


def run_retention_policies(options: RetentionRunOptions | None = None) -> dict[str, Any]:
    options = options or RetentionRunOptions()
    if options.limit < 1 or options.limit > 100_000:
        raise ValueError("retention limit must be between 1 and 100000")
    with db(internal=True) as conn:
        policies = conn.execute(
            """
            select table_name, retention_days, strategy, enabled
            from data_retention_policies
            where (%s::text is null or table_name=%s)
            order by table_name
            """,
            (options.table_name, options.table_name),
        ).fetchall()
    runs = [_run_retention_policy(policy, options) for policy in policies if _policy_should_run(policy, options)]
    skipped = [
        {
            "table_name": policy["table_name"],
            "reason": _skip_reason(policy, options),
        }
        for policy in policies
        if not _policy_should_run(policy, options)
    ]
    return {"dry_run": options.dry_run, "runs": runs, "skipped": skipped}


def _run_retention_policy(policy: dict[str, Any], options: RetentionRunOptions) -> dict[str, Any]:
    table_name = str(policy["table_name"])
    created_column = RETENTION_TABLES[table_name]
    retention_days = int(policy["retention_days"])
    with db(internal=True) as conn:
        run_row = conn.execute(
            """
            insert into data_retention_runs (table_name, cutoff_at, dry_run, status)
            values (%s, now() - (%s * interval '1 day'), %s, 'running')
            returning id, cutoff_at
            """,
            (table_name, retention_days, options.dry_run),
        ).fetchone()
        selected_rows = conn.execute(
            f"""
            select *,
                   ctid::text as __row_ctid,
                   to_jsonb({table_name}.*) as __row_json
            from {_safe_identifier(table_name)}
            where {created_column} < %s
            order by {created_column}
            limit %s
            """,
            (run_row["cutoff_at"], options.limit),
        ).fetchall()
        selected_count = len(selected_rows)
        archived_count = 0
        deleted_count = 0
        if not options.dry_run and selected_rows:
            archive_rows = [
                (
                    table_name,
                    row.get("tenant_id"),
                    Jsonb(row["__row_json"]),
                    row.get(created_column),
                    run_row["id"],
                )
                for row in selected_rows
            ]
            conn.executemany(
                """
                insert into data_retention_archives (
                  table_name, tenant_id, source_row, source_created_at, retention_run_id
                )
                values (%s, %s, %s, %s, %s)
                """,
                archive_rows,
            )
            archived_count = len(archive_rows)
            ctids = [row["__row_ctid"] for row in selected_rows]
            deleted = conn.execute(
                f"""
                delete from {_safe_identifier(table_name)}
                where ctid::text = any(%s::text[])
                """,
                (ctids,),
            )
            deleted_count = int(deleted.rowcount or 0)
        conn.execute(
            """
            update data_retention_runs
            set rows_selected=%s,
                rows_archived=%s,
                rows_deleted=%s,
                status='succeeded',
                completed_at=now()
            where id=%s
            """,
            (selected_count, archived_count, deleted_count, run_row["id"]),
        )
        conn.commit()
    return {
        "id": str(run_row["id"]),
        "table_name": table_name,
        "cutoff_at": _iso(run_row["cutoff_at"]),
        "rows_selected": selected_count,
        "rows_archived": archived_count,
        "rows_deleted": deleted_count,
        "status": "succeeded",
    }


def _policy_should_run(policy: dict[str, Any], options: RetentionRunOptions) -> bool:
    table_name = str(policy["table_name"])
    if table_name not in RETENTION_TABLES:
        return False
    if int(policy["retention_days"]) <= 0:
        return False
    return options.dry_run or bool(policy["enabled"])


def _skip_reason(policy: dict[str, Any], options: RetentionRunOptions) -> str:
    table_name = str(policy["table_name"])
    if table_name not in RETENTION_TABLES:
        return "unsupported_table"
    if int(policy["retention_days"]) <= 0:
        return "no_time_based_retention"
    if not options.dry_run and not bool(policy["enabled"]):
        return "policy_disabled"
    return "not_selected"


def _safe_identifier(value: str) -> str:
    if not value.replace("_", "").isalnum():
        raise ValueError(f"unsafe identifier: {value}")
    return value


def _iso(value: Any) -> str | None:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    return None
