from __future__ import annotations

import unittest
from unittest.mock import patch

from resume_intel import parse_jobs


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
        self.queried_candidate_uploads = False

    def execute(self, sql, params=None):
        normalized = " ".join(str(sql).split())
        if "from parse_worker_heartbeats" in normalized:
            return _Result(
                many=[
                    {
                        "worker_id": "worker-1",
                        "tenant_id": None,
                        "status": "running",
                        "current_job_id": None,
                        "processed_jobs": 7,
                        "last_error": None,
                        "metadata": {},
                        "started_at": None,
                        "last_seen_at": None,
                        "online": True,
                    }
                ]
            )
        if "from parse_jobs" in normalized:
            return _Result(one={"queued_count": 2, "running_count": 1, "failed_count": 3})
        if "from campaign_match_jobs" in normalized:
            return _Result(one={"queued_count": 4, "running_count": 5, "failed_count": 6})
        if "from candidate_resume_uploads" in normalized:
            self.queried_candidate_uploads = True
            return _Result(one={"queued_count": 8, "running_count": 9, "failed_count": 10})
        if "from parse_job_dead_letters" in normalized:
            return _Result(one={"dead_letter_count": 11})
        raise AssertionError(f"unexpected SQL: {normalized}")


class _FakeDb:
    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        return self.conn

    def __exit__(self, *_args):
        return None


class WorkerStatusTests(unittest.TestCase):
    def test_worker_status_counts_all_worker_owned_queues_globally(self):
        conn = _FakeConn()
        with patch.object(parse_jobs, "db", lambda: _FakeDb(conn)):
            status = parse_jobs.get_worker_status(None)

        self.assertTrue(status["online"])
        self.assertEqual(status["parse_queued_count"], 2)
        self.assertEqual(status["campaign_match_queued_count"], 4)
        self.assertEqual(status["candidate_upload_queued_count"], 8)
        self.assertEqual(status["queued_count"], 14)
        self.assertEqual(status["running_count"], 15)
        self.assertEqual(status["failed_count"], 19)
        self.assertEqual(status["dead_letter_count"], 11)

    def test_tenant_worker_status_does_not_mix_candidate_portal_uploads(self):
        conn = _FakeConn()
        with patch.object(parse_jobs, "db", lambda: _FakeDb(conn)):
            status = parse_jobs.get_worker_status("00000000-0000-0000-0000-000000000001")

        self.assertFalse(conn.queried_candidate_uploads)
        self.assertEqual(status["candidate_upload_queued_count"], 0)
        self.assertEqual(status["queued_count"], 6)


if __name__ == "__main__":
    unittest.main()
