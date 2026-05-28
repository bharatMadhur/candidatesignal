from __future__ import annotations

import unittest
from unittest.mock import patch

from resume_intel import candidate_portal


class _Result:
    def __init__(self, *, one=None, many=None):
        self._one = one
        self._many = many or []

    def fetchone(self):
        return self._one

    def fetchall(self):
        return self._many


class _FakeConn:
    def __init__(self):
        self.upload = {
            "id": "upload-1",
            "candidate_user_id": "candidate-1",
            "resume_version_id": None,
            "original_filename": "resume.pdf",
            "mime_type": "application/pdf",
            "size_bytes": 1200,
            "sha256": "abc123",
            "target_role": None,
            "candidate_note": None,
            "status": "queued",
            "stage": "queued",
            "progress": 5,
            "attempt_count": 0,
            "max_attempts": 2,
            "worker_id": None,
            "next_retry_at": None,
            "error_message": None,
            "parsed_profile_json": {},
            "parsed_resume_json": {},
            "parse_quality_json": {},
            "needs_review_json": [],
            "created_at": None,
            "updated_at": None,
            "completed_at": None,
        }
        self.committed = False

    def execute(self, sql, params=None):
        normalized = " ".join(str(sql).split())
        if "where status='running'" in normalized and "returning status" in normalized:
            return _Result(many=[])
        if "from candidate_resume_uploads where status in ('queued', 'retrying')" in normalized:
            return _Result(one=self.upload)
        if "set status='running'" in normalized and "returning *" in normalized:
            self.upload = {
                **self.upload,
                "status": "running",
                "stage": "running",
                "progress": params[0],
                "attempt_count": self.upload["attempt_count"] + 1,
                "worker_id": params[1],
            }
            return _Result(one=self.upload)
        if "set status='queued'" in normalized and "status in ('failed', 'retrying')" in normalized:
            self.upload = {
                **self.upload,
                "status": "queued",
                "stage": "queued",
                "progress": params[0],
                "error_message": None,
                "next_retry_at": None,
                "completed_at": None,
            }
            return _Result(one=self.upload)
        raise AssertionError(f"unexpected sql: {normalized}")

    def commit(self):
        self.committed = True


class _FakeDb:
    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        return self.conn

    def __exit__(self, *_args):
        return None


class CandidateUploadWorkerTests(unittest.TestCase):
    def test_run_next_resume_upload_job_claims_upload_before_processing(self):
        conn = _FakeConn()

        with (
            patch.object(candidate_portal, "db", lambda: _FakeDb(conn)),
            patch.object(
                candidate_portal,
                "run_resume_upload_parse",
                return_value={"upload": {"id": "upload-1", "status": "succeeded", "stage": "succeeded"}},
            ) as parse,
        ):
            result = candidate_portal.run_next_resume_upload_job(worker_id="worker-1")

        self.assertEqual(result["upload"]["status"], "succeeded")
        self.assertTrue(conn.committed)
        self.assertEqual(conn.upload["status"], "running")
        self.assertEqual(conn.upload["attempt_count"], 1)
        self.assertEqual(conn.upload["worker_id"], "worker-1")
        parse.assert_called_once_with("upload-1", "candidate-1", worker_id="worker-1")

    def test_retry_resume_upload_requeues_failed_upload(self):
        conn = _FakeConn()
        conn.upload = {
            **conn.upload,
            "status": "failed",
            "stage": "failed",
            "progress": 100,
            "error_message": "OCR failed",
        }

        with patch.object(candidate_portal, "db", lambda: _FakeDb(conn)):
            result = candidate_portal.retry_resume_upload({"id": "candidate-1", "role": "candidate"}, "upload-1")

        self.assertEqual(result["upload"]["status"], "queued")
        self.assertEqual(result["upload"]["progress"], 5)
        self.assertIsNone(result["upload"]["error_message"])


if __name__ == "__main__":
    unittest.main()
