from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.requirements import build_match_run_changes


class MatchRunHistoryTests(unittest.TestCase):
    def test_match_run_changes_track_rank_and_score_movement(self) -> None:
        previous = [
            {"candidate_id": "a", "candidate_name": "A", "rank": 1, "total_score": 0.82},
            {"candidate_id": "b", "candidate_name": "B", "rank": 2, "total_score": 0.64},
        ]
        current = [
            {"candidate_id": "b", "candidate_name": "B", "rank": 1, "total_score": 0.78},
            {"candidate_id": "c", "candidate_name": "C", "rank": 2, "total_score": 0.55},
            {"candidate_id": "a", "candidate_name": "A", "rank": 3, "total_score": 0.7},
        ]

        changes = build_match_run_changes(previous, current)
        by_id = {item["candidate_id"]: item for item in changes}

        self.assertEqual(by_id["b"]["change_type"], "changed")
        self.assertEqual(by_id["b"]["rank_delta"], 1)
        self.assertEqual(by_id["b"]["score_delta"], 0.14)
        self.assertEqual(by_id["c"]["change_type"], "added")
        self.assertEqual(by_id["a"]["rank_delta"], -2)
        self.assertEqual(by_id["a"]["score_delta"], -0.12)


if __name__ == "__main__":
    unittest.main()
