from __future__ import annotations

import sys
import unittest
from pathlib import Path
from typing import Any
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel import db_hardening
from resume_intel.db_hardening import RetentionRunOptions, run_retention_policies, validate_hardening_constraints


class _Result:
    def __init__(self, rows: list[dict[str, Any]] | None = None, row: dict[str, Any] | None = None, rowcount: int = 0) -> None:
        self.rows = rows or []
        self.row = row
        self.rowcount = rowcount

    def fetchall(self) -> list[dict[str, Any]]:
        return self.rows

    def fetchone(self) -> dict[str, Any] | None:
        return self.row


class _RetentionConnection:
    def __init__(self) -> None:
        self.sql: list[str] = []
        self.executemany_calls: list[tuple[str, list[tuple[Any, ...]]]] = []
        self.committed = False

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> _Result:
        normalized = " ".join(sql.lower().split())
        self.sql.append(normalized)
        if "from data_retention_policies" in normalized:
            return _Result(rows=[
                {"table_name": "audit_logs", "retention_days": 365, "strategy": "archive_then_delete", "enabled": False},
                {"table_name": "candidate_search_chunks", "retention_days": 0, "strategy": "rebuildable_index", "enabled": False},
            ])
        if "insert into data_retention_runs" in normalized:
            return _Result(row={"id": "run-1", "cutoff_at": "2025-01-01T00:00:00Z"})
        if "to_jsonb(audit_logs.*)" in normalized:
            return _Result(rows=[
                {"__row_ctid": "(0,1)", "__row_json": {"id": "audit-1"}, "tenant_id": "tenant-1", "created_at": "2024-01-01T00:00:00Z"}
            ])
        if "delete from audit_logs" in normalized:
            return _Result(rowcount=1)
        return _Result()

    def executemany(self, sql: str, params: list[tuple[Any, ...]]) -> None:
        self.executemany_calls.append((" ".join(sql.lower().split()), params))

    def commit(self) -> None:
        self.committed = True


class _ConstraintConnection:
    def __init__(self) -> None:
        self.sql: list[str] = []
        self.committed = False

    def execute(self, sql: str, _params: tuple[Any, ...] = ()) -> _Result:
        normalized = " ".join(sql.lower().split())
        self.sql.append(normalized)
        if "from pg_constraint" in normalized:
            return _Result(rows=[
                {"conname": "notes_tenant_id_required", "table_name": "notes", "contype": "c", "convalidated": False}
            ])
        return _Result()

    def commit(self) -> None:
        self.committed = True


class _FakeDb:
    def __init__(self, connection: Any) -> None:
        self.connection = connection

    def __enter__(self) -> Any:
        return self.connection

    def __exit__(self, *args: object) -> None:
        return None


class DbRetentionTests(unittest.TestCase):
    def test_retention_dry_run_selects_rows_without_archiving_or_deleting(self) -> None:
        connection = _RetentionConnection()

        with patch.object(db_hardening, "db", lambda **_kwargs: _FakeDb(connection)):
            report = run_retention_policies(RetentionRunOptions(dry_run=True, table_name="audit_logs", limit=10))

        self.assertEqual(report["runs"][0]["rows_selected"], 1)
        self.assertEqual(report["runs"][0]["rows_deleted"], 0)
        self.assertEqual(connection.executemany_calls, [])
        self.assertFalse(any("delete from audit_logs" in sql for sql in connection.sql))

    def test_retention_apply_requires_enabled_policy(self) -> None:
        connection = _RetentionConnection()

        with patch.object(db_hardening, "db", lambda **_kwargs: _FakeDb(connection)):
            report = run_retention_policies(RetentionRunOptions(dry_run=False, table_name="audit_logs", limit=10))

        self.assertEqual(report["runs"], [])
        self.assertEqual(report["skipped"][0]["reason"], "policy_disabled")

    def test_constraint_validation_dry_run_reports_unvalidated_constraints(self) -> None:
        connection = _ConstraintConnection()

        with patch.object(db_hardening, "db", lambda **_kwargs: _FakeDb(connection)):
            report = validate_hardening_constraints(dry_run=True)

        self.assertEqual(report["remaining_invalid"][0]["constraint"], "notes_tenant_id_required")
        self.assertFalse(any("validate constraint" in sql for sql in connection.sql))


if __name__ == "__main__":
    unittest.main()
