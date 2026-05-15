from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.profile_verification import enrich_profile_verification


class ProfileVerificationTests(unittest.TestCase):
    def test_marks_linkedin_profile_and_portfolio_signals(self) -> None:
        record = {
            "derived": {
                "pii_contact_intelligence": {
                    "linkedin_urls": ["https://www.linkedin.com/in/example-person"],
                    "portfolio_websites": ["https://portfolio.example.com"],
                    "github_urls": ["https://github.com/example"],
                }
            }
        }

        enriched = enrich_profile_verification(record)
        verification = enriched["derived"]["profile_verification"]

        self.assertEqual(verification["linkedin"]["status"], "valid_profile_url")
        self.assertEqual(verification["portfolio"]["status"], "present")
        self.assertEqual(verification["github"]["status"], "present")
        self.assertIn("linkedin_profile_url_present", verification["application_validity_signals"])

    def test_distinguishes_non_profile_linkedin_url(self) -> None:
        record = {"derived": {"pii_contact_intelligence": {"linkedin_urls": ["https://www.linkedin.com/company/example"]}}}

        enriched = enrich_profile_verification(record)

        self.assertEqual(enriched["derived"]["profile_verification"]["linkedin"]["status"], "linkedin_url_not_profile")


if __name__ == "__main__":
    unittest.main()
