from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.geo import build_location_intelligence


class LocationIntelligenceTests(unittest.TestCase):
    def test_builds_current_work_education_timezone_and_authorization_signals(self) -> None:
        record = {
            "contact": {"location": "Columbus, OH"},
            "experience": [
                {"company": "JobsOhio", "title": "Lead Engineer", "location": "Columbus, OH", "workstreams": []},
                {
                    "company": "Tekno Valves",
                    "title": "Data Engineer",
                    "location": "Mumbai, India",
                    "workstreams": [{"name": "ERP migration", "location": "Pune, India"}],
                },
            ],
            "education": [{"school": "Illinois State University", "location": "Normal, IL"}],
        }
        text = "Authorized to work in the US. Open to remote EST teams and relocation."

        intelligence = build_location_intelligence(record, text)

        self.assertEqual(intelligence["current_location"], "Columbus, OH")
        self.assertEqual(intelligence["current_job_location"], "Columbus, OH")
        self.assertEqual(intelligence["resume_header_location"], "Columbus, OH")
        self.assertEqual(intelligence["current_location_confidence"], "resume_header")
        countries = {item["country"] for item in intelligence["countries_associated"]}
        self.assertIn("United States", countries)
        self.assertIn("India", countries)
        self.assertTrue(any(item["context"] == "workstream" for item in intelligence["location_signals"]))
        self.assertTrue(intelligence["timezone_signals"])
        self.assertTrue(intelligence["work_authorization_signals"])
        self.assertTrue(intelligence["remote_work_signals"])
        self.assertTrue(intelligence["relocation_signals"])

    def test_us_city_state_without_comma_infers_united_states(self) -> None:
        record = {"contact": {"location": "Worcester MA"}, "experience": [], "education": []}

        intelligence = build_location_intelligence(record, "")

        self.assertEqual(intelligence["current_location"], "Worcester MA")
        self.assertIsNone(intelligence["current_job_location"])
        self.assertEqual(intelligence["resume_header_location"], "Worcester MA")
        self.assertEqual(intelligence["current_location_confidence"], "resume_header")
        countries = {item["country"] for item in intelligence["countries_associated"]}
        self.assertIn("United States", countries)

    def test_does_not_guess_current_location_from_older_roles(self) -> None:
        record = {
            "contact": {"location": "Columbus, OH"},
            "experience": [
                {"company": "LatestCo", "title": "Lead Engineer", "location": None, "workstreams": []},
                {"company": "OlderCo", "title": "Engineer", "location": "New York, NY", "workstreams": []},
            ],
            "education": [],
        }

        intelligence = build_location_intelligence(record, "")

        self.assertEqual(intelligence["current_location"], "Columbus, OH")
        self.assertEqual(intelligence["resume_header_location"], "Columbus, OH")
        self.assertTrue(any(item["value"] == "New York, NY" and item["context"] == "work_history" for item in intelligence["location_signals"]))


if __name__ == "__main__":
    unittest.main()
