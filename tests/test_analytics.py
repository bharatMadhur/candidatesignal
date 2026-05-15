from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.analytics import tenant_workspace_analytics


class _Result:
    def __init__(self, rows: list[dict]):
        self.rows = rows

    def fetchone(self):
        return self.rows[0] if self.rows else None

    def fetchall(self):
        return self.rows


class _AnalyticsConnection:
    def __init__(self):
        self.calls: list[tuple[str, tuple]] = []

    def execute(self, sql: str, params: tuple = ()):
        self.calls.append((sql, params))
        if "count(*) as count from candidates" in sql:
            return _Result([{"count": 3}])
        if "from candidate_skills" in sql:
            return _Result([{"label": "Databricks", "category": "Data", "candidate_count": 2}])
        if "from candidate_domain_years" in sql:
            return _Result([{"label": "data_engineering", "candidate_count": 2, "average_years": 4.5, "max_years": 6.0}])
        if "from candidate_experience" in sql:
            return _Result([{"label": "Cerner Healthcare", "candidate_count": 1}])
        if "from candidate_locations" in sql and "group by location" in sql:
            return _Result([{"label": "New York", "country": "United States", "signal_type": "current", "candidate_count": 1}])
        if "from candidate_locations" in sql and "group by country" in sql:
            return _Result([{"label": "United States", "candidate_count": 3}])
        if "from candidate_education" in sql:
            return _Result([{"label": "Ohio State University", "candidate_count": 1}])
        if "select record_json from candidates" in sql:
            return _Result(
                [
                    {"record_json": {"derived": {"hr_profile": {"total_years_experience": 2.5}}}},
                    {"record_json": {"derived": {"hr_profile": {"total_years_experience": 6.1}}}},
                    {"record_json": {"derived": {"hr_profile": {"total_years_experience": None}}}},
                ]
            )
        return _Result([])


class _AnalyticsDb:
    def __init__(self, connection: _AnalyticsConnection):
        self.connection = connection

    def __enter__(self):
        return self.connection

    def __exit__(self, *args: object) -> None:
        return None


class AnalyticsTests(unittest.TestCase):
    def test_workspace_analytics_uses_tenant_scoped_normalized_tables(self) -> None:
        connection = _AnalyticsConnection()

        with patch("resume_intel.analytics.db", return_value=_AnalyticsDb(connection)):
            result = tenant_workspace_analytics("tenant-1", limit=20)

        self.assertEqual(result["candidate_count"], 3)
        self.assertEqual(result["top_skills"][0]["label"], "Databricks")
        self.assertEqual(result["top_domains"][0]["average_years"], 4.5)
        self.assertEqual(result["top_locations"][0]["country"], "United States")
        self.assertEqual(result["experience_distribution"][0], {"label": "0-2 years", "candidate_count": 1})
        self.assertEqual(result["experience_distribution"][2], {"label": "6-9 years", "candidate_count": 1})
        self.assertEqual(result["experience_distribution"][4], {"label": "Unknown", "candidate_count": 1})
        self.assertTrue(connection.calls)
        for _sql, params in connection.calls:
            self.assertEqual(params[0], "tenant-1")


if __name__ == "__main__":
    unittest.main()
