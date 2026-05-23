from __future__ import annotations

import os
import unittest
from tempfile import NamedTemporaryFile
from unittest.mock import Mock, patch

from resume_intel.mail_service import ResendMailProvider, build_invitation_mail, invitation_url, resend_payload
from resume_intel.settings import load_settings


class MailServiceTests(unittest.TestCase):
    def test_invitation_url_uses_app_base_url(self) -> None:
        with patch.dict(os.environ, {"RESUME_INTEL_APP_BASE_URL": "https://app.example.com"}, clear=True), patch("resume_intel.settings.load_dotenv"):
            settings = load_settings()

        self.assertEqual(invitation_url("token-123", settings=settings), "https://app.example.com/?invite=token-123")

    def test_invitation_email_contains_accept_link_and_role(self) -> None:
        with patch.dict(os.environ, {"RESUME_INTEL_APP_BASE_URL": "https://app.example.com"}, clear=True), patch("resume_intel.settings.load_dotenv"):
            settings = load_settings()
        draft = build_invitation_mail(
            invitation={"id": "invite-1", "tenant_id": "tenant-1", "email": "user@example.com", "role": "tenant_admin"},
            invite_token="token-123",
            tenant_name="Example Co",
            actor_name="Admin User",
            message_type="team_invitation",
            settings=settings,
        )

        self.assertEqual(draft.to_email, "user@example.com")
        self.assertIn("Example Co", draft.subject)
        self.assertIn("https://app.example.com/?invite=token-123", draft.text_body)
        self.assertIn("tenant admin", draft.html_body)

    def test_resend_payload_uses_from_header(self) -> None:
        payload = resend_payload(
            {
                "from_email": "no-reply@example.com",
                "from_name": "candidateSignal.ai",
                "to_email": "user@example.com",
                "subject": "Invite",
                "text_body": "Text",
                "html_body": "<p>Text</p>",
                "reply_to": "support@example.com",
            }
        )

        self.assertEqual(payload["from"], "candidateSignal.ai <no-reply@example.com>")
        self.assertEqual(payload["to"], ["user@example.com"])
        self.assertEqual(payload["reply_to"], "support@example.com")

    def test_resend_provider_posts_to_resend(self) -> None:
        response = Mock()
        response.content = b'{"id":"email-123"}'
        response.json.return_value = {"id": "email-123"}
        response.raise_for_status.return_value = None
        with (
            patch.dict(
                os.environ,
                {
                    "RESUME_INTEL_MAIL_ENABLED": "1",
                    "RESUME_INTEL_MAIL_DRY_RUN": "0",
                    "RESEND_API_KEY": "re_test",
                },
                clear=True,
            ),
            patch("resume_intel.settings.load_dotenv"),
            patch("resume_intel.mail_service.httpx.post", return_value=response) as post,
        ):
            settings = load_settings()
            result = ResendMailProvider().send(
                {
                    "from_email": "no-reply@example.com",
                    "from_name": "candidateSignal.ai",
                    "to_email": "user@example.com",
                    "subject": "Invite",
                    "text_body": "Text",
                    "html_body": "<p>Text</p>",
                    "reply_to": None,
                },
                settings,
            )

        self.assertEqual(result.status, "sent")
        self.assertEqual(result.provider_message_id, "email-123")
        self.assertEqual(post.call_args.kwargs["headers"]["Authorization"], "Bearer re_test")

    def test_resend_api_key_can_be_loaded_from_secret_file(self) -> None:
        with NamedTemporaryFile("w") as secret_file:
            secret_file.write("re_file")
            secret_file.flush()
            with patch.dict(os.environ, {"RESEND_API_KEY_FILE": secret_file.name}, clear=True), patch("resume_intel.settings.load_dotenv"):
                settings = load_settings()

        self.assertEqual(settings.resend_api_key, "re_file")


if __name__ == "__main__":
    unittest.main()
