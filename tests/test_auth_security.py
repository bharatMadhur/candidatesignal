from __future__ import annotations

import base64
import hashlib
import hmac
import os
import unittest
from pathlib import Path
from tempfile import NamedTemporaryFile
from unittest.mock import patch

import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from fastapi import HTTPException

from resume_intel import web
from resume_intel.auth import _better_auth_secret, _session_token_from_bearer, _user_context
from resume_intel.routers import health as health_router
from resume_intel.tenancy import _is_platform_role, normalize_email, require_tenant_admin, require_tenant_write, validate_tenant_creation_request
from resume_intel.web import _can_view_pii, _redact_campaign_pii, _redact_copilot_thread_pii, _redact_summary_pii


def _signed_better_auth_token(raw_token: str, secret: str) -> str:
    digest = hmac.new(secret.encode(), raw_token.encode(), hashlib.sha256).digest()
    return f"{raw_token}.{base64.b64encode(digest).decode()}"


class _HealthResult:
    def fetchone(self):
        return {"ok": 1}


class _HealthConnection:
    def execute(self, *_args, **_kwargs):
        return _HealthResult()


class _HealthDb:
    def __enter__(self):
        return _HealthConnection()

    def __exit__(self, *args: object) -> None:
        return None


class _SingleRowResult:
    def __init__(self, row):
        self.row = row

    def fetchone(self):
        return self.row


class _SingleRowConnection:
    def __init__(self, row):
        self.row = row

    def execute(self, *_args, **_kwargs):
        return _SingleRowResult(self.row)


