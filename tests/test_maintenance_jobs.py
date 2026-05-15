from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.maintenance_jobs import rederive_candidate_record


class CandidateMaintenanceTests(unittest.TestCase):
    def test_rederive_recalculates_timeline_and_caps_domain_years(self) -> None:
        record = {
            "document_id": "candidate-1",
            "source_file": "resume.pdf",
            "name": "Pranjal Example",
            "contact": {},
            "summary": "Founding engineer.",
            "skills": ["Azure", "Databricks"],
            "experience": [
                {
                    "company": "Orbit Systems Inc",
                    "title": "Founding Engineer",
                    "start_date": "2020-01",
                    "end_date": "2025-12",
                    "bullets": ["Built Azure cloud architecture and AI assistants."],
                },
                {
                    "company": "Orbit Systems Inc",
                    "title": "Agentic Chatbot",
                    "start_date": "2023-07",
                    "end_date": "Present",
                    "bullets": ["Built LangChain analytics assistant."],
                },
            ],
            "derived": {
                "hr_profile": {"total_years_experience": 6.0},
                "experience_by_domain": {"cloud_architecture": {"years": 8.0, "evidence_terms": ["Azure"]}},
            },
            "candidate_intelligence": {"final_candidate_profile": {"summary_card": {"fit": "AI platform engineer"}}},
        }

        updated = rederive_candidate_record(record, "Azure cloud architecture Databricks")
        cloud = updated["derived"]["experience_by_domain"]["cloud_architecture"]

        self.assertLessEqual(cloud["years"], updated["derived"]["hr_profile"]["total_years_experience"])
        self.assertEqual(updated["derived"]["timeline"]["experience_accounting"]["overlap_group_count"], 0)
        self.assertEqual(updated["candidate_intelligence"]["final_candidate_profile"]["summary_card"]["fit"], "AI platform engineer")


if __name__ == "__main__":
    unittest.main()
