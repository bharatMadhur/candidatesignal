from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.workstreams import nest_same_company_workstreams


class WorkstreamNormalizationTests(unittest.TestCase):
    def test_same_company_project_rows_are_nested_under_parent_role(self) -> None:
        record = {
            "experience": [
                {
                    "company": "Orbit Systems Inc",
                    "title": "Founding Engineer",
                    "start_date": "2023-07",
                    "end_date": "Present",
                    "bullets": ["Built enterprise data platform."],
                },
                {
                    "company": "Orbit Systems Inc",
                    "title": "Agentic Chatbot (Analytics Assistant)",
                    "start_date": "2023-07",
                    "end_date": "Present",
                    "bullets": ["Built LangChain analytics assistant."],
                },
                {
                    "company": "Orbit Systems Inc",
                    "title": "SOW Contract Agent (AI Workflow Automation)",
                    "start_date": "2023-07",
                    "end_date": "Present",
                    "bullets": ["Built SOW automation workflow."],
                },
            ]
        }

        normalized = nest_same_company_workstreams(record)

        self.assertEqual(len(normalized["experience"]), 1)
        self.assertEqual(normalized["experience"][0]["title"], "Founding Engineer")
        self.assertEqual(len(normalized["experience"][0]["workstreams"]), 2)
        self.assertEqual(
            normalized["experience"][0]["workstreams"][0]["name"],
            "Agentic Chatbot (Analytics Assistant)",
        )
        self.assertEqual(normalized["derived"]["workstream_normalization"]["moved_experience_rows"], 2)

    def test_sequential_same_company_roles_are_not_nested(self) -> None:
        record = {
            "experience": [
                {
                    "company": "JobsOhio",
                    "title": "Sr. Data & AI Engineer",
                    "start_date": "2022-01",
                    "end_date": "2023-01",
                    "bullets": ["Designed architectures."],
                },
                {
                    "company": "JobsOhio",
                    "title": "Lead Data & AI Solutions Engineer",
                    "start_date": "2023-02",
                    "end_date": "Present",
                    "bullets": ["Led AI adoption."],
                },
            ]
        }

        normalized = nest_same_company_workstreams(record)

        self.assertEqual(len(normalized["experience"]), 2)
        self.assertFalse(normalized["experience"][0].get("workstreams"))
        self.assertFalse(normalized["experience"][1].get("workstreams"))


if __name__ == "__main__":
    unittest.main()
