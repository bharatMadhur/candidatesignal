from __future__ import annotations

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.parse_jobs import _job_event_row


class ParseJobEventTests(unittest.TestCase):
    def test_job_event_row_serializes_public_timeline_payload(self) -> None:
        tenant_id = uuid4()
        batch_id = uuid4()
        job_id = uuid4()
        event_id = uuid4()
        created_at = datetime(2026, 5, 11, 12, 0, tzinfo=timezone.utc)

        payload = _job_event_row(
            {
                "id": event_id,
                "tenant_id": tenant_id,
                "batch_id": batch_id,
                "job_id": job_id,
                "event_type": "stage_changed",
                "status": "running",
                "stage": "embedding",
                "message": "Indexing semantic search",
                "metadata": {"worker_id": "worker-a"},
                "created_at": created_at,
            }
        )

        self.assertEqual(payload["id"], str(event_id))
        self.assertEqual(payload["tenant_id"], str(tenant_id))
        self.assertEqual(payload["batch_id"], str(batch_id))
        self.assertEqual(payload["job_id"], str(job_id))
        self.assertEqual(payload["metadata"], {"worker_id": "worker-a"})
        self.assertEqual(payload["created_at"], "2026-05-11T12:00:00+00:00")


if __name__ == "__main__":
    unittest.main()
