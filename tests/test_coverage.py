from __future__ import annotations

import unittest
from pathlib import Path

import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.coverage import primary_key_coverage


class CoverageTests(unittest.TestCase):
    def test_coverage_returns_categories_and_severity(self) -> None:
        coverage = primary_key_coverage(
            {
                "name": "Candidate One",
                "contact": {"email": "candidate@example.com"},
                "skills": ["Python"],
                "experience": [{"company": "Acme", "title": "Engineer", "start_date": "2020-01", "end_date": "2022-01"}],
                "derived": {
                    "hr_profile": {
                        "current_title": "Engineer",
                        "current_company": "Acme",
                        "total_years_experience": 2.0,
                    },
                    "experience_by_domain": {"data_engineering": {"years": 2.0}},
                    "countries_associated": ["United States"],
                },
            }
        )

        self.assertIn("categories", coverage)
        self.assertIn("contact.phone", coverage["critical_missing_keys"])
        self.assertIn("education.history", coverage["enrichment_missing_keys"])
        identity = next(item for item in coverage["categories"] if item["key"] == "identity")
        self.assertEqual(identity["status"], "critical_missing")

    def test_coverage_handles_missing_contact_dict(self) -> None:
        coverage = primary_key_coverage({"name": "Candidate Two", "contact": None})
        self.assertLess(coverage["score"], 1)
        self.assertIn("contact.email", coverage["missing_keys"])


if __name__ == "__main__":
    unittest.main()
