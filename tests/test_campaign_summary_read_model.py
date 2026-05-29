from __future__ import annotations

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel import campaigns


class _Result:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def fetchall(self) -> list[dict[str, Any]]:
        return self.rows


class _CampaignListConnection:
    def __init__(self) -> None:
        self.sql: list[str] = []

    def execute(self, sql: str, _params: tuple[Any, ...] = ()) -> _Result:
        normalized = " ".join(sql.lower().split())
        self.sql.append(normalized)
        return _Result([
            {
                "id": "campaign-1",
                "tenant_id": "tenant-1",
                "created_by_user_id": "user-1",
                "requirement_id": None,
                "requirement_title": None,
                "requirement_status": None,
                "requirement_original_text": None,
                "requirement_extracted_json": {},
                "requirement_recruiter_answers": {},
                "requirement_final_profile": None,
                "name": "Data Engineer",
                "description": "",
                "status": "active",
                "candidate_count": 12,
                "strong_match_count": 3,
                "review_worthy_count": 4,
                "weak_match_count": 5,
                "below_threshold_count": 0,
                "shortlisted_count": 2,
                "active_pipeline_count": 2,
                "rejected_count": 1,
                "archived_count": 0,
                "upload_batch_count": 1,
                "failed_upload_count": 0,
                "latest_match_job_id": "job-1",
                "latest_match_job_status": "succeeded",
                "latest_match_job_stage": "succeeded",
                "latest_match_job_updated_at": datetime(2026, 5, 29, tzinfo=timezone.utc),
                "created_at": datetime(2026, 5, 28, tzinfo=timezone.utc),
                "updated_at": datetime(2026, 5, 29, tzinfo=timezone.utc),
                "deleted_at": None,
            }
        ])


class _FakeDb:
    def __init__(self, connection: _CampaignListConnection) -> None:
        self.connection = connection

    def __enter__(self) -> _CampaignListConnection:
        return self.connection

    def __exit__(self, *args: object) -> None:
        return None


class CampaignSummaryReadModelTests(unittest.TestCase):
    def test_campaign_list_uses_pipeline_summary_not_live_count_aggregates(self) -> None:
        connection = _CampaignListConnection()

        with patch.object(campaigns, "db", lambda: _FakeDb(connection)):
            rows = campaigns.list_campaigns("tenant-1")

        query = connection.sql[0]
        self.assertIn("left join campaign_pipeline_summaries", query)
        self.assertNotIn("count(distinct campaign_candidates.id)", query)
        self.assertEqual(rows[0]["candidate_count"], 12)
        self.assertEqual(rows[0]["pipeline_summary"]["strong_match_count"], 3)
        self.assertEqual(rows[0]["pipeline_summary"]["latest_match_job_status"], "succeeded")


if __name__ == "__main__":
    unittest.main()
