from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel import web


class CandidateReviewSignalTests(unittest.TestCase):
    def test_candidate_detail_includes_reviewed_signals(self) -> None:
        user = {"id": "user-1", "tenant_id": "tenant-1", "tenant_role": "recruiter"}
        raw_record = {"document_id": "doc-1", "name": "Candidate One"}

        with (
            patch.object(web, "load_candidate_db", return_value=raw_record),
            patch.object(web, "list_matches_for_candidate", return_value=[]),
            patch.object(web, "reviewed_candidate_signals_db", return_value=["role_fact_review"]),
            patch.object(web, "_can_view_pii", return_value=False),
            patch.object(web, "public_candidate_record", side_effect=lambda record, **_kwargs: dict(record)),
        ):
            result = web.candidate("doc-1", user)

        self.assertEqual(result["reviewed_signals"], ["role_fact_review"])

    def test_mark_review_signal_persists_through_store(self) -> None:
        user = {"id": "user-1", "tenant_id": "tenant-1", "tenant_role": "tenant_admin"}
        persisted = {"document_id": "doc-1", "signal_key": "low_coverage", "status": "reviewed"}

        with patch.object(web, "mark_candidate_review_signal_db", return_value=persisted) as mark_review:
            result = web.mark_candidate_review_signal("doc-1", "low_coverage", web.CandidateReviewSignalRequest(), user)

        mark_review.assert_called_once_with("doc-1", "tenant-1", "user-1", "low_coverage", None)
        self.assertEqual(result["review"], persisted)

    def test_mark_profile_freshness_review_signal(self) -> None:
        user = {"id": "user-1", "tenant_id": "tenant-1", "tenant_role": "tenant_admin"}
        persisted = {"document_id": "doc-1", "signal_key": "profile_freshness_review", "status": "reviewed"}

        with patch.object(web, "mark_candidate_review_signal_db", return_value=persisted) as mark_review:
            result = web.mark_candidate_review_signal("doc-1", "profile_freshness_review", web.CandidateReviewSignalRequest(), user)

        mark_review.assert_called_once_with("doc-1", "tenant-1", "user-1", "profile_freshness_review", None)
        self.assertEqual(result["review"], persisted)


if __name__ == "__main__":
    unittest.main()
