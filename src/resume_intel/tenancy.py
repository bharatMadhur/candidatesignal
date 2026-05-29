from __future__ import annotations

import hashlib
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from psycopg.types.json import Jsonb

from .auth import create_user, hash_password
from .db import db, db_internal_access, db_tenant_context


TENANT_ROLES = {"tenant_owner", "tenant_admin", "recruiter", "reviewer", "readonly"}
PLATFORM_ROLES = {"platform_admin", "admin"}
WRITE_ROLES = {"tenant_owner", "tenant_admin", "recruiter"}
ADMIN_ROLES = {"tenant_owner", "tenant_admin"}
TENANT_OWNER_INVITE_ROLES = {"tenant_owner", "tenant_admin"}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "tenant"


def normalize_email(value: str) -> str:
    email = value.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="valid email is required")
    return email


def validate_tenant_creation_request(name: str, seat_limit: int, owner_email: str | None, owner_role: str) -> None:
    if not name.strip():
        raise HTTPException(status_code=400, detail="tenant name is required")
    if len(name.strip()) < 2:
        raise HTTPException(status_code=400, detail="tenant name must be at least 2 characters")
    if seat_limit < 1:
        raise HTTPException(status_code=400, detail="seat limit must be at least 1")
    if seat_limit > 500:
        raise HTTPException(status_code=400, detail="seat limit cannot exceed 500")
    if owner_role not in TENANT_OWNER_INVITE_ROLES:
        raise HTTPException(status_code=400, detail="owner role must be tenant_owner or tenant_admin")
    if owner_email and owner_email.strip():
        normalize_email(owner_email)


def require_platform_admin(user: dict[str, Any]) -> None:
    if user.get("platform_role") not in PLATFORM_ROLES and user.get("role") not in PLATFORM_ROLES:
        raise HTTPException(status_code=403, detail="platform admin permission required")


def require_tenant_admin(user: dict[str, Any]) -> None:
    if user.get("tenant_role") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="tenant admin permission required")


def require_tenant_write(user: dict[str, Any]) -> None:
    if user.get("tenant_role") not in WRITE_ROLES:
        raise HTTPException(status_code=403, detail="recruiter permission required")


def create_tenant(name: str, seat_limit: int, created_by_user_id: str | None) -> dict[str, Any]:
    if not name.strip():
        raise HTTPException(status_code=400, detail="tenant name is required")
    if seat_limit < 1 or seat_limit > 500:
        raise HTTPException(status_code=400, detail="seat limit must be between 1 and 500")
    with db_internal_access():
        with db() as conn:
            row = _insert_tenant(conn, name, seat_limit, created_by_user_id)
            conn.commit()
    return _tenant_row(row)


def create_self_service_company(
    *,
    company_name: str,
    owner_name: str,
    owner_email: str,
    password: str,
    seat_limit: int | None = None,
) -> dict[str, Any]:
    if not _self_signup_enabled():
        raise HTTPException(status_code=403, detail="company self-signup is disabled")
    clean_company_name = company_name.strip()
    clean_owner_name = owner_name.strip()
    if not clean_owner_name:
        raise HTTPException(status_code=400, detail="owner name is required")
    if len(password) < 10:
        raise HTTPException(status_code=400, detail="password must be at least 10 characters")
    normalized_email = normalize_email(owner_email)
    requested_seats = seat_limit if seat_limit is not None else _self_signup_default_seats()
    validate_tenant_creation_request(clean_company_name, requested_seats, normalized_email, "tenant_owner")
    with db_internal_access():
        with db() as conn:
            _assert_self_signup_email_available(conn, normalized_email)
            password_hash = hash_password(password)
            user_row = conn.execute(
                """
                insert into users (email, password_hash, role, name, email_verified, updated_at)
                values (%s, %s, 'recruiter', %s, false, now())
                returning id, email, role, name, created_at
                """,
                (normalized_email, password_hash, clean_owner_name),
            ).fetchone()
            conn.execute(
                """
                insert into accounts (user_id, account_id, provider_id, password)
                values (%s, %s, 'credential', %s)
                """,
                (user_row["id"], str(user_row["id"]), password_hash),
            )
            tenant_row = _insert_tenant(
                conn,
                clean_company_name,
                requested_seats,
                str(user_row["id"]),
                plan="self_service_free",
                audit_action="tenant.self_signup_created",
            )
            conn.execute(
                """
                insert into tenant_memberships (tenant_id, user_id, role, status, joined_at)
                values (%s, %s, 'tenant_owner', 'active', now())
                """,
                (tenant_row["id"], user_row["id"]),
            )
            conn.execute(
                """
                insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
                values (%s, %s, 'member.self_signup_owner_created', 'user', %s, %s)
                """,
                (
                    tenant_row["id"],
                    user_row["id"],
                    str(user_row["id"]),
                    Jsonb({"email": normalized_email, "company_name": clean_company_name}),
                ),
            )
            conn.commit()
    return {
        "tenant": _tenant_row(tenant_row),
        "user": _public_signup_user(user_row, tenant_row),
    }


