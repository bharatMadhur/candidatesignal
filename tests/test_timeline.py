from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.timeline import build_timeline_profile


class TimelineTests(unittest.TestCase):
    def test_same_company_project_overlap_is_not_cross_company_overlap(self) -> None:
        profile = build_timeline_profile(
            {
                "experience": [
                    {
                        "company": "Orbit Systems Inc",
                        "title": "Founding Engineer",
                        "start_date": "2023-07",
                        "end_date": "Present",
                        "bullets": ["Built the platform."],
                    },
                    {
                        "company": "Orbit Systems Inc",
                        "title": "Agentic Chatbot",
                        "start_date": "2023-07",
                        "end_date": "Present",
                        "bullets": ["Built analytics assistant."],
                    },
                ]
            }
        )

        events = profile["timeline_events"]
        self.assertEqual(events[0]["overlaps_with"], [])
        self.assertEqual(events[1]["overlaps_with"], [])
        self.assertEqual(profile["experience_accounting"]["overlap_group_count"], 0)

    def test_different_company_overlap_is_marked_once(self) -> None:
        profile = build_timeline_profile(
            {
                "experience": [
                    {
                        "company": "Company A",
                        "title": "Engineer",
                        "start_date": "2022-01",
                        "end_date": "2023-01",
                        "bullets": ["Built systems."],
                    },
                    {
                        "company": "Company B",
                        "title": "Consultant",
                        "start_date": "2022-06",
                        "end_date": "2022-12",
                        "bullets": ["Consulting role."],
                    },
                ]
            }
        )

        events = profile["timeline_events"]
        self.assertTrue(events[0]["overlaps_with"])
        self.assertTrue(events[1]["overlaps_with"])
        self.assertEqual(profile["experience_accounting"]["overlap_group_count"], 1)


if __name__ == "__main__":
    unittest.main()
