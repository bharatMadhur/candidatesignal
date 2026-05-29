from __future__ import annotations

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel import db_store


class _Result:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def fetchall(self) -> list[dict[str, Any]]:
        return self.rows


class _CandidateListConnection:
    def __init__(self) -> None:
        self.sql: list[str] = []

    def execute(self, sql: str, _params: tuple[Any, ...] = ()) -> _Result:
        normalized = " ".join(sql.lower().split())
        self.sql.append(normalized)
        if "from candidates" in normalized and "left join candidate_profile_summaries" in normalized:
            return _Result(
                [
                    {
                        "document_id": "doc-1",
                        "name": "Pranjal Paliwal",
                        "email": "p@example.com",
                        "phone": "555",
                        "source_file": "/tmp/resume.pdf",
                        "original_filename": "Pranjal.pdf",
                        "fact_verification": {"status": "verified", "current_role_status": "verified", "current_role_flags": []},
                        "note_signal_summary": {"signals": [{"key": "visa", "value": "OPT"}]},
                        "profile_freshness": {"status": "fresh"},
                        "current_title": "Founding Engineer",
                        "current_company": "Orbit Systems",
                        "current_location": "Pittsburgh, PA",
                        "total_years_experience": 6,
                        "seniority": "mid-level",
                        "domains": ["AI / GenAI", "Data Engineering"],
                        "countries": ["United States", "India"],
                        "completeness_score": 94,
                        "created_at": datetime(2026, 5, 1, tzinfo=timezone.utc),
                        "updated_at": datetime(2026, 5, 2, tzinfo=timezone.utc),
                    }
                ]
            )
        return _Result([])


class _FakeDb:
    def __init__(self, connection: _CandidateListConnection) -> None:
        self.connection = connection

    def __enter__(self) -> _CandidateListConnection:
        return self.connection

    def __exit__(self, *args: object) -> None:
        return None


class CandidateSummaryReadModelTests(unittest.TestCase):
    def test_candidate_list_uses_summary_table_not_full_json_payloads(self) -> None:
        connection = _CandidateListConnection()

        with patch.object(db_store, "db", lambda: _FakeDb(connection)), patch.object(db_store, "hidden_version_document_ids", return_value=set()):
            candidates = db_store.list_candidates_db("tenant-1")

        first_query = connection.sql[0]
        self.assertIn("left join candidate_profile_summaries", first_query)
        self.assertNotIn("select document_id, name, email, phone, source_file, record_json", first_query)
        self.assertEqual(candidates[0]["name"], "Pranjal Paliwal")
        self.assertEqual(candidates[0]["current_title"], "Founding Engineer")
        self.assertEqual(candidates[0]["top_domains"], ["AI / GenAI", "Data Engineering"])
        self.assertEqual(candidates[0]["coverage"], 94.0)
        self.assertEqual(candidates[0]["location"], "Pittsburgh, PA")


if __name__ == "__main__":
    unittest.main()
