from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.candidate_versions import build_version_diffs, merge_match


class CandidateVersionDiffTests(unittest.TestCase):
    def test_marks_same_missing_and_different_fields(self) -> None:
        diffs = {item["key"]: item for item in build_version_diffs(
            {
                "email": "person@example.com",
                "phone": "555-0100",
                "current_company": "Orbit Systems Inc",
                "skills": ["Python", "LangChain", "Databricks"],
                "education": [],
            },
            {
                "email": " person@example.com ",
                "phone": "",
                "current_company": "JobsOhio",
                "skills": ["Python", "LangChain", "Azure"],
                "education": ["M.S. | Computer Science | Example University"],
            },
        )}

        self.assertEqual(diffs["email"]["status"], "same")
        self.assertEqual(diffs["phone"]["status"], "missing")
        self.assertEqual(diffs["current_company"]["status"], "different")
        self.assertEqual(diffs["skills"]["status"], "different")
        self.assertEqual(diffs["skills"]["overlap"], ["Python", "LangChain"])
        self.assertEqual(diffs["skills"]["left_only"], ["Databricks"])
        self.assertEqual(diffs["skills"]["right_only"], ["Azure"])
        self.assertEqual(diffs["education"]["status"], "missing")

    def test_candidate_merge_helper_is_disabled(self) -> None:
        with self.assertRaises(RuntimeError):
            merge_match("match-id", "user-id", "tenant-id")


if __name__ == "__main__":
    unittest.main()
