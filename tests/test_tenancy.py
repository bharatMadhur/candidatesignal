from __future__ import annotations

import sys
import unittest
from pathlib import Path
from datetime import datetime, timezone
from typing import Any
from unittest.mock import patch

from fastapi import HTTPException


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel import tenancy
from resume_intel.tenancy import _assert_active_seat_available, _assert_seat_available


class _Result:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.row = row

    def fetchone(self) -> dict[str, Any] | None:
        return self.row


class _FakeSeatConnection:
    def __init__(self, *, seat_limit: int, active_members: int, pending_invites: int = 0) -> None:
        self.seat_limit = seat_limit
        self.active_members = active_members
        self.pending_invites = pending_invites

    def execute(self, sql: str, _params: tuple[Any, ...]) -> _Result:
        if "pending_invites" in sql:
            return _Result(
                {
                    "seat_limit": self.seat_limit,
                    "active_members": self.active_members,
                    "pending_invites": self.pending_invites,
                }
            )
        return _Result({"seat_limit": self.seat_limit, "active_members": self.active_members})


class _FakeDb:
    def __init__(self, connection: Any) -> None:
        self.connection = connection

    def __enter__(self) -> Any:
        return self.connection

    def __exit__(self, *args: object) -> None:
        return None


class _UnavailableInviteeConnection:
    def __init__(self) -> None:
        self.executed: list[str] = []
        self.committed = False

    def execute(self, sql: str, _params: tuple[Any, ...]) -> _Result:
        self.executed.append(" ".join(sql.lower().split()))
        if "from users" in self.executed[-1]:
            return _Result({"role": "recruiter", "tenant_name": "Existing Company"})
        return _Result(None)

    def commit(self) -> None:
        self.committed = True


class _SelfSignupConnection:
    def __init__(self) -> None:
        self.executed: list[str] = []
        self.committed = False

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> _Result:
        normalized = " ".join(sql.lower().split())
        self.executed.append(normalized)
        if "select users.role" in normalized:
            return _Result(None)
        if "from tenant_invitations" in normalized:
            return _Result(None)
        if "insert into users" in normalized:
            return _Result(
                {
                    "id": "user-1",
                    "email": params[0],
                    "role": "recruiter",
                    "name": params[2],
                    "created_at": datetime(2026, 5, 23, tzinfo=timezone.utc),
                }
            )
        if "select 1 from tenants" in normalized:
            return _Result(None)
        if "insert into tenants" in normalized:
            return _Result(
                {
                    "id": "tenant-1",
                    "name": params[0],
                    "slug": params[1],
                    "status": "active",
                    "plan": params[2],
                    "seat_limit": params[3],
                    "created_at": datetime(2026, 5, 23, tzinfo=timezone.utc),
                    "updated_at": datetime(2026, 5, 23, tzinfo=timezone.utc),
                }
            )
        return _Result(None)

    def commit(self) -> None:
        self.committed = True


class TenancySeatTests(unittest.TestCase):
    def test_invite_creation_counts_pending_invites_as_reserved_seats(self) -> None:
        conn = _FakeSeatConnection(seat_limit=2, active_members=1, pending_invites=1)

        with self.assertRaises(HTTPException) as raised:
            _assert_seat_available(conn, "tenant-1")

        self.assertEqual(raised.exception.status_code, 409)

    def test_invite_acceptance_allows_the_reserved_final_seat(self) -> None:
        conn = _FakeSeatConnection(seat_limit=2, active_members=1, pending_invites=1)

        _assert_active_seat_available(conn, "tenant-1")

    def test_invite_acceptance_blocks_when_active_members_already_full(self) -> None:
        conn = _FakeSeatConnection(seat_limit=2, active_members=2, pending_invites=0)

        with self.assertRaises(HTTPException) as raised:
            _assert_active_seat_available(conn, "tenant-1")

        self.assertEqual(raised.exception.status_code, 409)

    def test_create_tenant_with_owner_invitation_preflights_owner_before_insert(self) -> None:
        connection = _UnavailableInviteeConnection()
        original_db = tenancy.db
        try:
            tenancy.db = lambda: _FakeDb(connection)
            with self.assertRaises(HTTPException) as raised:
                tenancy.create_tenant_with_owner_invitation(
                    "Should Not Persist",
                    5,
                    "admin-user",
                    "existing@example.com",
                    "tenant_owner",
                )
        finally:
            tenancy.db = original_db

        self.assertEqual(raised.exception.status_code, 409)
        self.assertFalse(any("insert into tenants" in sql for sql in connection.executed))
        self.assertFalse(connection.committed)

    def test_self_service_signup_creates_tenant_owner_in_one_transaction(self) -> None:
        connection = _SelfSignupConnection()
        original_db = tenancy.db
        try:
            tenancy.db = lambda: _FakeDb(connection)
            with patch.dict("os.environ", {"RESUME_INTEL_SELF_SIGNUP_ENABLED": "1", "RESUME_INTEL_SELF_SIGNUP_SEAT_LIMIT": "5"}):
                result = tenancy.create_self_service_company(
                    company_name="Acme Recruiting",
                    owner_name="Madhur Agarwal",
                    owner_email=" Owner@Acme.com ",
                    password="strong-password",
                )
        finally:
            tenancy.db = original_db

        self.assertTrue(connection.committed)
        self.assertEqual(result["tenant"]["name"], "Acme Recruiting")
        self.assertEqual(result["tenant"]["plan"], "self_service_free")
        self.assertEqual(result["tenant"]["seat_limit"], 5)
        self.assertEqual(result["user"]["email"], "owner@acme.com")
        self.assertEqual(result["user"]["tenant_role"], "tenant_owner")
        self.assertTrue(any("insert into accounts" in sql for sql in connection.executed))
        self.assertTrue(any("insert into tenant_memberships" in sql for sql in connection.executed))

    def test_self_service_signup_can_be_disabled_without_touching_database(self) -> None:
        connection = _SelfSignupConnection()
        original_db = tenancy.db
        try:
            tenancy.db = lambda: _FakeDb(connection)
            with patch.dict("os.environ", {"RESUME_INTEL_SELF_SIGNUP_ENABLED": "0"}):
                with self.assertRaises(HTTPException) as raised:
                    tenancy.create_self_service_company(
                        company_name="Acme",
                        owner_name="Owner",
                        owner_email="owner@example.com",
                        password="strong-password",
                    )
        finally:
            tenancy.db = original_db

        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(connection.executed, [])


if __name__ == "__main__":
    unittest.main()
