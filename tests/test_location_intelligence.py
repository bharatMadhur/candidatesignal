from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.geo import build_location_intelligence, candidate_current_location


class LocationIntelligenceTests(unittest.TestCase):
    def test_resume_header_location_wins_over_latest_role_location_for_current_location(self) -> None:
        record = {
            "contact": {"location": "Pittsburgh, PA"},
            "experience": [
                {"company": "Older Overseas Employer", "title": "Engineer", "location": "India"},
            ],
            "education": [{"school": "Carnegie Mellon University", "location": "Pittsburgh, PA"}],
        }

        intelligence = build_location_intelligence(record)
        record["derived"] = {"location_intelligence": intelligence}

        self.assertEqual(intelligence["current_location"], "Pittsburgh, PA")
        self.assertEqual(intelligence["latest_role_location"], "India")
        self.assertTrue(intelligence["location_conflict"])
        self.assertEqual(candidate_current_location(record), "Pittsburgh, PA")

    def test_latest_role_location_is_not_promoted_to_current_location(self) -> None:
        record = {
            "contact": {},
            "experience": [
                {"company": "Older Overseas Employer", "title": "Engineer", "location": "India"},
            ],
            "education": [{"school": "Carnegie Mellon University", "location": "Pittsburgh, PA"}],
        }

        intelligence = build_location_intelligence(record)
        record["derived"] = {"location_intelligence": intelligence}

        self.assertIsNone(intelligence["current_location"])
        self.assertEqual(intelligence["current_location_source"], "not_stated")
        self.assertEqual(intelligence["latest_role_location"], "India")
        self.assertEqual(candidate_current_location(record), None)


if __name__ == "__main__":
    unittest.main()
