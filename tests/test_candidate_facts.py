from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.candidate_facts import factual_current_company, factual_current_title


class CandidateFactSelectionTests(unittest.TestCase):
    def test_factual_current_title_beats_ai_summary_card_title(self) -> None:
        record = {
            "experience": [{"company": "OCLC", "title": "Software Engineer"}],
            "derived": {"hr_profile": {"current_title": "Software Engineer", "current_company": "OCLC"}},
            "candidate_intelligence": {
                "final_candidate_profile": {
                    "summary_card": {"current_or_target_title": "Founding Engineer"}
                }
            },
        }

        self.assertEqual(factual_current_title(record), "Software Engineer")
        self.assertEqual(factual_current_company(record), "OCLC")

    def test_falls_back_to_experience_before_ai_identity_summary(self) -> None:
        record = {
            "experience": [{"company": "OCLC", "title": "Software Engineer"}],
            "candidate_intelligence": {
                "final_candidate_profile": {
                    "summary_card": {"current_or_target_title": "Founding Engineer"}
                }
            },
        }

        self.assertEqual(factual_current_title(record), "Software Engineer")

    def test_unsupported_current_role_uses_first_verified_role(self) -> None:
        record = {
            "experience": [
                {"company": "Orbit", "title": "Founding Engineer"},
                {"company": "OCLC", "title": "Software Engineer"},
            ],
            "derived": {
                "hr_profile": {"current_title": "Founding Engineer", "current_company": "Orbit"},
                "fact_verification": {
                    "current_role_status": "needs_review",
                    "role_checks": [
                        {"company": "Orbit", "title": "Founding Engineer", "status": "needs_review"},
                        {"company": "OCLC", "title": "Software Engineer", "status": "verified"},
                    ],
                },
            },
        }

        self.assertEqual(factual_current_title(record), "Software Engineer")
        self.assertEqual(factual_current_company(record), "OCLC")


if __name__ == "__main__":
    unittest.main()
