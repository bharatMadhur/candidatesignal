from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from urllib.parse import unquote
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .db import db


security = HTTPBearer(auto_error=False)
DEFAULT_BETTER_AUTH_SECRET = "resume-intel-local-dev-secret-change-me"


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return "pbkdf2_sha256$310000$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(digest).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt_b64, digest_b64 = stored.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(iterations))
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def create_user(email: str, password: str, role: str = "recruiter", name: str | None = None) -> dict[str, Any]:
    with db() as conn:
        password_hash = hash_password(password)
        row = conn.execute(
            """
            insert into users (email, password_hash, role, name, updated_at)
            values (%s, %s, %s, %s, now())
            on conflict (email) do update set
              email = excluded.email,
              name = coalesce(excluded.name, users.name),
              role = case
                when excluded.role in ('admin', 'platform_admin') then excluded.role
                else users.role
              end,
              updated_at = now()
            returning id, email, role, name, password_hash, created_at
            """,
            (email.lower().strip(), password_hash, role, name),
        ).fetchone()
        conn.execute(
            """
            insert into accounts (user_id, account_id, provider_id, password)
            values (%s, %s, 'credential', %s)
            on conflict (provider_id, account_id) do nothing
            """,
            (row["id"], str(row["id"]), row["password_hash"]),
        )
        if role in {"admin", "platform_admin"}:
            conn.execute("update users set role='platform_admin' where id=%s", (row["id"],))
            row = conn.execute("select id, email, role, name, created_at from users where id=%s", (row["id"],)).fetchone()
        conn.commit()
        return _public_user(row)


def bootstrap_platform_admin(email: str, password: str, name: str | None = None, setup_token: str | None = None) -> dict[str, Any]:
    required_token = os.getenv("RESUME_INTEL_BOOTSTRAP_TOKEN", "").strip()
    with db() as conn:
        existing_admin = conn.execute(
            "select 1 from users where role in ('admin', 'platform_admin') limit 1"
        ).fetchone()
    if required_token:
        if not setup_token or not hmac.compare_digest(setup_token, required_token):
            raise HTTPException(status_code=403, detail="valid bootstrap token required")
    elif existing_admin:
        raise HTTPException(status_code=403, detail="platform admin already exists")
    return create_user(email, password, "platform_admin", name=name)


def login(email: str, password: str) -> dict[str, Any]:
    with db() as conn:
        user = conn.execute("select * from users where lower(email)=lower(%s)", (email.strip(),)).fetchone()
        if not user or not verify_password(password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="invalid email or password")
        token = secrets.token_urlsafe(32)
        ttl_hours = int(os.getenv("AUTH_SESSION_TTL_HOURS", "24"))
        expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
        conn.execute(
            "insert into sessions (token, user_id, expires_at) values (%s, %s, %s)",
            (token, user["id"], expires_at),
        )
        conn.commit()
        session_user = _user_context(conn, token)
        return {
            "token": token,
            "expires_at": expires_at.isoformat(),
            "user": session_user,
        }


def logout(token: str) -> None:
    token = _session_token_from_bearer(token, allow_unsigned=True)
    with db() as conn:
        conn.execute("delete from sessions where token=%s", (token,))
        conn.commit()


def select_platform_tenant_workspace(token: str, tenant_id: str) -> dict[str, Any]:
    raise HTTPException(
        status_code=403,
        detail="platform admins do not enter recruiter workspaces; invite a company user instead",
    )


def clear_platform_tenant_workspace(token: str) -> dict[str, Any]:
    token = _session_token_from_bearer(token, allow_unsigned=True)
    with db() as conn:
        session = conn.execute(
            """
            select sessions.user_id, sessions.active_tenant_id, users.role
            from sessions
            join users on users.id = sessions.user_id
            where sessions.token=%s and sessions.expires_at > now()
              and sessions.revoked_at is null
            """,
            (token,),
        ).fetchone()
        if not session:
            raise HTTPException(status_code=401, detail="invalid or expired session")
        if session["role"] not in {"admin", "platform_admin"}:
            raise HTTPException(status_code=403, detail="platform admin permission required")
        previous_tenant_id = session.get("active_tenant_id")
        conn.execute("update sessions set active_tenant_id=null, updated_at=now() where token=%s", (token,))
        if previous_tenant_id:
            conn.execute(
                """
                insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id)
                values (%s, %s, 'tenant.workspace_cleared', 'tenant', %s)
                """,
                (previous_tenant_id, session["user_id"], str(previous_tenant_id)),
            )
        conn.commit()
        user = _user_context(conn, token)
    return {"user": user}


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> dict[str, Any]:
    if credentials is None:
        raise HTTPException(status_code=401, detail="missing bearer token")
    session_token = _session_token_from_bearer(credentials.credentials)
    with db() as conn:
        user = _user_context(conn, session_token)
        if not user:
            raise HTTPException(status_code=401, detail="invalid or expired session")
        return user


