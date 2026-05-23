from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.profile_freshness import enrich_profile_freshness


class ProfileFreshnessTests(unittest.TestCase):
    def test_marks_verified_linkedin_profile_as_fresh(self) -> None:
        record = {
            "derived": {
                "profile_verification": {
                    "linkedin": {"status": "verified", "url": "https://www.linkedin.com/in/example", "match_confidence": 0.9},
                    "portfolio": {"status": "missing"},
                    "github": {"status": "missing"},
                },
                "fact_verification": {"current_role_status": "verified"},
                "location_intelligence": {"current_location": "Pittsburgh, PA", "location_conflict": False},
                "recruiter_note_signals": {"signals": []},
            }
        }

        enriched = enrich_profile_freshness(record)
        freshness = enriched["derived"]["profile_freshness"]

        self.assertEqual(freshness["status"], "fresh")
        self.assertIn("LinkedIn", freshness["verified_sources"])
        self.assertEqual(freshness["flags"], [])

    def test_recruiter_stale_note_overrides_link_presence(self) -> None:
        record = {
            "derived": {
                "profile_verification": {
                    "linkedin": {"status": "valid_profile_url", "url": "https://www.linkedin.com/in/example"},
                    "portfolio": {"status": "missing"},
                    "github": {"status": "missing"},
                },
                "fact_verification": {"current_role_status": "verified"},
                "location_intelligence": {"current_location": "Chicago, IL", "location_conflict": False},
                "recruiter_note_signals": {
                    "signals": [{"category": "profile_status", "label": "profile_stale", "value": "old resume"}]
                },
            }
        }

        freshness = enrich_profile_freshness(record)["derived"]["profile_freshness"]

        self.assertEqual(freshness["status"], "stale")
        self.assertTrue(any(item["key"] == "recruiter_marked_stale" for item in freshness["flags"]))

    def test_missing_linkedin_and_unknown_location_need_verification_not_rejection(self) -> None:
        record = {
            "derived": {
                "profile_verification": {
                    "linkedin": {"status": "missing"},
                    "portfolio": {"status": "missing"},
                    "github": {"status": "missing"},
                },
                "fact_verification": {"current_role_status": "needs_review"},
                "location_intelligence": {"current_location": None},
                "recruiter_note_signals": {"signals": []},
            }
        }

        freshness = enrich_profile_freshness(record)["derived"]["profile_freshness"]

        self.assertEqual(freshness["status"], "needs_verification")
        self.assertIn("LinkedIn", freshness["missing_verifications"])
        self.assertTrue(any(item["key"] == "current_location_unknown" for item in freshness["flags"]))


if __name__ == "__main__":
    unittest.main()
