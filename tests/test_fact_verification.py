from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.fact_verification import enrich_fact_verification


class FactVerificationTests(unittest.TestCase):
    def test_flags_hallucinated_current_title_against_raw_resume_text(self) -> None:
        record = {
            "experience": [
                {"company": "OCLC", "title": "Founding Engineer", "start_date": "2022-01", "end_date": "Present"}
            ],
            "derived": {},
        }
        raw_text = """
        EXPERIENCE
        OCLC
        Software Engineer
        Jan 2022 - Present
        Built distributed systems and internal platforms.
        """

        enriched = enrich_fact_verification(record, raw_text)
        verification = enriched["derived"]["fact_verification"]

        self.assertEqual(verification["status"], "needs_review")
        self.assertEqual(verification["current_role_status"], "needs_review")
        self.assertIn("title_not_found_in_raw_text", verification["current_role_flags"])
        self.assertTrue(any("OCLC" in line for line in verification["role_checks"][0]["evidence_lines"]))

    def test_verifies_title_company_and_dates_when_supported(self) -> None:
        record = {
            "experience": [
                {"company": "OCLC", "title": "Software Engineer", "start_date": "2022-01", "end_date": "Present"}
            ],
            "derived": {},
        }
        raw_text = "OCLC Software Engineer Jan 2022 - Present"

        enriched = enrich_fact_verification(record, raw_text)
        verification = enriched["derived"]["fact_verification"]

        self.assertEqual(verification["status"], "verified")
        self.assertEqual(verification["summary"]["verified_roles"], 1)
        self.assertEqual(verification["summary"]["review_roles"], 0)


if __name__ == "__main__":
    unittest.main()