def _session_token_from_bearer(token: str, *, allow_unsigned: bool = False) -> str:
    """Return the raw Better Auth session token from a signed bearer value.

    Better Auth's bearer plugin exposes a signed cookie value in the
    `set-auth-token` header. FastAPI must verify that signature before it trusts
    the session token stored in Postgres. Raw bearer tokens are only accepted
    when explicitly enabled for local compatibility.
    """
    token = (token or "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="missing bearer token")
    decoded = unquote(token)
    if "." in decoded:
        raw_token, signature = decoded.rsplit(".", 1)
        if _verify_better_auth_signature(raw_token, signature):
            return raw_token
        raise HTTPException(status_code=401, detail="invalid Better Auth bearer signature")
    if allow_unsigned or _unsigned_bearer_allowed():
        return decoded
    raise HTTPException(status_code=401, detail="unsigned bearer token rejected; use Better Auth login")


def _verify_better_auth_signature(raw_token: str, signature: str) -> bool:
    secret = _better_auth_secret()
    digest = hmac.new(secret.encode(), raw_token.encode(), hashlib.sha256).digest()
    standard = base64.b64encode(digest).decode()
    urlsafe = base64.urlsafe_b64encode(digest).decode().rstrip("=")
    return hmac.compare_digest(signature, standard) or hmac.compare_digest(signature, urlsafe)


def _better_auth_secret() -> str:
    secret = (
        os.getenv("BETTER_AUTH_SECRET")
        or os.getenv("RESUME_INTEL_BETTER_AUTH_SECRET")
        or _secret_file("BETTER_AUTH_SECRET_FILE")
        or _secret_file("RESUME_INTEL_BETTER_AUTH_SECRET_FILE")
    )
    if secret:
        return secret
    if _production_mode():
        raise RuntimeError("BETTER_AUTH_SECRET is required in production")
    return DEFAULT_BETTER_AUTH_SECRET


def _secret_file(name: str) -> str | None:
    path = os.getenv(name)
    if not path:
        return None
    try:
        with open(path, "r", encoding="utf-8") as handle:
            value = handle.read().strip()
    except OSError:
        return None
    return value or None


def _production_mode() -> bool:
    value = os.getenv("RESUME_INTEL_ENV") or os.getenv("APP_ENV")
    if (value or "").lower() in {"production", "prod"}:
        return True
    auth_url = os.getenv("BETTER_AUTH_URL", "")
    return bool(auth_url and "localhost" not in auth_url and "127.0.0.1" not in auth_url)


def _unsigned_bearer_allowed() -> bool:
    value = os.getenv("RESUME_INTEL_ALLOW_UNSIGNED_BETTER_AUTH_BEARER") or os.getenv("RESUME_INTEL_ENABLE_LEGACY_AUTH")
    return (value or "").lower() in {"1", "true", "yes"}


def _user_context(conn: Any, token: str) -> dict[str, Any] | None:
    row = conn.execute(
        """
        select users.id, users.email, users.role as platform_role, users.name,
               sessions.active_tenant_id,
               member_tenant_memberships.role as member_tenant_role,
               member_tenant_memberships.status as member_membership_status,
               member_tenants.id as member_tenant_id,
               member_tenants.name as member_tenant_name,
               member_tenants.status as member_tenant_status,
               active_tenants.id as active_tenant_id,
               active_tenants.name as active_tenant_name,
               active_tenants.status as active_tenant_status
        from sessions
        join users on users.id = sessions.user_id
        left join tenant_memberships member_tenant_memberships on member_tenant_memberships.user_id = users.id
          and member_tenant_memberships.status='active'
          and users.role not in ('admin', 'platform_admin')
        left join tenants member_tenants on member_tenants.id = member_tenant_memberships.tenant_id
        left join tenants active_tenants on active_tenants.id = sessions.active_tenant_id
          and users.role in ('admin', 'platform_admin')
        where sessions.token = %s and sessions.expires_at > now()
          and sessions.revoked_at is null
        order by member_tenant_memberships.created_at asc nulls last
        limit 1
        """,
        (token,),
    ).fetchone()
    if not row:
        return None
    is_platform_admin = row["platform_role"] in {"admin", "platform_admin"}
    tenant_id = None if is_platform_admin else row["member_tenant_id"]
    tenant_name = None if is_platform_admin else row["member_tenant_name"]
    tenant_status = None if is_platform_admin else row["member_tenant_status"]
    tenant_role = None if is_platform_admin else row["member_tenant_role"]
    if tenant_id and tenant_status != "active" and not is_platform_admin:
        raise HTTPException(status_code=403, detail="tenant is not active")
    return {
        "id": str(row["id"]),
        "email": row["email"],
        "name": row["name"],
        "role": tenant_role or row["platform_role"],
        "platform_role": row["platform_role"],
        "tenant_role": tenant_role,
        "tenant_id": str(tenant_id) if tenant_id else None,
        "tenant_name": tenant_name,
        "workspace_access": "platform_admin" if is_platform_admin else "tenant_member",
    }


def _public_user(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "email": row["email"],
        "name": row.get("name"),
        "role": row["role"],
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }
