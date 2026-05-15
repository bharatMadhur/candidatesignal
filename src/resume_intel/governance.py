from __future__ import annotations

from typing import Any

from psycopg.types.json import Jsonb

from .db import db


DEFAULT_PII_ROLES = ["tenant_owner", "tenant_admin", "recruiter"]


def get_tenant_governance_policy(tenant_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            select tenant_id, external_llm_synthesis_enabled, redact_pii_before_external_llm,
                   contact_pii_visible_to_roles, updated_by_user_id, created_at, updated_at
            from tenant_governance_policies
            where tenant_id=%s
            """,
            (tenant_id,),
        ).fetchone()
    if row:
        return _policy_row(row)
    return {
        "tenant_id": tenant_id,
        "external_llm_synthesis_enabled": False,
        "redact_pii_before_external_llm": True,
        "contact_pii_visible_to_roles": DEFAULT_PII_ROLES,
        "updated_by_user_id": None,
        "created_at": None,
        "updated_at": None,
    }


def update_tenant_governance_policy(
    tenant_id: str,
    user_id: str,
    *,
    external_llm_synthesis_enabled: bool | None = None,
    redact_pii_before_external_llm: bool | None = None,
    contact_pii_visible_to_roles: list[str] | None = None,
) -> dict[str, Any]:
    current = get_tenant_governance_policy(tenant_id)
    roles = contact_pii_visible_to_roles if contact_pii_visible_to_roles is not None else current["contact_pii_visible_to_roles"]
    roles = [role for role in roles if role in {"tenant_owner", "tenant_admin", "recruiter", "reviewer", "readonly"}]
    if not roles:
        roles = DEFAULT_PII_ROLES
    with db() as conn:
        row = conn.execute(
            """
            insert into tenant_governance_policies (
              tenant_id, external_llm_synthesis_enabled, redact_pii_before_external_llm,
              contact_pii_visible_to_roles, updated_by_user_id
            )
            values (%s, %s, %s, %s, %s)
            on conflict (tenant_id) do update set
              external_llm_synthesis_enabled=excluded.external_llm_synthesis_enabled,
              redact_pii_before_external_llm=excluded.redact_pii_before_external_llm,
              contact_pii_visible_to_roles=excluded.contact_pii_visible_to_roles,
              updated_by_user_id=excluded.updated_by_user_id,
              updated_at=now()
            returning tenant_id, external_llm_synthesis_enabled, redact_pii_before_external_llm,
                      contact_pii_visible_to_roles, updated_by_user_id, created_at, updated_at
            """,
            (
                tenant_id,
                current["external_llm_synthesis_enabled"] if external_llm_synthesis_enabled is None else external_llm_synthesis_enabled,
                current["redact_pii_before_external_llm"] if redact_pii_before_external_llm is None else redact_pii_before_external_llm,
                Jsonb(roles),
                user_id,
            ),
        ).fetchone()
        conn.execute(
            """
            insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
            values (%s, %s, 'governance.policy_updated', 'tenant_governance_policy', %s, %s)
            """,
            (tenant_id, user_id, tenant_id, Jsonb(_policy_row(row))),
        )
        conn.commit()
    return _policy_row(row)


def role_can_view_contact_pii(tenant_id: str, role: str | None) -> bool:
    if not role:
        return False
    policy = get_tenant_governance_policy(tenant_id)
    return role in set(policy["contact_pii_visible_to_roles"])


def external_llm_synthesis_allowed(tenant_id: str) -> bool:
    return bool(get_tenant_governance_policy(tenant_id)["external_llm_synthesis_enabled"])


def list_pii_access_events(tenant_id: str, *, limit: int = 100) -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            """
            select pii_access_events.id, pii_access_events.tenant_id, pii_access_events.user_id,
                   users.email as user_email, pii_access_events.document_id, candidates.name as candidate_name,
                   pii_access_events.fields, pii_access_events.action, pii_access_events.metadata,
                   pii_access_events.created_at
            from pii_access_events
            left join users on users.id = pii_access_events.user_id
            left join candidates on candidates.document_id = pii_access_events.document_id
              and candidates.tenant_id = pii_access_events.tenant_id
            where pii_access_events.tenant_id=%s
            order by pii_access_events.created_at desc
            limit %s
            """,
            (tenant_id, limit),
        ).fetchall()
    return [
        {
            "id": str(row["id"]),
            "tenant_id": str(row["tenant_id"]),
            "user_id": str(row["user_id"]) if row.get("user_id") else None,
            "user_email": row.get("user_email"),
            "document_id": row.get("document_id"),
            "candidate_name": row.get("candidate_name"),
            "fields": row.get("fields") or [],
            "action": row.get("action"),
            "metadata": row.get("metadata") or {},
            "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        }
        for row in rows
    ]


def _policy_row(row: Any) -> dict[str, Any]:
    return {
        "tenant_id": str(row["tenant_id"]),
        "external_llm_synthesis_enabled": bool(row["external_llm_synthesis_enabled"]),
        "redact_pii_before_external_llm": bool(row["redact_pii_before_external_llm"]),
        "contact_pii_visible_to_roles": row.get("contact_pii_visible_to_roles") or DEFAULT_PII_ROLES,
        "updated_by_user_id": str(row["updated_by_user_id"]) if row.get("updated_by_user_id") else None,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }
