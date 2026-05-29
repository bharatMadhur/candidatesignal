from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel import web
from resume_intel import candidate_versions
from resume_intel.candidate_versions import build_version_diffs, find_matches_for_record, merge_match


class CandidateVersionDiffTests(unittest.TestCase):
    def test_match_scan_skips_database_without_identity_signals(self) -> None:
        with patch.object(candidate_versions, "db") as db:
            matches = find_matches_for_record({"document_id": "doc-1", "contact": {}, "experience": []}, tenant_id="tenant-1")

        db.assert_not_called()
        self.assertEqual(matches, [])

    def test_match_scan_skips_database_for_company_overlap_without_identity(self) -> None:
        record = {
            "document_id": "doc-1",
            "contact": {},
            "experience": [{"company": "Orbit Systems Inc", "title": "Engineer"}],
        }

        with patch.object(candidate_versions, "db") as db:
            matches = find_matches_for_record(record, tenant_id="tenant-1")

        db.assert_not_called()
        self.assertEqual(matches, [])

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

    def test_candidate_detail_does_not_run_live_version_scan(self) -> None:
        user = {"id": "user-1", "tenant_id": "tenant-1", "tenant_role": "recruiter"}
        raw_record = {"document_id": "doc-1", "name": "Candidate One"}

        with (
            patch.object(web, "load_candidate_db", return_value=raw_record),
            patch.object(web, "list_matches_for_candidate", return_value=[]),
            patch.object(web, "find_matches_for_record") as find_matches,
            patch.object(web, "persist_matches") as persist_matches,
            patch.object(web, "reviewed_candidate_signals_db", return_value=[]),
            patch.object(web, "_can_view_pii", return_value=False),
            patch.object(web, "public_candidate_record", side_effect=lambda record, **_kwargs: dict(record)),
        ):
            result = web.candidate("doc-1", user)

        find_matches.assert_not_called()
        persist_matches.assert_not_called()
        self.assertEqual(result["candidate_versions"]["matches"], [])

    def test_candidate_detail_uses_existing_version_decision_without_rescanning(self) -> None:
        user = {"id": "user-1", "tenant_id": "tenant-1", "tenant_role": "recruiter"}
        raw_record = {"document_id": "doc-1", "name": "Candidate One"}
        persisted_matches = [{"id": "match-1", "left_document_id": "doc-1", "right_document_id": "doc-2", "status": "separate"}]

        with (
            patch.object(web, "load_candidate_db", return_value=raw_record),
            patch.object(web, "list_matches_for_candidate", return_value=persisted_matches),
            patch.object(web, "find_matches_for_record") as find_matches,
            patch.object(web, "persist_matches") as persist_matches,
            patch.object(web, "reviewed_candidate_signals_db", return_value=[]),
            patch.object(web, "_can_view_pii", return_value=False),
            patch.object(web, "public_candidate_record", side_effect=lambda record, **_kwargs: dict(record)),
        ):
            result = web.candidate("doc-1", user)

        find_matches.assert_not_called()
        persist_matches.assert_not_called()
        self.assertEqual(result["candidate_versions"]["matches"], persisted_matches)

    def test_profile_update_persists_live_version_matches(self) -> None:
        user = {"id": "user-1", "tenant_id": "tenant-1", "tenant_role": "tenant_admin"}
        updated_record = {"document_id": "doc-1", "name": "Candidate One"}
        live_matches = [{"document_id": "doc-2", "score": 0.9, "reasons": [{"type": "exact_email"}]}]
        persisted_matches = [{"id": "match-1", "left_document_id": "doc-1", "right_document_id": "doc-2", "status": "versioned"}]

        with (
            patch.object(web, "update_candidate_profile_db", return_value=updated_record),
            patch.object(web, "find_matches_for_record", return_value=live_matches),
            patch.object(web, "persist_matches") as persist_matches,
            patch.object(web, "list_matches_for_candidate", return_value=persisted_matches),
            patch.object(web, "reviewed_candidate_signals_db", return_value=[]),
            patch.object(web, "_can_view_pii", return_value=False),
            patch.object(web, "public_candidate_record", side_effect=lambda record, **_kwargs: dict(record)),
        ):
            result = web.update_candidate_profile("doc-1", web.CandidateProfileUpdateRequest(), user)

        persist_matches.assert_called_once_with(updated_record, live_matches, "tenant-1")
        self.assertEqual(result["candidate_versions"]["matches"], persisted_matches)


if __name__ == "__main__":
    unittest.main()
