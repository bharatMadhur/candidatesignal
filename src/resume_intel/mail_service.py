from __future__ import annotations

import html
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

import httpx
from psycopg.types.json import Jsonb

from .db import db
from .settings import Settings, load_settings


logger = logging.getLogger(__name__)


class MailError(RuntimeError):
    """Raised when an email provider cannot accept a message."""


@dataclass(frozen=True)
class MailDraft:
    message_type: str
    to_email: str
    subject: str
    text_body: str
    html_body: str
    tenant_id: str | None = None
    user_id: str | None = None
    reply_to: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class MailDeliveryResult:
    status: str
    provider: str
    provider_message_id: str | None = None
    provider_response: dict[str, Any] = field(default_factory=dict)
    error_message: str | None = None


class MailProvider:
    provider = "base"

    def send(self, row: dict[str, Any], settings: Settings) -> MailDeliveryResult:
        raise NotImplementedError


class DisabledMailProvider(MailProvider):
    provider = "disabled"

    def send(self, row: dict[str, Any], settings: Settings) -> MailDeliveryResult:
        return MailDeliveryResult(status="skipped", provider=self.provider, error_message="mail delivery is disabled")


class DryRunMailProvider(MailProvider):
    provider = "dry_run"

    def send(self, row: dict[str, Any], settings: Settings) -> MailDeliveryResult:
        return MailDeliveryResult(
            status="dry_run",
            provider=self.provider,
            provider_response={
                "to": row["to_email"],
                "subject": row["subject"],
                "message": "mail dry run; no provider call was made",
            },
        )


class ResendMailProvider(MailProvider):
    provider = "resend"
    endpoint = "https://api.resend.com/emails"

    def send(self, row: dict[str, Any], settings: Settings) -> MailDeliveryResult:
        if not settings.resend_api_key:
            raise MailError("RESEND_API_KEY is not configured")
        payload = resend_payload(row)
        response = httpx.post(
            self.endpoint,
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=settings.mail_timeout_seconds,
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            body = response.text[:1000] if response.text else ""
            raise MailError(f"resend rejected message with {response.status_code}: {body}") from exc
        data = _safe_json(response)
        return MailDeliveryResult(
            status="sent",
            provider=self.provider,
            provider_message_id=str(data.get("id") or "") or None,
            provider_response=data,
        )


def resend_payload(row: dict[str, Any]) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "from": _from_header(row.get("from_email") or "", row.get("from_name")),
        "to": [row["to_email"]],
        "subject": row["subject"],
        "text": row.get("text_body") or "",
        "html": row.get("html_body") or "",
    }
    if row.get("reply_to"):
        payload["reply_to"] = row["reply_to"]
    return payload


def queue_mail(draft: MailDraft, *, settings: Settings | None = None) -> dict[str, Any]:
    settings = settings or load_settings()
    status = "queued" if settings.mail_enabled else "skipped"
    provider = _configured_provider_name(settings)
    with db() as conn:
        row = conn.execute(
            """
            insert into mail_messages (
              tenant_id, user_id, provider, message_type, status, to_email,
              from_email, from_name, subject, text_body, html_body, reply_to, metadata
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            returning *
            """,
            (
                draft.tenant_id,
                draft.user_id,
                provider,
                draft.message_type,
                status,
                draft.to_email.strip().lower(),
                settings.mail_from_email,
                settings.mail_from_name,
                draft.subject,
                draft.text_body,
                draft.html_body,
                draft.reply_to or settings.mail_reply_to or None,
                Jsonb(draft.metadata),
            ),
        ).fetchone()
        if not settings.mail_enabled:
            _insert_mail_event(
                conn,
                str(row["id"]),
                draft.tenant_id,
                provider,
                "skipped",
                {"reason": "mail delivery is disabled"},
            )
        conn.commit()
    return public_mail_message(row)


def send_mail_message(message_id: str, *, settings: Settings | None = None) -> dict[str, Any]:
    settings = settings or load_settings()
    with db() as conn:
        row = conn.execute("select * from mail_messages where id=%s", (message_id,)).fetchone()
        if not row:
            raise FileNotFoundError(message_id)
        if row["status"] not in {"queued", "failed", "retrying"}:
            return public_mail_message(row)
        conn.execute(
            "update mail_messages set status='sending', updated_at=now(), error_message=null where id=%s",
            (message_id,),
        )
        conn.commit()

    result: MailDeliveryResult
    try:
        result = _provider(settings).send(row, settings)
    except Exception as exc:  # Provider failures must be persisted, not hidden.
        logger.exception("Mail delivery failed", extra={"mail_message_id": message_id, "provider": row["provider"]})
        result = MailDeliveryResult(status="failed", provider=row["provider"], error_message=str(exc))

    with db() as conn:
        updated = conn.execute(
            """
            update mail_messages
            set status=%s,
                provider=%s,
                provider_message_id=%s,
                provider_response=%s,
                error_message=%s,
                sent_at=case when %s='sent' then now() else sent_at end,
                updated_at=now()
            where id=%s
            returning *
            """,
            (
                result.status,
                result.provider,
                result.provider_message_id,
                Jsonb(result.provider_response),
                result.error_message,
                result.status,
                message_id,
            ),
        ).fetchone()
        _insert_mail_event(
            conn,
            str(updated["id"]),
            str(updated["tenant_id"]) if updated["tenant_id"] else None,
            result.provider,
            result.status,
            {
                "provider_message_id": result.provider_message_id,
                "error_message": result.error_message,
                "provider_response": result.provider_response,
            },
        )
        conn.commit()
    return public_mail_message(updated)


