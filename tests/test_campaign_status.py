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
        self.original_get_campaign = campaigns.get_campaign
        self.original_match_requirement = campaigns.match_requirement

    def tearDown(self) -> None:
        campaigns.db = self.original_db
        campaigns.get_campaign = self.original_get_campaign
        campaigns.match_requirement = self.original_match_requirement

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

    def test_incremental_campaign_match_scores_only_new_candidates_without_full_delete(self) -> None:
        connection = _FakeConnection(None)
        campaigns.db = lambda: _FakeDb(connection)
        campaigns.get_campaign = lambda campaign_id, tenant_id: {
            "id": campaign_id,
            "requirement_id": "requirement-1",
            "candidates": [
                {"candidate_id": "existing-1", "status": "shortlisted"},
                {"candidate_id": "new-1", "status": "uploaded"},
            ],
        }
        captured: dict[str, Any] = {}

        def fake_match_requirement(*args: Any, **kwargs: Any) -> list[dict[str, Any]]:
            captured["args"] = args
            captured["kwargs"] = kwargs
            return [
                {
                    "candidate_id": "new-1",
                    "candidate": {"name": "New Candidate"},
                    "total_score": 0.74,
                    "must_have_score": 0.8,
                    "nice_to_have_score": 0.6,
                    "years_score": 1,
                    "domain_score": 0.7,
                    "location_score": 0.4,
                    "evidence": {"must_have_hits": ["Python"], "hard_filter_failures": []},
                    "gaps": {"missing_preferred_locations": ["New York"]},
                    "recommendation": "Review-worthy fit",
                }
            ]

        campaigns.match_requirement = fake_match_requirement

        result = campaigns.run_campaign_match(
            "campaign-1",
            "tenant-1",
            "user-1",
            mode="incremental",
            candidate_ids=["new-1", "new-1", "new-2"],
            batch_id="batch-1",
        )

        self.assertEqual(result["match_mode"], "incremental")
        self.assertEqual(captured["args"][:2], ("requirement-1", "tenant-1"))
        self.assertTrue(captured["kwargs"]["candidate_ids_only"])
        self.assertEqual(captured["kwargs"]["extra_candidate_ids"], ["new-1", "new-2"])
        self.assertFalse(
            any(
                "delete from campaign_candidates" in sql
                and "source='matched'" in sql
                and "status='recommended'" in sql
                for sql, _params in connection.executed
            )
        )
        self.assertTrue(any("insert into campaign_candidates" in sql for sql, _params in connection.executed))
        below_threshold_updates = [
            params
            for sql, params in connection.executed
            if "update campaign_candidates" in sql and "candidate_id = any" in sql
        ]
        self.assertEqual(len(below_threshold_updates), 1)
        self.assertEqual(below_threshold_updates[0][4], ["new-2"])

    def test_empty_incremental_campaign_match_returns_without_database_writes(self) -> None:
        connection = _FakeConnection(None)
        campaigns.db = lambda: _FakeDb(connection)
        campaigns.get_campaign = lambda campaign_id, tenant_id: {
            "id": campaign_id,
            "requirement_id": "requirement-1",
            "candidates": [],
        }

        result = campaigns.run_campaign_match("campaign-1", "tenant-1", "user-1", mode="incremental", candidate_ids=[])

        self.assertEqual(result["matches"], [])
        self.assertEqual(result["match_mode"], "incremental")
        self.assertEqual(connection.executed, [])


if __name__ == "__main__":
    unittest.main()