def create_tenant_with_owner_invitation(
    name: str,
    seat_limit: int,
    created_by_user_id: str | None,
    owner_email: str | None,
    owner_role: str = "tenant_owner",
) -> dict[str, Any]:
    if owner_role not in TENANT_OWNER_INVITE_ROLES:
        raise HTTPException(status_code=400, detail="owner role must be tenant_owner or tenant_admin")
    normalized_owner_email = normalize_email(owner_email) if owner_email and owner_email.strip() else None
    with db_internal_access():
        with db() as conn:
            if normalized_owner_email:
                _assert_invitee_available(conn, normalized_owner_email)
            row = _insert_tenant(conn, name, seat_limit, created_by_user_id)
            invitation_row = None
            invitation_token = None
            if normalized_owner_email:
                invitation_row, invitation_token = _insert_invitation(
                    conn,
                    str(row["id"]),
                    normalized_owner_email,
                    owner_role,
                    created_by_user_id,
                )
            conn.commit()
    owner_invitation = None
    if invitation_row:
        owner_invitation = _invitation_row(invitation_row)
        owner_invitation["invite_token"] = invitation_token
    return {"tenant": _tenant_row(row), "owner_invitation": owner_invitation}


def _insert_tenant(
    conn: Any,
    name: str,
    seat_limit: int,
    created_by_user_id: str | None,
    *,
    plan: str = "manual",
    audit_action: str = "tenant.created",
) -> Any:
    base_slug = slugify(name)
    slug = base_slug
    index = 2
    while conn.execute("select 1 from tenants where slug=%s", (slug,)).fetchone():
        slug = f"{base_slug}-{index}"
        index += 1
    row = conn.execute(
        """
        insert into tenants (name, slug, status, plan, seat_limit, created_by_user_id)
        values (%s, %s, 'active', %s, %s, %s)
        returning id, name, slug, status, plan, seat_limit, created_at, updated_at
        """,
        (name.strip(), slug, plan, seat_limit, created_by_user_id),
    ).fetchone()
    conn.execute(
        "insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id) values (%s, %s, %s, %s, %s)",
        (row["id"], created_by_user_id, audit_action, "tenant", str(row["id"])),
    )
    return row


def _assert_self_signup_email_available(conn: Any, normalized_email: str) -> None:
    existing_user = conn.execute(
        """
        select users.role, tenants.name as tenant_name
        from users
        left join tenant_memberships on tenant_memberships.user_id = users.id
          and tenant_memberships.status='active'
        left join tenants on tenants.id = tenant_memberships.tenant_id
        where lower(users.email)=lower(%s)
        limit 1
        """,
        (normalized_email,),
    ).fetchone()
    if existing_user and _is_platform_role(existing_user["role"]):
        raise HTTPException(status_code=409, detail="platform admin accounts cannot create recruiter workspaces")
    if existing_user and existing_user.get("tenant_name"):
        raise HTTPException(status_code=409, detail=f"user already belongs to company {existing_user['tenant_name']}")
    if existing_user:
        raise HTTPException(status_code=409, detail="email is already registered")
    existing_invitation = conn.execute(
        """
        select tenants.name as tenant_name
        from tenant_invitations
        join tenants on tenants.id = tenant_invitations.tenant_id
        where lower(tenant_invitations.email)=lower(%s)
          and tenant_invitations.status='pending'
          and tenant_invitations.expires_at > now()
        limit 1
        """,
        (normalized_email,),
    ).fetchone()
    if existing_invitation:
        raise HTTPException(
            status_code=409,
            detail=f"pending invitation already exists for company {existing_invitation['tenant_name']}; accept that invite instead",
        )


def _assert_invitee_available(conn: Any, normalized_email: str) -> None:
    existing_member = conn.execute(
        """
        select users.role, tenants.name as tenant_name
        from users
        left join tenant_memberships on tenant_memberships.user_id = users.id
          and tenant_memberships.status='active'
        left join tenants on tenants.id = tenant_memberships.tenant_id
        where lower(users.email)=lower(%s)
        limit 1
        """,
        (normalized_email,),
    ).fetchone()
    if existing_member and _is_platform_role(existing_member["role"]):
        raise HTTPException(
            status_code=409,
            detail="platform admin accounts cannot be invited into recruiter workspaces",
        )
    if existing_member and existing_member["tenant_name"]:
        raise HTTPException(
            status_code=409,
            detail=f"user already belongs to company {existing_member['tenant_name']}",
        )
    existing_invitation = conn.execute(
        """
        select tenant_invitations.tenant_id, tenants.name as tenant_name
        from tenant_invitations
        join tenants on tenants.id = tenant_invitations.tenant_id
        where lower(tenant_invitations.email)=lower(%s)
          and tenant_invitations.status='pending'
          and tenant_invitations.expires_at > now()
        limit 1
        """,
        (normalized_email,),
    ).fetchone()
    if existing_invitation:
        raise HTTPException(
            status_code=409,
            detail=f"pending invitation already exists for company {existing_invitation['tenant_name']}",
        )


