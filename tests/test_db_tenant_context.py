from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.db import (
    current_db_internal_access,
    current_db_tenant_id,
    db,
    db_internal_access,
    reset_db_internal_access,
    reset_db_tenant_context,
    set_db_internal_access,
    set_db_tenant_context,
)


class _FakeConnection:
    def __init__(self) -> None:
        self.executed: list[tuple[str, tuple[object, ...]]] = []

    def __enter__(self) -> "_FakeConnection":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, sql: str, params: tuple[object, ...] = ()) -> "_FakeConnection":
        self.executed.append((" ".join(sql.lower().split()), params))
        return self


class DbTenantContextTests(unittest.TestCase):
    def test_db_sets_postgres_tenant_context_when_request_context_has_tenant(self) -> None:
        connection = _FakeConnection()
        token = set_db_tenant_context("tenant-123")
        try:
            with patch("resume_intel.db.database_url", return_value="postgres://test"), patch("resume_intel.db.psycopg.connect", return_value=connection):
                with db():
                    pass
        finally:
            reset_db_tenant_context(token)

        self.assertEqual(connection.executed[0], ("set local role resume_intel_app_runtime", ()))
        self.assertEqual(connection.executed[1], ("select set_config('app.current_tenant_id', %s, true)", ("tenant-123",)))
        self.assertEqual(connection.executed[2], ("select set_config('app.internal_access', %s, true)", ("false",)))

    def test_db_clears_tenant_context_for_platform_or_candidate_contexts(self) -> None:
        connection = _FakeConnection()
        token = set_db_tenant_context(None)
        try:
            with patch("resume_intel.db.database_url", return_value="postgres://test"), patch("resume_intel.db.psycopg.connect", return_value=connection):
                with db():
                    pass
        finally:
            reset_db_tenant_context(token)

        self.assertEqual(connection.executed[0], ("set local role resume_intel_app_runtime", ()))
        self.assertEqual(connection.executed[1], ("select set_config('app.current_tenant_id', %s, true)", ("",)))
        self.assertEqual(connection.executed[2], ("select set_config('app.internal_access', %s, true)", ("false",)))

    def test_db_sets_internal_access_explicitly(self) -> None:
        connection = _FakeConnection()

        with patch("resume_intel.db.database_url", return_value="postgres://test"), patch("resume_intel.db.psycopg.connect", return_value=connection):
            with db(internal=True):
                pass

        self.assertEqual(connection.executed[0], ("set local role resume_intel_app_runtime", ()))
        self.assertEqual(connection.executed[2], ("select set_config('app.internal_access', %s, true)", ("true",)))

    def test_db_can_skip_runtime_role_for_migrations(self) -> None:
        connection = _FakeConnection()

        with patch("resume_intel.db.database_url", return_value="postgres://test"), patch("resume_intel.db.psycopg.connect", return_value=connection):
            with db(internal=True, apply_runtime_role=False):
                pass

        self.assertFalse(any("set local role" in sql for sql, _params in connection.executed))
        self.assertEqual(connection.executed[1], ("select set_config('app.internal_access', %s, true)", ("true",)))

    def test_internal_access_context_resets(self) -> None:
        token = set_db_internal_access(True)
        try:
            self.assertTrue(current_db_internal_access())
            reset_db_internal_access(token)
            self.assertFalse(current_db_internal_access())
        finally:
            if current_db_internal_access():
                reset_db_internal_access(token)

    def test_internal_access_context_manager(self) -> None:
        self.assertFalse(current_db_internal_access())
        with db_internal_access():
            self.assertTrue(current_db_internal_access())
        self.assertFalse(current_db_internal_access())

    def test_context_reset_restores_previous_tenant(self) -> None:
        outer = set_db_tenant_context("tenant-a")
        inner = set_db_tenant_context("tenant-b")
        try:
            self.assertEqual(current_db_tenant_id(), "tenant-b")
            reset_db_tenant_context(inner)
            self.assertEqual(current_db_tenant_id(), "tenant-a")
        finally:
            reset_db_tenant_context(outer)


if __name__ == "__main__":
    unittest.main()
