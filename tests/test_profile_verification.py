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

    def test_preserves_external_linkedin_verification_when_refreshing_links(self) -> None:
        record = {
            "derived": {
                "pii_contact_intelligence": {
                    "linkedin_urls": ["https://www.linkedin.com/in/example-person"],
                    "portfolio_websites": [],
                    "github_urls": [],
                },
                "profile_verification": {
                    "external_verification_status": "verified",
                    "linkedin": {
                        "status": "verified",
                        "url": "https://www.linkedin.com/in/example-person",
                        "match_confidence": 0.92,
                    },
                    "linkedin_external": {"run_id": "run-1"},
                    "application_validity_signals": ["linkedin_external_verified"],
                },
            }
        }

        enriched = enrich_profile_verification(record)
        verification = enriched["derived"]["profile_verification"]

        self.assertEqual(verification["external_verification_status"], "verified")
        self.assertEqual(verification["linkedin"]["status"], "verified")
        self.assertEqual(verification["linkedin"]["match_confidence"], 0.92)
        self.assertEqual(verification["linkedin_external"], {"run_id": "run-1"})
        self.assertIn("linkedin_profile_url_present", verification["application_validity_signals"])
        self.assertIn("linkedin_external_verified", verification["application_validity_signals"])


if __name__ == "__main__":
    unittest.main()
