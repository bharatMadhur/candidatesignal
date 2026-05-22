from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.db_store import _apply_candidate_profile_updates, _refresh_timeline_derivations


class ManualProfileCorrectionTests(unittest.TestCase):
    def test_experience_edits_recalculate_timeline_and_current_role(self) -> None:
        record = {
            "document_id": "candidate-1",
            "source_file": "resume.pdf",
            "name": "Candidate One",
            "contact": {},
            "skills": [],
            "experience": [],
            "education": [],
            "derived": {"hr_profile": {"current_title": "Old Title", "current_company": "Old Company"}},
        }
        updates = {
            "experience": [
                {
                    "company": "Orbit Systems Inc",
                    "title": "Founding Engineer",
                    "location": "New York, NY",
                    "start_date": "2023-01",
                    "end_date": "2024-12",
                    "bullets": ["Built AI workflow systems."],
                },
                {
                    "company": "OCLC",
                    "title": "Software Engineer",
                    "location": "Columbus, OH",
                    "start_date": "2020-01",
                    "end_date": "2022-12",
                    "bullets": ["Built library software."],
                },
            ],
            "education": [
                {
                    "school": "Example University",
                    "degree": "MS",
                    "field": "Computer Science",
                    "start_date": "2018",
                    "end_date": "2020",
                    "details": ["Graduate coursework"],
                }
            ],
        }

        applied = _apply_candidate_profile_updates(record, updates)
        _refresh_timeline_derivations(record, updates)

        self.assertIn("experience", applied)
        self.assertIn("education", applied)
        self.assertEqual(record["experience"][0]["title"], "Founding Engineer")
        self.assertEqual(record["education"][0]["school"], "Example University")
        self.assertEqual(record["derived"]["hr_profile"]["current_title"], "Founding Engineer")
        self.assertEqual(record["derived"]["hr_profile"]["current_company"], "Orbit Systems Inc")
        self.assertEqual(record["derived"]["timeline"]["experience_accounting"]["total_months_unique"], 60)
        self.assertEqual(record["derived"]["hr_profile"]["total_years_experience"], 5.0)


if __name__ == "__main__":
    unittest.main()
