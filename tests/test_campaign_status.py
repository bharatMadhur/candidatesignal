from __future__ import annotations

import sys
import unittest
from pathlib import Path
from typing import Any


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel import campaigns
from resume_intel.campaigns import _campaign_match_evidence_payload


class _Result:
    def __init__(self, row: dict[str, Any] | None = None) -> None:
        self.row = row

    def fetchone(self) -> dict[str, Any] | None:
        return self.row


class _FakeConnection:
    def __init__(self, campaign_candidate_row: dict[str, Any] | None) -> None:
        self.campaign_candidate_row = campaign_candidate_row
        self.executed: list[tuple[str, tuple[Any, ...]]] = []
        self.committed = False

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> _Result:
        self.executed.append((sql, params))
        if "insert into campaign_candidates" in sql:
            return _Result(self.campaign_candidate_row)
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


class CampaignCandidateStatusTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_db = campaigns.db

    def tearDown(self) -> None:
        campaigns.db = self.original_db

    def test_status_change_upserts_candidate_into_tenant_campaign(self) -> None:
        row = {
            "id": "link-1",
            "tenant_id": "tenant-1",
            "campaign_id": "campaign-1",
            "candidate_id": "candidate-1",
            "source": "copilot",
            "status": "shortlisted",
            "score": 0,
            "evidence": {"manual_action": "copilot_shortlist"},
            "created_at": None,
            "updated_at": None,
        }
        connection = _FakeConnection(row)
        campaigns.db = lambda: _FakeDb(connection)

        result = campaigns.set_campaign_candidate_status("campaign-1", "candidate-1", "shortlisted", "tenant-1", "user-1")

        self.assertEqual(result["status"], "shortlisted")
        self.assertEqual(result["source"], "copilot")
        upsert_sql, upsert_params = connection.executed[0]
        self.assertIn("insert into campaign_candidates", upsert_sql)
        self.assertIn("join candidates", upsert_sql)
        self.assertIn("job_campaigns.tenant_id=%s", upsert_sql)
        self.assertIn("on conflict (campaign_id, candidate_id) do update", upsert_sql)
        self.assertEqual(upsert_params[0], "tenant-1")
        self.assertEqual(upsert_params[3], "candidate-1")
        self.assertEqual(upsert_params[4], "campaign-1")
        self.assertEqual(upsert_params[5], "tenant-1")
        self.assertTrue(connection.committed)

    def test_status_change_raises_when_candidate_or_campaign_is_outside_tenant(self) -> None:
        connection = _FakeConnection(None)
        campaigns.db = lambda: _FakeDb(connection)

        with self.assertRaises(FileNotFoundError):
            campaigns.set_campaign_candidate_status("campaign-1", "candidate-1", "shortlisted", "tenant-1", "user-1")

    def test_campaign_match_payload_keeps_explainable_breakdown(self) -> None:
        payload = _campaign_match_evidence_payload(
            {
                "total_score": 0.82,
                "must_have_score": 1,
                "nice_to_have_score": 0.5,
                "years_score": 0.9,
                "domain_score": 1,
                "location_score": 0.6,
                "recommendation": "Strong fit",
                "evidence": {
                    "must_have_hits": ["Python", "Spark"],
                    "nice_to_have_hits": ["Databricks"],
                    "domain_hits": ["data_engineering"],
                    "location_hits": ["New York"],
                    "candidate_years": 6,
                    "hard_filter_failures": [],
                },
                "gaps": {"missing_nice_to_haves": ["Airflow"], "years_gap": 0},
            }
        )

        self.assertEqual(payload["score_breakdown"]["total"], 0.82)
        self.assertTrue(payload["hard_filter_pass"])
        self.assertIn("Must-have matched: Python", payload["top_reasons"])
        self.assertIn("Missing nice-to-have: Airflow", payload["top_gaps"])


if __name__ == "__main__":
    unittest.main()
