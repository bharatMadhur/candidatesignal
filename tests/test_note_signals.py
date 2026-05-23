from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.note_signals import extract_recruiter_note_signals


class NoteSignalTests(unittest.TestCase):
    def test_extracts_practical_recruiter_filters_from_free_text(self) -> None:
        signals = extract_recruiter_note_signals("Concern", "OPT. Salary 300k. Open to relocate to New York. Available in 2 weeks.")
        by_label = {item["label"]: item for item in signals}

        self.assertEqual(by_label["opt"]["category"], "work_authorization")
        self.assertEqual(by_label["compensation_expectation"]["category"], "compensation")
        self.assertEqual(by_label["open_to_relocate"]["category"], "mobility")
        self.assertEqual(by_label["two_weeks"]["category"], "availability")

    def test_ignores_empty_note(self) -> None:
        self.assertEqual(extract_recruiter_note_signals("", " "), [])

    def test_extracts_relationship_source_and_profile_status(self) -> None:
        signals = extract_recruiter_note_signals(
            "LinkedIn follow-up",
            "Connected on LinkedIn. Referral from Priya. LinkedIn verified. H1B transfer, W2 only.",
        )
        by_label = {item["label"]: item for item in signals}

        self.assertEqual(by_label["linkedin_connected"]["category"], "relationship")
        self.assertEqual(by_label["referral_source"]["category"], "candidate_source")
        self.assertEqual(by_label["linkedin_verified"]["category"], "profile_status")
        self.assertEqual(by_label["h1b"]["category"], "work_authorization")
        self.assertEqual(by_label["w2_only"]["category"], "work_authorization")


if __name__ == "__main__":
    unittest.main()