def send_mail_message_safe(message_id: str) -> None:
    try:
        send_mail_message(message_id)
    except FileNotFoundError:
        logger.warning("Queued mail message disappeared before delivery", extra={"mail_message_id": message_id})


def retry_mail_message(message_id: str, tenant_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            update mail_messages
            set status='retrying', error_message=null, updated_at=now()
            where id=%s and tenant_id=%s and status in ('failed', 'skipped', 'dry_run')
            returning *
            """,
            (message_id, tenant_id),
        ).fetchone()
        conn.commit()
    if not row:
        raise FileNotFoundError(message_id)
    return public_mail_message(row)


def list_mail_messages(tenant_id: str, *, limit: int = 100) -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            """
            select *
            from mail_messages
            where tenant_id=%s
            order by created_at desc
            limit %s
            """,
            (tenant_id, limit),
        ).fetchall()
    return [public_mail_message(row) for row in rows]


def build_invitation_mail(
    *,
    invitation: dict[str, Any],
    invite_token: str,
    tenant_name: str,
    actor_name: str | None,
    message_type: str,
    settings: Settings | None = None,
) -> MailDraft:
    settings = settings or load_settings()
    invite_url = invitation_url(invite_token, settings=settings)
    escaped_tenant = html.escape(tenant_name or "your company")
    escaped_actor = html.escape(actor_name or "A workspace admin")
    escaped_role = html.escape(str(invitation.get("role") or "recruiter").replace("_", " "))
    subject = f"You're invited to {tenant_name or 'candidateSignal.ai'}"
    text_body = (
        f"{actor_name or 'A workspace admin'} invited you to join {tenant_name or 'candidateSignal.ai'} "
        f"as {invitation.get('role', 'recruiter')}.\n\n"
        f"Accept the invitation:\n{invite_url}\n\n"
        "If you were not expecting this invitation, you can ignore this email."
    )
    html_body = f"""
    <div style="font-family:Inter,Arial,sans-serif;color:#172033;line-height:1.5;max-width:560px">
      <p style="font-size:14px;color:#637083;margin:0 0 18px">candidateSignal.ai</p>
      <h1 style="font-size:22px;margin:0 0 12px">Join {escaped_tenant}</h1>
      <p style="font-size:15px;margin:0 0 18px">{escaped_actor} invited you as <strong>{escaped_role}</strong>.</p>
      <p style="margin:0 0 24px">
        <a href="{html.escape(invite_url)}" style="background:#1f2937;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 16px;display:inline-block;font-weight:700">Accept invite</a>
      </p>
      <p style="font-size:13px;color:#637083;margin:0 0 8px">If the button does not work, paste this link into your browser:</p>
      <p style="font-size:13px;word-break:break-all;margin:0;color:#334155">{html.escape(invite_url)}</p>
    </div>
    """.strip()
    return MailDraft(
        tenant_id=invitation.get("tenant_id"),
        user_id=None,
        message_type=message_type,
        to_email=str(invitation["email"]),
        subject=subject,
        text_body=text_body,
        html_body=html_body,
        metadata={
            "invitation_id": invitation.get("id"),
            "role": invitation.get("role"),
            "tenant_name": tenant_name,
        },
    )


def invitation_url(invite_token: str, *, settings: Settings | None = None) -> str:
    settings = settings or load_settings()
    base = (settings.mail_app_base_url or "http://localhost:3001").rstrip("/")
    return f"{base}/?{urlencode({'invite': invite_token})}"


def public_mail_message(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "tenant_id": str(row["tenant_id"]) if row.get("tenant_id") else None,
        "user_id": str(row["user_id"]) if row.get("user_id") else None,
        "provider": row["provider"],
        "message_type": row["message_type"],
        "status": row["status"],
        "to_email": row["to_email"],
        "from_email": row["from_email"],
        "from_name": row.get("from_name"),
        "subject": row["subject"],
        "reply_to": row.get("reply_to"),
        "provider_message_id": row.get("provider_message_id"),
        "error_message": row.get("error_message"),
        "metadata": row.get("metadata") or {},
        "created_at": _iso(row.get("created_at")),
        "sent_at": _iso(row.get("sent_at")),
        "updated_at": _iso(row.get("updated_at")),
    }


def _provider(settings: Settings) -> MailProvider:
    if not settings.mail_enabled:
        return DisabledMailProvider()
    if settings.mail_dry_run:
        return DryRunMailProvider()
    provider_name = settings.mail_provider.lower()
    if provider_name == "resend":
        return ResendMailProvider()
    raise MailError(f"unsupported mail provider: {settings.mail_provider}")


def _configured_provider_name(settings: Settings) -> str:
    if not settings.mail_enabled:
        return "disabled"
    if settings.mail_dry_run:
        return "dry_run"
    return settings.mail_provider.lower()


def _insert_mail_event(
    conn: Any,
    mail_message_id: str,
    tenant_id: str | None,
    provider: str,
    event_type: str,
    payload: dict[str, Any],
) -> None:
    conn.execute(
        """
        insert into mail_events (mail_message_id, tenant_id, provider, event_type, payload)
        values (%s, %s, %s, %s, %s)
        """,
        (mail_message_id, tenant_id, provider, event_type, Jsonb(payload)),
    )


def _from_header(email: str, name: str | None) -> str:
    if not name:
        return email
    safe_name = str(name).replace('"', "").strip()
    return f"{safe_name} <{email}>"


def _safe_json(response: httpx.Response) -> dict[str, Any]:
    if not response.content:
        return {}
    try:
        data = response.json()
    except ValueError:
        return {"raw": response.text[:1000]}
    return data if isinstance(data, dict) else {"data": data}


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    return str(value)
