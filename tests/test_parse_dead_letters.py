from __future__ import annotations

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel import parse_jobs
from resume_intel.parse_jobs import _dead_letter_row, resolve_dead_letter


class _Result:
    def __init__(self, row=None) -> None:
        self.row = row

    def fetchone(self):
        return self.row


class _FakeConnection:
    def __init__(self) -> None:
        self.executed = []
        self.committed = False

    def execute(self, sql: str, params=()) -> _Result:
        self.executed.append((sql, params))
        if "update parse_job_dead_letters" in sql:
            return _Result({"job_id": "job-1", "batch_id": "batch-1"})
        return _Result()

    def commit(self) -> None:
        self.committed = True


class _FakeDb:
    def __init__(self, connection: _FakeConnection) -> None:
        self.connection = connection

    def __enter__(self) -> _FakeConnection:
        return self.connection

    def __exit__(self, *args: object) -> None:
        return None


class ParseDeadLetterTests(unittest.TestCase):
    def test_dead_letter_row_serializes_operator_payload(self) -> None:
        tenant_id = uuid4()
        batch_id = uuid4()
        job_id = uuid4()
        dead_letter_id = uuid4()
        created_at = datetime(2026, 5, 12, 0, 0, tzinfo=timezone.utc)

        payload = _dead_letter_row(
            {
                "id": dead_letter_id,
                "tenant_id": tenant_id,
                "batch_id": batch_id,
                "batch_name": "Initial import",
                "job_id": job_id,
                "original_filename": "resume.pdf",
                "job_status": "failed",
                "job_stage": "failed",
                "error_message": "OCR failed",
                "attempt_count": 2,
                "max_attempts": 2,
                "status": "open",
                "created_at": created_at,
                "updated_at": created_at,
                "job_updated_at": created_at,
                "resolved_at": None,
            }
        )

        self.assertEqual(payload["id"], str(dead_letter_id))
        self.assertEqual(payload["tenant_id"], str(tenant_id))
        self.assertEqual(payload["batch_id"], str(batch_id))
        self.assertEqual(payload["job_id"], str(job_id))
        self.assertEqual(payload["original_filename"], "resume.pdf")
        self.assertEqual(payload["error_message"], "OCR failed")
        self.assertEqual(payload["attempt_count"], 2)
        self.assertEqual(payload["created_at"], "2026-05-12T00:00:00+00:00")

    def test_resolving_dead_letter_resolves_matching_operational_alert(self) -> None:
        connection = _FakeConnection()
        with (
            patch.object(parse_jobs, "db", lambda: _FakeDb(connection)),
            patch.object(parse_jobs, "_record_job_event"),
            patch.object(parse_jobs, "_get_dead_letter", return_value={"id": "dead-1", "status": "resolved_acknowledged"}),
        ):
            result = resolve_dead_letter("dead-1", "tenant-1", "user-1")

        self.assertEqual(result["status"], "resolved_acknowledged")
        alert_update = [sql for sql, _ in connection.executed if "update operational_alerts" in sql]
        self.assertTrue(alert_update)
        self.assertIn("alert_type='parse_dead_letter'", alert_update[0])
        self.assertTrue(connection.committed)


if __name__ == "__main__":
    unittest.main()