def _insert_invitation(
    conn: Any,
    tenant_id: str,
    normalized_email: str,
    role: str,
    invited_by_user_id: str | None,
) -> tuple[Any, str]:
    token = secrets.token_urlsafe(32)
    token_hash = _hash_token(token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    row = conn.execute(
        """
        insert into tenant_invitations (tenant_id, email, role, token_hash, expires_at, invited_by_user_id)
        values (%s, %s, %s, %s, %s, %s)
        returning id, tenant_id, email, role, status, expires_at, accepted_at, created_at
        """,
        (tenant_id, normalized_email, role, token_hash, expires_at, invited_by_user_id),
    ).fetchone()
    conn.execute(
        "insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata) values (%s, %s, %s, %s, %s, %s)",
        (tenant_id, invited_by_user_id, "member.invited", "tenant_invitation", str(row["id"]), Jsonb({"email": normalized_email, "role": role})),
    )
    return row, token


def list_tenants() -> list[dict[str, Any]]:
    with db_internal_access():
        with db() as conn:
            rows = conn.execute(
                """
                select tenants.*,
                       count(distinct tenant_memberships.id) filter (where tenant_memberships.status='active') as member_count,
                       count(distinct candidates.document_id) as candidate_count,
                       count(distinct parse_jobs.id) as parse_job_count
                from tenants
                left join tenant_memberships on tenant_memberships.tenant_id = tenants.id
                left join candidates on candidates.tenant_id = tenants.id
                left join parse_jobs on parse_jobs.tenant_id = tenants.id
                group by tenants.id
                order by tenants.created_at desc
                """
            ).fetchall()
    return [_tenant_row(row) for row in rows]


def get_tenant(tenant_id: str) -> dict[str, Any]:
    with db_internal_access():
        with db() as conn:
            row = conn.execute(
                """
                select tenants.*,
                       count(distinct tenant_memberships.id) filter (where tenant_memberships.status='active') as member_count,
                       count(distinct candidates.document_id) as candidate_count,
                       count(distinct parse_jobs.id) as parse_job_count
                from tenants
                left join tenant_memberships on tenant_memberships.tenant_id = tenants.id
                left join candidates on candidates.tenant_id = tenants.id
                left join parse_jobs on parse_jobs.tenant_id = tenants.id
                where tenants.id=%s
                group by tenants.id
                """,
                (tenant_id,),
            ).fetchone()
    if not row:
        raise FileNotFoundError(tenant_id)
    return _tenant_row(row)


def tenant_admin_detail(tenant_id: str) -> dict[str, Any]:
    tenant = get_tenant(tenant_id)
    with db_internal_access():
        with db() as conn:
            jobs = conn.execute(
                """
                select id, original_filename, status, stage, error_message, created_at, updated_at
                from parse_jobs
                where tenant_id=%s
                order by updated_at desc
                limit 10
                """,
                (tenant_id,),
            ).fetchall()
            audits = conn.execute(
                """
                select audit_logs.id, audit_logs.action, audit_logs.entity_type, audit_logs.entity_id,
                       audit_logs.metadata, audit_logs.created_at, users.email as user_email
                from audit_logs
                left join users on users.id = audit_logs.user_id
                where audit_logs.tenant_id=%s
                order by audit_logs.created_at desc
                limit 20
                """,
                (tenant_id,),
            ).fetchall()
            candidates = conn.execute(
                """
                select document_id, name, source_file, updated_at
                from candidates
                where tenant_id=%s and deleted_at is null
                order by updated_at desc
                limit 10
                """,
                (tenant_id,),
            ).fetchall()
            requirements = conn.execute(
                """
                select id, title, status, source_type, updated_at
                from requirements
                where tenant_id=%s
                order by updated_at desc
                limit 10
                """,
                (tenant_id,),
            ).fetchall()
            usage = conn.execute(
                """
                select
                  coalesce(sum(candidate_documents.size_bytes), 0) as document_storage_bytes,
                  count(candidate_documents.id) as document_count
                from candidate_documents
                where tenant_id=%s
                """,
                (tenant_id,),
            ).fetchone()
    return {
        "tenant": tenant,
        "members": list_members(tenant_id),
        "invitations": list_invitations(tenant_id),
        "recent_candidates": [
            {
                "id": row["document_id"],
                "name": row["name"] or "Unnamed candidate",
                "source_file": row["source_file"],
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            }
            for row in candidates
        ],
        "recent_requirements": [
            {
                "id": str(row["id"]),
                "title": row["title"] or "Untitled requirement",
                "status": row["status"],
                "source_type": row["source_type"],
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            }
            for row in requirements
        ],
        "recent_parse_jobs": [
            {
                "id": str(row["id"]),
                "original_filename": row["original_filename"] or f"Parse job {str(row['id'])[:8]}",
                "status": row["status"],
                "stage": row["stage"],
                "progress_percent": _parse_job_progress(row["status"], row["stage"]),
                "error_message": row["error_message"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            }
            for row in jobs
        ],
        "audit_events": [
            {
                "id": str(row["id"]),
                "action": row["action"],
                "entity_type": row["entity_type"],
                "entity_id": row["entity_id"],
                "metadata": row["metadata"],
                "user_email": row["user_email"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            }
            for row in audits
        ],
        "usage": {
            "document_count": int(usage["document_count"] or 0),
            "document_storage_bytes": int(usage["document_storage_bytes"] or 0),
        },
    }


def list_audit_logs(tenant_id: str | None = None, action: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 500))
    with db_internal_access():
        with db() as conn:
            rows = conn.execute(
                """
                select audit_logs.id, audit_logs.tenant_id, tenants.name as tenant_name,
                       audit_logs.action, audit_logs.entity_type, audit_logs.entity_id,
                       audit_logs.metadata, audit_logs.created_at, users.email as user_email
                from audit_logs
                left join tenants on tenants.id = audit_logs.tenant_id
                left join users on users.id = audit_logs.user_id
                where (%s::uuid is null or audit_logs.tenant_id=%s)
                  and (%s::text is null or audit_logs.action ilike %s)
                order by audit_logs.created_at desc
                limit %s
                """,
                (tenant_id, tenant_id, action, f"%{action}%" if action else None, limit),
            ).fetchall()
    return [
        {
            "id": str(row["id"]),
            "tenant_id": str(row["tenant_id"]) if row["tenant_id"] else None,
            "tenant_name": row["tenant_name"],
            "action": row["action"],
            "entity_type": row["entity_type"],
            "entity_id": row["entity_id"],
            "metadata": row["metadata"],
            "user_email": row["user_email"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        }
        for row in rows
    ]


def set_tenant_status(tenant_id: str, status: str, user_id: str) -> dict[str, Any]:
    if status not in {"active", "disabled", "pending"}:
        raise HTTPException(status_code=400, detail="invalid tenant status")
    with db_internal_access():
        with db() as conn:
            row = conn.execute(
                """
                update tenants
                set status=%s, updated_at=now()
                where id=%s
                returning id, name, slug, status, plan, seat_limit, created_at, updated_at
                """,
                (status, tenant_id),
            ).fetchone()
            if row:
                conn.execute(
                    "insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id) values (%s, %s, %s, %s, %s)",
                    (tenant_id, user_id, f"tenant.{status}", "tenant", tenant_id),
                )
            conn.commit()
    if not row:
        raise FileNotFoundError(tenant_id)
    return get_tenant(tenant_id)


def create_invitation(tenant_id: str, email: str, role: str, invited_by_user_id: str) -> dict[str, Any]:
    if role not in TENANT_ROLES:
        raise HTTPException(status_code=400, detail="invalid tenant role")
    normalized_email = normalize_email(email)
    with db() as conn:
        _assert_invitee_available(conn, normalized_email)
        _assert_seat_available(conn, tenant_id)
        row, token = _insert_invitation(conn, tenant_id, normalized_email, role, invited_by_user_id)
        conn.commit()
    result = _invitation_row(row)
    result["invite_token"] = token
    return result


def resend_invitation(tenant_id: str, invitation_id: str, user_id: str) -> dict[str, Any]:
    token = secrets.token_urlsafe(32)
    token_hash = _hash_token(token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    with db() as conn:
        row = conn.execute(
            """
            update tenant_invitations
            set token_hash=%s, expires_at=%s, status='pending', updated_at=now()
            where tenant_id=%s and id=%s and status in ('pending', 'expired', 'cancelled')
            returning id, tenant_id, email, role, status, expires_at, accepted_at, created_at
            """,
            (token_hash, expires_at, tenant_id, invitation_id),
        ).fetchone()
        if row:
            conn.execute(
                "insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id) values (%s, %s, %s, %s, %s)",
                (tenant_id, user_id, "member.invite_resent", "tenant_invitation", invitation_id),
            )
        conn.commit()
    if not row:
        raise FileNotFoundError(invitation_id)
    result = _invitation_row(row)
    result["invite_token"] = token
    return result


def cancel_invitation(tenant_id: str, invitation_id: str, user_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            update tenant_invitations
            set status='cancelled', updated_at=now()
            where tenant_id=%s and id=%s and status='pending'
            returning id, tenant_id, email, role, status, expires_at, accepted_at, created_at
            """,
            (tenant_id, invitation_id),
        ).fetchone()
        if row:
            conn.execute(
                "insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id) values (%s, %s, %s, %s, %s)",
                (tenant_id, user_id, "member.invite_cancelled", "tenant_invitation", invitation_id),
            )
        conn.commit()
    if not row:
        raise FileNotFoundError(invitation_id)
    return _invitation_row(row)


def accept_invitation(token: str, name: str, password: str) -> dict[str, Any]:
    token_hash = _hash_token(token)
    with db() as conn:
        invitation = conn.execute(
            """
            select * from tenant_invitations
            where token_hash=%s and status='pending' and expires_at > now()
            """,
            (token_hash,),
        ).fetchone()
    if not invitation:
        raise HTTPException(status_code=404, detail="invitation not found or expired")

    user = create_user(invitation["email"], password, "recruiter", name=name)
    if _is_platform_role(user.get("role")):
        raise HTTPException(
            status_code=409,
            detail="platform admin accounts cannot accept company invitations",
        )
    with db_tenant_context(str(invitation["tenant_id"])):
        with db() as conn:
            # The pending invitation already reserved a seat when it was created.
            # During acceptance, only active members should count against capacity;
            # otherwise the final available seat can never be accepted.
            _assert_active_seat_available(conn, str(invitation["tenant_id"]))
            existing = conn.execute(
                """
                select tenant_id from tenant_memberships
                where user_id=%s and status='active' and tenant_id<>%s
                limit 1
                """,
                (user["id"], invitation["tenant_id"]),
            ).fetchone()
            if existing:
                raise HTTPException(status_code=409, detail="user already belongs to another company")
            conn.execute(
                """
                insert into tenant_memberships (tenant_id, user_id, role, status, invited_by_user_id, joined_at)
                values (%s, %s, %s, 'active', %s, now())
                on conflict (tenant_id, user_id) do update set
                  role=excluded.role, status='active', joined_at=coalesce(tenant_memberships.joined_at, now()), updated_at=now()
                """,
                (invitation["tenant_id"], user["id"], invitation["role"], invitation["invited_by_user_id"]),
            )
            conn.execute(
                "update tenant_invitations set status='accepted', accepted_at=now(), updated_at=now() where id=%s",
                (invitation["id"],),
            )
            conn.execute(
                "insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id) values (%s, %s, %s, %s, %s)",
                (invitation["tenant_id"], user["id"], "member.accepted_invite", "tenant_invitation", str(invitation["id"])),
            )
            conn.commit()
    return {"user": user, "tenant_id": str(invitation["tenant_id"])}


def _is_platform_role(role: str | None) -> bool:
    return role in PLATFORM_ROLES


def list_members(tenant_id: str) -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            """
            select tenant_memberships.id, tenant_memberships.role, tenant_memberships.status,
                   tenant_memberships.joined_at, tenant_memberships.created_at,
                   users.id as user_id, users.email, users.name
            from tenant_memberships
            join users on users.id = tenant_memberships.user_id
            where tenant_memberships.tenant_id=%s
            order by tenant_memberships.created_at
            """,
            (tenant_id,),
        ).fetchall()
    return [
        {
            "id": str(row["id"]),
            "user_id": str(row["user_id"]),
            "email": row["email"],
            "name": row["name"],
            "role": row["role"],
            "status": row["status"],
            "joined_at": row["joined_at"].isoformat() if row["joined_at"] else None,
            "created_at": row["created_at"].isoformat(),
        }
        for row in rows
    ]


def list_invitations(tenant_id: str) -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            """
            select id, tenant_id, email, role, status, expires_at, accepted_at, created_at
            from tenant_invitations
            where tenant_id=%s
            order by created_at desc
            """,
            (tenant_id,),
        ).fetchall()
    return [_invitation_row(row) for row in rows]


def update_member_role(tenant_id: str, membership_id: str, role: str, actor_user_id: str) -> dict[str, Any]:
    if role not in TENANT_ROLES:
        raise HTTPException(status_code=400, detail="invalid tenant role")
    with db() as conn:
        current = conn.execute(
            "select id, user_id, role, status from tenant_memberships where tenant_id=%s and id=%s",
            (tenant_id, membership_id),
        ).fetchone()
        if not current:
            raise FileNotFoundError(membership_id)
        if current["role"] == "tenant_owner" and role != "tenant_owner":
            owner_count = conn.execute(
                """
                select count(*) as count
                from tenant_memberships
                where tenant_id=%s and role='tenant_owner' and status='active'
                """,
                (tenant_id,),
            ).fetchone()
            if int(owner_count["count"] or 0) <= 1:
                raise HTTPException(status_code=409, detail="cannot demote the only active tenant owner")
        row = conn.execute(
            """
            update tenant_memberships
            set role=%s, updated_at=now()
            where tenant_id=%s and id=%s
            returning id, role, status, user_id
            """,
            (role, tenant_id, membership_id),
        ).fetchone()
        conn.execute(
            """
            insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
            values (%s, %s, 'member.role_changed', 'tenant_membership', %s, %s)
            """,
            (
                tenant_id,
                actor_user_id,
                membership_id,
                Jsonb({"from_role": current["role"], "to_role": role, "target_user_id": str(current["user_id"])}),
            ),
        )
        conn.commit()
    return {"id": str(row["id"]), "user_id": str(row["user_id"]), "role": row["role"], "status": row["status"]}


def deactivate_member(tenant_id: str, membership_id: str, actor_user_id: str) -> dict[str, Any]:
    with db() as conn:
        current = conn.execute(
            "select id, user_id, role, status from tenant_memberships where tenant_id=%s and id=%s",
            (tenant_id, membership_id),
        ).fetchone()
        if not current:
            raise FileNotFoundError(membership_id)
        if current["role"] == "tenant_owner":
            owner_count = conn.execute(
                """
                select count(*) as count
                from tenant_memberships
                where tenant_id=%s and role='tenant_owner' and status='active'
                """,
                (tenant_id,),
            ).fetchone()
            if int(owner_count["count"] or 0) <= 1:
                raise HTTPException(status_code=409, detail="cannot disable the only active tenant owner")
        row = conn.execute(
            """
            update tenant_memberships
            set status='disabled', updated_at=now()
            where tenant_id=%s and id=%s
            returning id, role, status, user_id
            """,
            (tenant_id, membership_id),
        ).fetchone()
        conn.execute(
            """
            insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
            values (%s, %s, 'member.disabled', 'tenant_membership', %s, %s)
            """,
            (
                tenant_id,
                actor_user_id,
                membership_id,
                Jsonb({"role": current["role"], "target_user_id": str(current["user_id"])}),
            ),
        )
        conn.commit()
    return {"id": str(row["id"]), "user_id": str(row["user_id"]), "role": row["role"], "status": row["status"]}


def _assert_seat_available(conn: Any, tenant_id: str) -> None:
    row = conn.execute(
        """
        select tenants.seat_limit,
               count(distinct tenant_memberships.id) filter (where tenant_memberships.status='active') as active_members,
               count(distinct tenant_invitations.id) filter (
                 where tenant_invitations.status='pending'
                   and tenant_invitations.expires_at > now()
               ) as pending_invites
        from tenants
        left join tenant_memberships on tenant_memberships.tenant_id = tenants.id
        left join tenant_invitations on tenant_invitations.tenant_id = tenants.id
        where tenants.id=%s
        group by tenants.id
        """,
        (tenant_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="tenant not found")
    reserved_seats = int(row["active_members"] or 0) + int(row["pending_invites"] or 0)
    if reserved_seats >= int(row["seat_limit"]):
        raise HTTPException(status_code=409, detail="tenant seat limit reached")


def _assert_active_seat_available(conn: Any, tenant_id: str) -> None:
    row = conn.execute(
        """
        select tenants.seat_limit,
               count(distinct tenant_memberships.id) filter (where tenant_memberships.status='active') as active_members
        from tenants
        left join tenant_memberships on tenant_memberships.tenant_id = tenants.id
        where tenants.id=%s
        group by tenants.id
        """,
        (tenant_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="tenant not found")
    if int(row["active_members"] or 0) >= int(row["seat_limit"]):
        raise HTTPException(status_code=409, detail="tenant seat limit reached")


def _parse_job_progress(status: str, stage: str) -> int:
    if status in {"succeeded", "completed"}:
        return 100
    if status in {"failed", "cancelled"}:
        return 100
    stages = {
        "queued": 5,
        "running": 10,
        "extracting": 20,
        "extracted": 30,
        "factual_extraction": 45,
        "deep_intelligence": 65,
        "saving": 80,
        "embedding": 90,
        "candidate_versions": 95,
    }
    return stages.get(stage, 50 if status == "running" else 0)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _self_signup_enabled() -> bool:
    return os.getenv("RESUME_INTEL_SELF_SIGNUP_ENABLED", "1").strip().lower() in {"1", "true", "yes", "on"}


def _self_signup_default_seats() -> int:
    raw = os.getenv("RESUME_INTEL_SELF_SIGNUP_SEAT_LIMIT", "5").strip()
    try:
        value = int(raw)
    except ValueError:
        value = 5
    return max(1, min(value, 50))


def _public_signup_user(user_row: Any, tenant_row: Any) -> dict[str, Any]:
    return {
        "id": str(user_row["id"]),
        "email": user_row["email"],
        "name": user_row.get("name"),
        "role": "tenant_owner",
        "platform_role": user_row["role"],
        "tenant_role": "tenant_owner",
        "tenant_id": str(tenant_row["id"]),
        "tenant_name": tenant_row["name"],
        "workspace_access": "tenant_member",
        "created_at": user_row["created_at"].isoformat() if user_row.get("created_at") else None,
    }


def _tenant_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "slug": row["slug"],
        "status": row["status"],
        "plan": row["plan"],
        "seat_limit": row["seat_limit"],
        "member_count": int(row.get("member_count") or 0) if hasattr(row, "get") else 0,
        "candidate_count": int(row.get("candidate_count") or 0) if hasattr(row, "get") else 0,
        "parse_job_count": int(row.get("parse_job_count") or 0) if hasattr(row, "get") else 0,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


def _invitation_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "tenant_id": str(row["tenant_id"]),
        "email": row["email"],
        "role": row["role"],
        "status": row["status"],
        "expires_at": row["expires_at"].isoformat() if row["expires_at"] else None,
        "accepted_at": row["accepted_at"].isoformat() if row["accepted_at"] else None,
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }
