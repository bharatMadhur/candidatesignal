from __future__ import annotations

import sys
import unittest
from pathlib import Path
from typing import Any


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel import collaboration
from resume_intel import web


class _Result:
    def __init__(self, row: dict[str, Any] | None = None, rows: list[dict[str, Any]] | None = None) -> None:
        self.row = row
        self.rows = rows

    def fetchone(self) -> dict[str, Any] | None:
        return self.row

    def fetchall(self) -> list[dict[str, Any]]:
        if self.rows is not None:
            return self.rows
        return [] if self.row is None else [self.row]


class _FakeConnection:
    def __init__(self) -> None:
        self.executed: list[tuple[str, tuple[Any, ...]]] = []
        self.notifications: list[tuple[Any, ...]] = []
        self.audits: list[tuple[Any, ...]] = []
        self.committed = False

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> _Result:
        self.executed.append((sql, params))
        normalized = " ".join(sql.lower().split())
        if "select document_id from candidates" in normalized:
            return _Result({"document_id": "doc-1"})
        if "select id from job_campaigns" in normalized:
            return _Result({"id": "campaign-1"})
        if "select id, campaign_id, candidate_id from campaign_candidates" in normalized:
            return _Result({"id": "link-1", "campaign_id": "campaign-1", "candidate_id": "doc-1"})
        if "select users.id, users.email, users.name" in normalized and "users.id=%s" in normalized:
            return _Result({"id": params[0], "email": "assignee@example.com", "name": "Assignee"})
        if "lower(users.email) = any" in normalized:
            return _Result(rows=[{"id": "mentioned-user", "email": "teammate@example.com"}])
        if "insert into collaboration_comments" in normalized:
            return _Result({
                "id": "comment-1",
                "tenant_id": "tenant-1",
                "entity_type": params[1],
                "entity_id": params[2],
                "document_id": params[3],
                "campaign_id": params[4],
                "campaign_candidate_id": params[5],
                "user_id": params[6],
                "user_email": "recruiter@example.com",
                "user_name": "Recruiter",
                "body": params[7],
                "visibility": params[8],
                "metadata": {},
                "created_at": None,
                "updated_at": None,
            })
        if "insert into recruiter_tasks" in normalized:
            return _Result({
                "id": "task-1",
                "tenant_id": "tenant-1",
                "entity_type": params[1],
                "entity_id": params[2],
                "document_id": params[3],
                "campaign_id": params[4],
                "campaign_candidate_id": params[5],
                "title": params[6],
                "body": params[7],
                "priority": params[8],
                "due_at": None,
                "assignee_user_id": params[10],
                "created_by_user_id": params[11],
                "status": "open",
                "completed_at": None,
                "metadata": {},
                "assignee_email": "assignee@example.com",
                "assignee_name": "Assignee",
                "created_by_email": "recruiter@example.com",
                "created_by_name": "Recruiter",
                "created_at": None,
                "updated_at": None,
            })
        if "insert into recruiter_notifications" in normalized:
            self.notifications.append(params)
            return _Result()
        if "insert into audit_logs" in normalized:
            self.audits.append(params)
            return _Result()
        return _Result()

    def commit(self) -> None:
        self.committed = True


class _FakeDb:
    def __init__(self, connection: _FakeConnection) -> None:
        self.connection = connection

    def __enter__(self) -> _FakeConnection:
        return self.connection

    def __exit__(self, *args: object) -> None:
        return None


class CollaborationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_db = collaboration.db

    def tearDown(self) -> None:
        collaboration.db = self.original_db

    def test_comment_is_tenant_scoped_and_mentions_notify_team_member(self) -> None:
        connection = _FakeConnection()
        collaboration.db = lambda: _FakeDb(connection)

        comment = collaboration.create_comment(
            "tenant-1",
            "user-1",
            "candidate",
            "doc-1",
            "Please review @teammate@example.com",
            "team",
        )

        self.assertEqual(comment["id"], "comment-1")
        self.assertEqual(comment["document_id"], "doc-1")
        self.assertEqual(len(connection.notifications), 1)
        self.assertEqual(connection.notifications[0][1], "mentioned-user")
        self.assertEqual(connection.notifications[0][3], "comment.mentioned")
        self.assertTrue(connection.audits)
        self.assertTrue(connection.committed)

    def test_task_assignment_creates_assignee_notification(self) -> None:
        connection = _FakeConnection()
        collaboration.db = lambda: _FakeDb(connection)

        task = collaboration.create_task(
            "tenant-1",
            "user-1",
            "campaign_candidate",
            "link-1",
            "Follow up with candidate",
            body="Ask about work authorization",
            assignee_user_id="assignee-user",
            priority="high",
        )

        self.assertEqual(task["status"], "open")
        self.assertEqual(task["priority"], "high")
        self.assertEqual(task["campaign_candidate_id"], "link-1")
        self.assertEqual(len(connection.notifications), 1)
        self.assertEqual(connection.notifications[0][1], "assignee-user")
        self.assertEqual(connection.notifications[0][3], "task.assigned")
        self.assertTrue(connection.committed)

    def test_invalid_collaboration_entity_is_rejected_before_write(self) -> None:
        connection = _FakeConnection()
        collaboration.db = lambda: _FakeDb(connection)

        with self.assertRaises(ValueError):
            collaboration.create_comment("tenant-1", "user-1", "invalid", "doc-1", "hello")

        self.assertFalse(any("insert into collaboration_comments" in sql.lower() for sql, _ in connection.executed))

    def test_private_candidate_notes_are_visible_only_to_the_author(self) -> None:
        user = {"id": "user-1", "tenant_id": "tenant-1", "tenant_role": "recruiter"}
        record = {
            "document_id": "doc-1",
            "notes": [
                {"id": "note-1", "user_id": "user-1", "visibility": "private", "content": "mine"},
                {"id": "note-2", "user_id": "user-2", "visibility": "private", "content": "other"},
                {"id": "note-3", "user_id": "user-2", "visibility": "team", "content": "team"},
            ],
        }

        original_public = web.public_candidate_record
        original_can_view_pii = web._can_view_pii
        try:
            web.public_candidate_record = lambda payload, **_kwargs: dict(payload)
            web._can_view_pii = lambda _user: False
            public = web._public_candidate_for_user(record, user)
        finally:
            web.public_candidate_record = original_public
            web._can_view_pii = original_can_view_pii

        self.assertEqual([note["id"] for note in public["notes"]], ["note-1", "note-3"])

    def test_recruiter_note_create_does_not_send_update_only_kwargs(self) -> None:
        user = {"id": "user-1", "tenant_id": "tenant-1", "tenant_role": "recruiter"}
        captured: dict[str, Any] = {}

        def fake_add_note_db(*args: Any, **kwargs: Any) -> dict[str, Any]:
            captured["args"] = args
            captured["kwargs"] = kwargs
            return {
                "document_id": "doc-1",
                "notes": [{"id": "note-1", "user_id": "user-1", "visibility": "team", "content": "OPT"}],
            }

        original_add_note_db = web.add_note_db
        original_schedule = web._schedule_candidate_search_reindex
        original_public = web._public_candidate_for_user
        try:
            web.add_note_db = fake_add_note_db
            web._schedule_candidate_search_reindex = lambda *_args, **_kwargs: None
            web._public_candidate_for_user = lambda payload, _user: payload
            result = web.create_note(
                "doc-1",
                web.NoteRequest(name="Concern", content="OPT", visibility="team"),
                object(),  # type: ignore[arg-type]
                user,
            )
        finally:
            web.add_note_db = original_add_note_db
            web._schedule_candidate_search_reindex = original_schedule
            web._public_candidate_for_user = original_public

        self.assertEqual(result["notes"][0]["id"], "note-1")
        self.assertNotIn("can_manage_any_note", captured["kwargs"])
        self.assertFalse(captured["kwargs"]["reindex_search"])


if __name__ == "__main__":
    unittest.main()