class BetterAuthSecurityTests(unittest.TestCase):
    def test_accepts_signed_better_auth_bearer_token(self) -> None:
        secret = "unit-test-secret"
        raw_token = "session-token-123"
        with patch.dict(os.environ, {"BETTER_AUTH_SECRET": secret}, clear=False):
            self.assertEqual(_session_token_from_bearer(_signed_better_auth_token(raw_token, secret)), raw_token)

    def test_rejects_unsigned_bearer_by_default(self) -> None:
        with patch.dict(os.environ, {"RESUME_INTEL_ALLOW_UNSIGNED_BETTER_AUTH_BEARER": ""}, clear=False):
            with self.assertRaises(HTTPException) as raised:
                _session_token_from_bearer("raw-session-token")
        self.assertEqual(raised.exception.status_code, 401)

    def test_rejects_tampered_signed_bearer(self) -> None:
        with patch.dict(os.environ, {"BETTER_AUTH_SECRET": "unit-test-secret"}, clear=False):
            with self.assertRaises(HTTPException) as raised:
                _session_token_from_bearer("session-token.bad-signature")
        self.assertEqual(raised.exception.status_code, 401)

    def test_requires_real_better_auth_secret_in_production(self) -> None:
        with patch.dict(
            os.environ,
            {
                "APP_ENV": "production",
                "BETTER_AUTH_SECRET": "",
                "RESUME_INTEL_BETTER_AUTH_SECRET": "",
            },
            clear=False,
        ):
            with self.assertRaises(RuntimeError):
                _better_auth_secret()

    def test_reads_better_auth_secret_from_file(self) -> None:
        with NamedTemporaryFile("w") as secret_file:
            secret_file.write("file-backed-secret-value")
            secret_file.flush()
            with patch.dict(os.environ, {"BETTER_AUTH_SECRET": "", "BETTER_AUTH_SECRET_FILE": secret_file.name}, clear=False):
                self.assertEqual(_better_auth_secret(), "file-backed-secret-value")

    def test_candidate_workspace_persona_keeps_recruiter_role_intact(self) -> None:
        row = {
            "id": "user-1",
            "email": "person@example.com",
            "platform_role": "recruiter",
            "name": "Person",
            "active_tenant_id": None,
            "active_workspace_access": "candidate",
            "has_candidate_profile": True,
            "member_tenant_role": "recruiter",
            "member_membership_status": "active",
            "member_tenant_id": "tenant-1",
            "member_tenant_name": "Acme",
            "member_tenant_status": "active",
            "active_tenant_id": None,
            "active_tenant_name": None,
            "active_tenant_status": None,
        }

        user = _user_context(_SingleRowConnection(row), "session-token")

        self.assertEqual(user["workspace_access"], "candidate")
        self.assertEqual(user["role"], "candidate")
        self.assertEqual(user["platform_role"], "recruiter")
        self.assertIsNone(user["tenant_id"])

    def test_recruiter_workspace_persona_remains_tenant_scoped(self) -> None:
        row = {
            "id": "user-1",
            "email": "person@example.com",
            "platform_role": "recruiter",
            "name": "Person",
            "active_tenant_id": None,
            "active_workspace_access": None,
            "has_candidate_profile": True,
            "member_tenant_role": "recruiter",
            "member_membership_status": "active",
            "member_tenant_id": "tenant-1",
            "member_tenant_name": "Acme",
            "member_tenant_status": "active",
            "active_tenant_name": None,
            "active_tenant_status": None,
        }

        user = _user_context(_SingleRowConnection(row), "session-token")

        self.assertEqual(user["workspace_access"], "tenant_member")
        self.assertEqual(user["role"], "recruiter")
        self.assertEqual(user["platform_role"], "recruiter")
        self.assertEqual(user["tenant_id"], "tenant-1")

    def test_platform_admin_cannot_satisfy_tenant_permissions(self) -> None:
        platform_admin = {"platform_role": "platform_admin", "role": "platform_admin", "tenant_role": None}
        with self.assertRaises(HTTPException):
            require_tenant_write(platform_admin)
        with self.assertRaises(HTTPException):
            require_tenant_admin(platform_admin)

    def test_platform_admin_cannot_view_candidate_pii_without_tenant_membership(self) -> None:
        platform_admin = {"platform_role": "platform_admin", "role": "platform_admin", "tenant_role": None, "tenant_id": None}
        self.assertFalse(_can_view_pii(platform_admin))

    def test_team_endpoint_does_not_expose_member_management_to_recruiters(self) -> None:
        recruiter = {"id": "user-1", "tenant_id": "tenant-1", "tenant_name": "Acme", "tenant_role": "recruiter"}
        with (
            patch.object(web, "list_members", side_effect=AssertionError("members should be admin-only")),
            patch.object(web, "list_invitations", side_effect=AssertionError("invites should be admin-only")),
            patch.object(web, "list_pii_access_events", side_effect=AssertionError("pii audit should be admin-only")),
            patch.object(web, "get_tenant_governance_policy", return_value={"external_llm_synthesis_enabled": False}),
        ):
            result = web.team(recruiter)

        self.assertEqual(result["members"], [])
        self.assertEqual(result["invitations"], [])
        self.assertEqual(result["pii_access_events"], [])

    def test_recruiter_cannot_read_worker_operations_status(self) -> None:
        recruiter = {"id": "user-1", "tenant_id": "tenant-1", "tenant_role": "recruiter"}
        with self.assertRaises(HTTPException) as raised:
            web.parse_worker_status(recruiter)

        self.assertEqual(raised.exception.status_code, 403)

    def test_platform_roles_are_not_company_membership_roles(self) -> None:
        self.assertTrue(_is_platform_role("platform_admin"))
        self.assertTrue(_is_platform_role("admin"))
        self.assertFalse(_is_platform_role("tenant_owner"))
        self.assertFalse(_is_platform_role("recruiter"))

    def test_admin_company_creation_validation_blocks_bad_owner_email(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            validate_tenant_creation_request("Acme", 5, "owner@local", "tenant_owner")
        self.assertEqual(raised.exception.status_code, 400)

    def test_admin_company_creation_validation_blocks_invalid_owner_role_before_create(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            validate_tenant_creation_request("Acme", 5, "owner@example.com", "recruiter")
        self.assertEqual(raised.exception.status_code, 400)

    def test_normalize_email_accepts_valid_email(self) -> None:
        self.assertEqual(normalize_email(" Owner@Example.com "), "owner@example.com")

    def test_summary_pii_redaction_cleans_raw_evidence_snippets(self) -> None:
        redacted = _redact_summary_pii(
            {
                "name": "Pranjal Shah",
                "email": "candidate@example.com",
                "phone": "555-111-2222",
                "evidence": [
                    {
                        "chunk_type": "raw_text",
                        "snippet": "Pranjal Shah email candidate@example.com portfolio https://example.com phone 555-111-2222",
                    },
                    {"chunk_type": "contact_pii", "snippet": "candidate@example.com"},
                ],
            }
        )

        self.assertEqual(redacted["email"], "[redacted]")
        self.assertEqual(redacted["phone"], "[redacted]")
        self.assertNotIn("candidate@example.com", redacted["evidence"][0]["snippet"])
        self.assertNotIn("https://example.com", redacted["evidence"][0]["snippet"])
        self.assertNotIn("Pranjal Shah", redacted["evidence"][0]["snippet"])
        self.assertEqual(redacted["evidence"][1]["snippet"], "[PII evidence redacted]")

    def test_campaign_payload_redacts_nested_candidate_pii(self) -> None:
        campaign = {
            "id": "campaign-1",
            "candidates": [
                {
                    "candidate_id": "doc-1",
                    "candidate": {
                        "name": "Candidate One",
                        "email": "candidate@example.com",
                        "phone": "555-111-2222",
                        "evidence": [{"chunk_type": "contact_pii", "snippet": "candidate@example.com"}],
                    },
                }
            ],
        }

        redacted = _redact_campaign_pii(campaign)

        nested = redacted["candidates"][0]["candidate"]
        self.assertEqual(nested["email"], "[redacted]")
        self.assertEqual(nested["phone"], "[redacted]")
        self.assertEqual(nested["evidence"][0]["snippet"], "[PII evidence redacted]")
        self.assertEqual(campaign["candidates"][0]["candidate"]["email"], "candidate@example.com")

    def test_copilot_thread_payload_redacts_saved_candidate_snapshots(self) -> None:
        thread = {
            "id": "thread-1",
            "messages": [
                {
                    "role": "assistant",
                    "candidates": [
                        {
                            "name": "Candidate Two",
                            "email": "two@example.com",
                            "phone": "555-222-3333",
                            "evidence": [
                                {
                                    "chunk_type": "raw_text",
                                    "snippet": "Candidate Two can be reached at two@example.com or 555-222-3333",
                                }
                            ],
                        }
                    ],
                }
            ],
        }

        redacted = _redact_copilot_thread_pii(thread)

        candidate = redacted["messages"][0]["candidates"][0]
        self.assertEqual(candidate["email"], "[redacted]")
        self.assertEqual(candidate["phone"], "[redacted]")
        self.assertNotIn("two@example.com", candidate["evidence"][0]["snippet"])
        self.assertNotIn("Candidate Two", candidate["evidence"][0]["snippet"])

    def test_deep_health_reports_latest_migration(self) -> None:
        with (
            patch.object(health_router, "db", lambda: _HealthDb()),
            patch.object(health_router, "applied_migrations", return_value=[{"version": "baseline"}, {"version": "20260513_0005"}]),
        ):
            payload = health_router.healthz_deep()

        self.assertTrue(payload["ok"])
        self.assertEqual(payload["database"], "ready")
        self.assertEqual(payload["migrations"]["applied_count"], 2)
        self.assertEqual(payload["migrations"]["latest"], "20260513_0005")


if __name__ == "__main__":
    unittest.main()
