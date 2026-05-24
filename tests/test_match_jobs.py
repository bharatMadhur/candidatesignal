from __future__ import annotations

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.match_jobs import match_job_row


class CampaignMatchJobTests(unittest.TestCase):
    def test_match_job_row_is_public_status_payload(self) -> None:
        job_id = uuid4()
        tenant_id = uuid4()
        campaign_id = uuid4()
        requirement_id = uuid4()
        user_id = uuid4()
        created_at = datetime(2026, 5, 24, 12, 30, tzinfo=timezone.utc)

        payload = match_job_row({
            "id": job_id,
            "tenant_id": tenant_id,
            "campaign_id": campaign_id,
            "requirement_id": requirement_id,
            "created_by_user_id": user_id,
            "mode": "full",
            "candidate_ids": ["candidate-1"],
            "status": "queued",
            "stage": "queued",
            "attempt_count": 0,
            "max_attempts": 2,
            "result": {},
            "error_message": None,
            "started_at": None,
            "completed_at": None,
            "created_at": created_at,
            "updated_at": created_at,
        })

        self.assertEqual(payload["id"], str(job_id))
        self.assertEqual(payload["tenant_id"], str(tenant_id))
        self.assertEqual(payload["campaign_id"], str(campaign_id))
        self.assertEqual(payload["candidate_ids"], ["candidate-1"])
        self.assertEqual(payload["status"], "queued")
        self.assertEqual(payload["created_at"], "2026-05-24T12:30:00+00:00")


if __name__ == "__main__":
    unittest.main()
