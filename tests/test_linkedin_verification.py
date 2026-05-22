from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.linkedin_verification import compare_candidate_to_linkedin, normalize_linkedin_profile


class LinkedInVerificationTests(unittest.TestCase):
    def test_compares_linkedin_profile_to_candidate_without_calling_provider(self) -> None:
        candidate = {
            "name": "Zulqarnain Musawar",
            "contact": {"location": "Chicago, IL", "links": ["https://www.linkedin.com/in/zulqarnainmusawar"]},
            "derived": {"pii_contact_intelligence": {"linkedin_urls": ["https://www.linkedin.com/in/zulqarnainmusawar"]}},
            "experience": [
                {"company": "Roquette", "title": "Reliability Engineer II", "location": "Iowa, United States"},
                {"company": "Texas Tech University", "title": "Graduate Teaching Assistant"},
            ],
            "education": [{"school": "Texas Tech University", "degree": "Masters Mechanical Engineering"}],
        }
        raw = {
            "id": "linkedin-1",
            "firstName": "Zulqarnain",
            "lastName": "Musawar",
            "linkedinUrl": "https://www.linkedin.com/in/zulqarnainmusawar",
            "headline": "Reliability Engineer II",
            "location": {"parsed": {"text": "Chicago, IL, United States", "countryFull": "United States"}},
            "experience": [
                {"position": "Reliability Engineer II", "companyName": "Roquette", "location": "Iowa, United States"},
                {"position": "Graduate Teaching Assistant", "companyName": "Texas Tech University"},
            ],
            "education": [{"schoolName": "Texas Tech University", "degree": "Masters Mechanical Engineering"}],
        }

        snapshot = normalize_linkedin_profile(raw, "https://www.linkedin.com/in/zulqarnainmusawar")
        comparison = compare_candidate_to_linkedin(candidate, snapshot)

        self.assertEqual(comparison["status"], "verified")
        self.assertGreaterEqual(comparison["match_confidence"], 0.76)
        self.assertTrue(comparison["url_match"])
        self.assertIn("Roquette", comparison["company_overlap"]["matches"])

    def test_low_overlap_requires_review_or_mismatch(self) -> None:
        candidate = {"name": "Different Person", "contact": {}, "experience": [{"company": "Acme"}], "education": []}
        snapshot = normalize_linkedin_profile(
            {
                "firstName": "Zulqarnain",
                "lastName": "Musawar",
                "linkedinUrl": "https://www.linkedin.com/in/zulqarnainmusawar",
                "experience": [{"position": "Reliability Engineer", "companyName": "Roquette"}],
            },
            "https://www.linkedin.com/in/zulqarnainmusawar",
        )

        comparison = compare_candidate_to_linkedin(candidate, snapshot)

        self.assertIn(comparison["status"], {"needs_review", "mismatch"})
        self.assertLess(comparison["match_confidence"], 0.72)


if __name__ == "__main__":
    unittest.main()
