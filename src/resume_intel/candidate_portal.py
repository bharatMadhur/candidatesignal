from __future__ import annotations

import html
import copy
import re
import hashlib
import secrets
import textwrap
import unicodedata
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from psycopg.types.json import Jsonb

from .auth import hash_password
from .db import db
from .pipeline import SUPPORTED_EXTENSIONS, parse_file
from .settings import load_settings
from .tenancy import normalize_email


PROFILE_FIELDS = {
    "display_name",
    "headline",
    "summary",
    "current_location",
    "email",
    "phone",
    "linkedin_url",
    "portfolio_url",
    "github_url",
    "skills",
    "experience",
    "education",
    "certifications",
    "awards",
    "publications",
    "languages",
    "projects",
    "links",
    "other_sections",
}

DEFAULT_PRIVACY_SETTINGS = {
    "candidate_signal_native_search_enabled": False,
    "pii_visible_to_recruiters": False,
    "pii_permission_required": True,
    "allow_linkedin_verification": False,
    "public_resume_fields": [
        "headline",
        "summary",
        "skills",
        "experience_summary",
        "education",
        "projects",
        "current_location",
    ],
}

APPLICATION_DESTINATION_TYPES = {"company", "recruiter", "job_board", "linkedin", "email", "referral", "other", "manual"}
APPLICATION_STATUSES = {"planned", "shared", "applied", "interviewing", "offer", "rejected", "withdrawn", "archived"}

PRIVACY_FIELDS = {
    "candidate_signal_native_search_enabled",
    "pii_visible_to_recruiters",
    "pii_permission_required",
    "allow_linkedin_verification",
    "public_resume_fields",
}

ROOT = Path(__file__).resolve().parents[2]
CANDIDATE_PORTAL_DATA_DIR = ROOT / "data" / "candidate_portal"
CANDIDATE_UPLOAD_STAGES = {
    "queued": (5, "Queued"),
    "stored": (10, "Resume stored"),
    "running": (20, "Parsing resume"),
    "profile": (78, "Building profile"),
    "version": (90, "Creating resume version"),
    "succeeded": (100, "Completed"),
    "failed": (100, "Needs review"),
}

STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "for",
    "from",
    "in",
    "is",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
    "years",
    "year",
    "experience",
    "candidate",
    "need",
    "needs",
    "role",
    "job",
}


def create_candidate_account(*, name: str, email: str, password: str) -> dict[str, Any]:
    clean_name = name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="candidate name is required")
    if len(password) < 10:
        raise HTTPException(status_code=400, detail="password must be at least 10 characters")
    normalized_email = normalize_email(email)
    with db() as conn:
        _assert_candidate_email_available(conn, normalized_email)
        password_hash = hash_password(password)
        user_row = conn.execute(
            """
            insert into users (email, password_hash, role, name, email_verified, updated_at)
            values (%s, %s, 'candidate', %s, false, now())
            returning id, email, role, name, created_at
            """,
            (normalized_email, password_hash, clean_name),
        ).fetchone()
        conn.execute(
            """
            insert into accounts (user_id, account_id, provider_id, password)
            values (%s, %s, 'credential', %s)
            """,
            (user_row["id"], str(user_row["id"]), password_hash),
        )
        profile_json = {
            "display_name": clean_name,
            "email": normalized_email,
            "skills": [],
            "experience": [],
            "education": [],
            "certifications": [],
            "projects": [],
            "links": [],
        }
        conn.execute(
            """
            insert into candidate_profiles (user_id, display_name, headline, profile_json)
            values (%s, %s, '', %s)
            """,
            (user_row["id"], clean_name, Jsonb(profile_json)),
        )
        conn.commit()
    return {"user": _candidate_public_user(user_row), "profile": _profile_response(user_row, profile_json)}


def get_candidate_profile(user: dict[str, Any]) -> dict[str, Any]:
    _require_candidate(user)
    with db() as conn:
        row = conn.execute(
            """
            select users.id, users.email, users.name, candidate_profiles.display_name,
                   candidate_profiles.headline, candidate_profiles.profile_json,
                   candidate_profiles.privacy_settings, candidate_profiles.updated_at
            from users
            join candidate_profiles on candidate_profiles.user_id = users.id
            where users.id=%s
            """,
            (user["id"],),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="candidate profile not found")
    profile = dict(row["profile_json"] or {})
    profile["display_name"] = row["display_name"] or profile.get("display_name") or row["name"]
    profile["headline"] = row["headline"] or profile.get("headline") or ""
    profile.setdefault("email", row["email"])
    return {
        "user_id": str(row["id"]),
        "email": row["email"],
        "profile": _normalize_profile(profile),
        "privacy_settings": _normalize_privacy_settings(row["privacy_settings"] or {}),
        "updated_at": _iso(row["updated_at"]),
    }


def update_candidate_profile(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    _require_candidate(user)
    raw_clean = {key: value for key, value in payload.items() if key in PROFILE_FIELDS}
    normalized_clean = _normalize_profile(raw_clean)
    clean = {key: normalized_clean[key] for key in raw_clean if key in normalized_clean}
    with db() as conn:
        current = conn.execute(
            "select profile_json from candidate_profiles where user_id=%s",
            (user["id"],),
        ).fetchone()
        if not current:
            raise HTTPException(status_code=404, detail="candidate profile not found")
        profile = _normalize_profile({**dict(current["profile_json"] or {}), **clean})
        display_name = str(profile.get("display_name") or user.get("name") or "").strip() or None
        headline = str(profile.get("headline") or "").strip()
        conn.execute(
            """
            update candidate_profiles
            set display_name=%s, headline=%s, profile_json=%s, updated_at=now()
            where user_id=%s
            """,
            (display_name, headline, Jsonb(profile), user["id"]),
        )
        if display_name:
            conn.execute("update users set name=%s, updated_at=now() where id=%s", (display_name, user["id"]))
        conn.commit()
    return get_candidate_profile(user)


def update_candidate_privacy_settings(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    _require_candidate(user)
    clean: dict[str, Any] = {}
    for key, value in payload.items():
        if key not in PRIVACY_FIELDS:
            continue
        if key == "public_resume_fields":
            clean[key] = [item for item in _as_list(value) if item in DEFAULT_PRIVACY_SETTINGS["public_resume_fields"]]
        elif key in {"candidate_signal_native_search_enabled", "pii_visible_to_recruiters", "pii_permission_required", "allow_linkedin_verification"}:
            clean[key] = bool(value)
    with db() as conn:
        row = conn.execute("select privacy_settings from candidate_profiles where user_id=%s", (user["id"],)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="candidate profile not found")
        privacy_settings = _normalize_privacy_settings({**dict(row["privacy_settings"] or {}), **clean})
        if privacy_settings.get("pii_permission_required"):
            privacy_settings["pii_visible_to_recruiters"] = False
        conn.execute(
            """
            update candidate_profiles
            set privacy_settings=%s, updated_at=now()
            where user_id=%s
            """,
            (Jsonb(privacy_settings), user["id"]),
        )
        conn.commit()
    return get_candidate_profile(user)


def list_resume_shares(user: dict[str, Any]) -> dict[str, Any]:
    _require_candidate(user)
    with db() as conn:
        rows = conn.execute(
            """
            select candidate_resume_shares.id, candidate_resume_shares.resume_version_id,
                   candidate_resume_shares.label, candidate_resume_shares.access_token,
                   candidate_resume_shares.permissions_json, candidate_resume_shares.status,
                   candidate_resume_shares.expires_at, candidate_resume_shares.created_at,
                   candidate_resume_versions.title as version_title
            from candidate_resume_shares
            join candidate_resume_versions on candidate_resume_versions.id = candidate_resume_shares.resume_version_id
            where candidate_resume_shares.candidate_user_id=%s
            order by candidate_resume_shares.created_at desc
            limit 50
            """,
            (user["id"],),
        ).fetchall()
    return {"shares": [_share_row(row) for row in rows]}


def create_resume_share(user: dict[str, Any], *, version_id: str, label: str, include_pii: bool = False) -> dict[str, Any]:
    _require_candidate(user)
    row = _load_resume_version(user, version_id)
    clean_label = label.strip() or f"{row['title']} share"
    token = secrets.token_urlsafe(32)
    with db() as conn:
        share = conn.execute(
            """
            insert into candidate_resume_shares
              (candidate_user_id, resume_version_id, label, access_token, permissions_json, status)
            values (%s, %s, %s, %s, %s, 'active')
            returning id, resume_version_id, label, access_token, permissions_json, status, expires_at, created_at
            """,
            (user["id"], version_id, clean_label, token, Jsonb({"include_pii": bool(include_pii)})),
        ).fetchone()
        conn.commit()
    payload = _share_row({**dict(share), "version_title": row["title"]})
    return {"share": payload}


def revoke_resume_share(user: dict[str, Any], share_id: str) -> dict[str, Any]:
    _require_candidate(user)
    with db() as conn:
        row = conn.execute(
            """
            update candidate_resume_shares
            set status='revoked', revoked_at=now()
            where id=%s and candidate_user_id=%s
            returning id
            """,
            (share_id, user["id"]),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="resume share not found")
        conn.commit()
    return {"ok": True, "share_id": share_id}


def list_candidate_applications(user: dict[str, Any]) -> dict[str, Any]:
    _require_candidate(user)
    with db() as conn:
        rows = conn.execute(
            """
            select candidate_applications.*, candidate_resume_versions.title as version_title,
                   candidate_resume_shares.access_token,
                   candidate_resume_shares.status as share_status,
                   candidate_resume_shares.permissions_json as share_permissions_json
            from candidate_applications
            left join candidate_resume_versions on candidate_resume_versions.id = candidate_applications.resume_version_id
            left join candidate_resume_shares on candidate_resume_shares.id = candidate_applications.resume_share_id
            where candidate_applications.candidate_user_id=%s
            order by candidate_applications.shared_at desc, candidate_applications.updated_at desc
            limit 200
            """,
            (user["id"],),
        ).fetchall()
    return {"applications": [_application_row(row) for row in rows]}


def create_candidate_application(
    user: dict[str, Any],
    *,
    resume_version_id: str,
    destination_name: str,
    destination_type: str | None = None,
    job_title: str | None = None,
    job_url: str | None = None,
    status: str | None = None,
    note: str | None = None,
    create_share_link: bool = False,
    include_pii: bool = False,
) -> dict[str, Any]:
    _require_candidate(user)
    version = _load_resume_version(user, resume_version_id)
    clean_destination = _clean_optional_text(destination_name)
    if not clean_destination:
        raise HTTPException(status_code=400, detail="destination is required")
    clean_type = _normalize_application_destination_type(destination_type)
    clean_status = _normalize_application_status(status)
    clean_job_url = _clean_optional_text(job_url)
    with db() as conn:
        share_id = None
        share_payload: dict[str, Any] | None = None
        if create_share_link:
            token = secrets.token_urlsafe(32)
            share_label = f"{clean_destination} - {version['title']}"
            share = conn.execute(
                """
                insert into candidate_resume_shares
                  (candidate_user_id, resume_version_id, label, access_token, permissions_json, status)
                values (%s, %s, %s, %s, %s, 'active')
                returning id, resume_version_id, label, access_token, permissions_json, status, expires_at, created_at
                """,
                (user["id"], resume_version_id, share_label, token, Jsonb({"include_pii": bool(include_pii)})),
            ).fetchone()
            share_id = share["id"]
            share_payload = _share_row({**dict(share), "version_title": version["title"]})
        row = conn.execute(
            """
            insert into candidate_applications (
              candidate_user_id, resume_version_id, status, pii_visibility_status,
              candidate_note, destination_name, destination_type, job_title, job_url,
              shared_at, resume_share_id
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, now(), %s)
            returning *
            """,
            (
                user["id"],
                resume_version_id,
                clean_status,
                "candidate_shared" if include_pii else "hidden",
                _clean_optional_text(note),
                clean_destination,
                clean_type,
                _clean_optional_text(job_title),
                clean_job_url,
                share_id,
            ),
        ).fetchone()
        conn.commit()
    payload = _application_row({
        **dict(row),
        "version_title": version["title"],
        "access_token": share_payload["access_token"] if share_payload else None,
        "share_status": share_payload["status"] if share_payload else None,
        "share_permissions_json": share_payload["permissions"] if share_payload else None,
    })
    return {"application": payload, "share": share_payload}


def update_candidate_application(user: dict[str, Any], application_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    _require_candidate(user)
    clean_status = _normalize_application_status(payload.get("status")) if "status" in payload else None
    clean_note = _clean_optional_text(payload.get("note")) if "note" in payload else None
    with db() as conn:
        row = conn.execute(
            """
            update candidate_applications
            set status=coalesce(%s, status),
                candidate_note=case when %s then %s else candidate_note end,
                updated_at=now()
            where id=%s and candidate_user_id=%s
            returning *
            """,
            (clean_status, "note" in payload, clean_note, application_id, user["id"]),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="application not found")
        version_title = None
        if row.get("resume_version_id"):
            version_row = conn.execute(
                "select title from candidate_resume_versions where id=%s and candidate_user_id=%s",
                (row["resume_version_id"], user["id"]),
            ).fetchone()
            version_title = version_row.get("title") if version_row else None
        conn.commit()
    return {"application": _application_row({**dict(row), "version_title": version_title})}


def public_resume_share(access_token: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            select candidate_resume_shares.id, candidate_resume_shares.label,
                   candidate_resume_shares.permissions_json, candidate_resume_shares.status,
                   candidate_resume_shares.expires_at, candidate_resume_shares.created_at,
                   candidate_resume_versions.title as version_title,
                   candidate_resume_versions.resume_json,
                   users.name as candidate_name
            from candidate_resume_shares
            join candidate_resume_versions on candidate_resume_versions.id = candidate_resume_shares.resume_version_id
            join users on users.id = candidate_resume_shares.candidate_user_id
            where candidate_resume_shares.access_token=%s
              and candidate_resume_shares.status='active'
              and (candidate_resume_shares.expires_at is null or candidate_resume_shares.expires_at > now())
            """,
            (access_token,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="resume share not found")
    return {"share": _public_share_payload(row)}


def list_native_candidates(user: dict[str, Any], *, query: str = "", limit: int = 20) -> dict[str, Any]:
    _require_recruiter(user)
    clean_query = query.strip().lower()
    safe_limit = max(1, min(int(limit or 20), 50))
    with db() as conn:
        rows = conn.execute(
            """
            select users.id as candidate_user_id, candidate_profiles.profile_json,
                   candidate_profiles.privacy_settings, candidate_profiles.updated_at,
                   (
                     select id from candidate_resume_versions
                     where candidate_resume_versions.candidate_user_id=users.id
                     order by updated_at desc
                     limit 1
                   ) as latest_resume_version_id,
                   (
                     select status from candidate_native_access_requests
                     where candidate_native_access_requests.candidate_user_id=users.id
                       and candidate_native_access_requests.tenant_id=%s
                     order by created_at desc
                     limit 1
                   ) as request_status,
                   (
                     select approved_snapshot_json from candidate_native_access_requests
                     where candidate_native_access_requests.candidate_user_id=users.id
                       and candidate_native_access_requests.tenant_id=%s
                       and candidate_native_access_requests.status='approved'
                     order by decided_at desc nulls last, created_at desc
                     limit 1
                   ) as approved_snapshot_json
            from users
            join candidate_profiles on candidate_profiles.user_id=users.id
            where users.role='candidate'
              and coalesce((candidate_profiles.privacy_settings->>'candidate_signal_native_search_enabled')::boolean, false)=true
            order by candidate_profiles.updated_at desc
            limit 300
            """,
            (user.get("tenant_id"), user.get("tenant_id")),
        ).fetchall()
    candidates = [_native_candidate_preview(row) for row in rows]
    if clean_query:
        query_terms = [term for term in _important_terms(clean_query) if term]
        candidates = [
            item for item in candidates
            if not query_terms or any(term in item["search_text"] for term in query_terms)
        ]
    return {"native_candidates": [{key: value for key, value in item.items() if key != "search_text"} for item in candidates[:safe_limit]]}


def request_native_candidate_access(user: dict[str, Any], candidate_user_id: str, *, resume_version_id: str | None = None, message: str | None = None) -> dict[str, Any]:
    _require_recruiter(user)
    if not user.get("tenant_id"):
        raise HTTPException(status_code=403, detail="tenant recruiter required")
    with db() as conn:
        candidate = conn.execute(
            """
            select candidate_profiles.profile_json, candidate_profiles.privacy_settings
            from users
            join candidate_profiles on candidate_profiles.user_id=users.id
            where users.id=%s and users.role='candidate'
            """,
            (candidate_user_id,),
        ).fetchone()
        if not candidate:
            raise HTTPException(status_code=404, detail="native candidate not found")
        privacy_settings = _normalize_privacy_settings(candidate["privacy_settings"] or {})
        if not privacy_settings.get("candidate_signal_native_search_enabled"):
            raise HTTPException(status_code=404, detail="native candidate not found")
        existing = conn.execute(
            """
            select *
            from candidate_native_access_requests
            where candidate_user_id=%s
              and tenant_id=%s
              and status in ('pending', 'approved')
            order by created_at desc
            limit 1
            """,
            (candidate_user_id, user["tenant_id"]),
        ).fetchone()
        if existing:
            return {"access_request": _access_request_row(existing, candidate_side=False)}
        row = conn.execute(
            """
            insert into candidate_native_access_requests
              (candidate_user_id, recruiter_user_id, tenant_id, resume_version_id, request_message, permissions_json, status)
            values (%s, %s, %s, %s, %s, '{"include_pii": true}'::jsonb, 'pending')
            returning *
            """,
            (candidate_user_id, user["id"], user["tenant_id"], resume_version_id, _clean_optional_text(message)),
        ).fetchone()
        conn.commit()
    return {"access_request": _access_request_row(row, candidate_side=False)}


def list_candidate_access_requests(user: dict[str, Any]) -> dict[str, Any]:
    _require_candidate(user)
    with db() as conn:
        rows = conn.execute(
            """
            select candidate_native_access_requests.*, tenants.name as tenant_name, users.email as recruiter_email
            from candidate_native_access_requests
            left join tenants on tenants.id=candidate_native_access_requests.tenant_id
            left join users on users.id=candidate_native_access_requests.recruiter_user_id
            where candidate_native_access_requests.candidate_user_id=%s
            order by candidate_native_access_requests.created_at desc
            limit 50
            """,
            (user["id"],),
        ).fetchall()
    return {"access_requests": [_access_request_row(row, candidate_side=True) for row in rows]}


def decide_candidate_access_request(user: dict[str, Any], request_id: str, *, approve: bool) -> dict[str, Any]:
    _require_candidate(user)
    status = "approved" if approve else "denied"
    with db() as conn:
        request_row = conn.execute(
            """
            select candidate_native_access_requests.*, candidate_profiles.profile_json,
                   candidate_profiles.privacy_settings
            from candidate_native_access_requests
            join candidate_profiles on candidate_profiles.user_id=candidate_native_access_requests.candidate_user_id
            where candidate_native_access_requests.id=%s
              and candidate_native_access_requests.candidate_user_id=%s
            """,
            (request_id, user["id"]),
        ).fetchone()
        if not request_row:
            raise HTTPException(status_code=404, detail="access request not found")
        snapshot = {}
        if approve:
            snapshot = _candidate_profile_for_recruiter(dict(request_row["profile_json"] or {}), include_pii=True)
        row = conn.execute(
            """
            update candidate_native_access_requests
            set status=%s, approved_snapshot_json=%s, updated_at=now(), decided_at=now()
            where id=%s and candidate_user_id=%s
            returning *
            """,
            (status, Jsonb(snapshot), request_id, user["id"]),
        ).fetchone()
        conn.commit()
    return {"access_request": _access_request_row(row, candidate_side=True)}


def list_resume_versions(user: dict[str, Any]) -> dict[str, Any]:
    _require_candidate(user)
    with db() as conn:
        rows = conn.execute(
            """
            select id, title, target_role, status, resume_json, created_at, updated_at
            from candidate_resume_versions
            where candidate_user_id=%s
              and status <> 'archived'
            order by updated_at desc
            """,
            (user["id"],),
        ).fetchall()
    return {"versions": [_version_row(row, include_resume=False) for row in rows]}


def create_resume_version(user: dict[str, Any], *, title: str, target_role: str | None = None, resume_json: dict[str, Any] | None = None) -> dict[str, Any]:
    _require_candidate(user)
    clean_title = title.strip()
    if not clean_title:
        raise HTTPException(status_code=400, detail="resume version title is required")
    profile_payload = get_candidate_profile(user)["profile"]
    resume = _normalize_resume(resume_json or build_resume_from_profile(profile_payload, target_role=target_role))
    with db() as conn:
        row = conn.execute(
            """
            insert into candidate_resume_versions
              (candidate_user_id, title, target_role, resume_json, profile_snapshot_json, status)
            values (%s, %s, %s, %s, %s, 'active')
            returning id, title, target_role, status, resume_json, created_at, updated_at
            """,
            (user["id"], clean_title, _clean_optional_text(target_role), Jsonb(resume), Jsonb(profile_payload)),
        ).fetchone()
        conn.commit()
    return {"version": _version_row(row, include_resume=True)}


def get_resume_version(user: dict[str, Any], version_id: str) -> dict[str, Any]:
    _require_candidate(user)
    row = _load_resume_version(user, version_id)
    return {"version": _version_row(row, include_resume=True)}


def archive_resume_version(user: dict[str, Any], version_id: str) -> dict[str, Any]:
    _require_candidate(user)
    with db() as conn:
        row = conn.execute(
            """
            update candidate_resume_versions
            set status='archived', updated_at=now()
            where id=%s and candidate_user_id=%s and status <> 'archived'
            returning id, title, target_role, status, resume_json, created_at, updated_at
            """,
            (version_id, user["id"]),
        ).fetchone()
        if not row:
            existing = conn.execute(
                """
                select id, title, target_role, status, resume_json, created_at, updated_at
                from candidate_resume_versions
                where id=%s and candidate_user_id=%s
                """,
                (version_id, user["id"]),
            ).fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="resume version not found")
            row = existing
        conn.commit()
    return {"version": _version_row(row, include_resume=True)}


def render_resume_version_html(user: dict[str, Any], version_id: str, *, template: str = "atlas") -> str:
    _require_candidate(user)
    row = _load_resume_version(user, version_id)
    return render_cv_html(row["resume_json"] or {}, template=template)


def render_resume_version_pdf(user: dict[str, Any], version_id: str, *, template: str = "atlas") -> tuple[bytes, str]:
    _require_candidate(user)
    row = _load_resume_version(user, version_id)
    title = _safe_filename(f"{row.get('title') or 'candidate-resume'}.pdf")
    return render_cv_pdf(row["resume_json"] or {}, template=template), title


def match_resume_version_to_requirement(user: dict[str, Any], version_id: str, requirement_text: str) -> dict[str, Any]:
    _require_candidate(user)
    clean_requirement = requirement_text.strip()
    if len(clean_requirement) < 20:
        raise HTTPException(status_code=400, detail="requirement text must be at least 20 characters")
    row = _load_resume_version(user, version_id)
    match = score_resume_against_requirement(row["resume_json"] or {}, clean_requirement)
    with db() as conn:
        saved = conn.execute(
            """
            insert into candidate_requirement_matches
              (candidate_user_id, resume_version_id, requirement_text, match_json)
            values (%s, %s, %s, %s)
            returning id, created_at
            """,
            (user["id"], version_id, clean_requirement, Jsonb(match)),
        ).fetchone()
        conn.commit()
    return {"match": {"id": str(saved["id"]), "created_at": _iso(saved["created_at"]), **match}}


def create_targeted_resume_version(
    user: dict[str, Any],
    version_id: str,
    *,
    requirement_text: str,
    title: str | None = None,
    target_role: str | None = None,
) -> dict[str, Any]:
    _require_candidate(user)
    clean_requirement = requirement_text.strip()
    if len(clean_requirement) < 20:
        raise HTTPException(status_code=400, detail="requirement text must be at least 20 characters")
    base = _load_resume_version(user, version_id)
    base_resume = base["resume_json"] or {}
    inferred_role = _clean_optional_text(target_role) or _infer_target_role_from_requirement(clean_requirement) or _clean_optional_text(base.get("target_role")) or "Target Job"
    match = score_resume_against_requirement(base_resume, clean_requirement)
    tailored_resume = tailor_resume_for_requirement(base_resume, clean_requirement, target_role=inferred_role, match=match)
    clean_title = _clean_optional_text(title) or f"{inferred_role} Resume"
    created = create_resume_version(user, title=clean_title, target_role=inferred_role, resume_json=tailored_resume)
    return {**created, "match": match}


def create_resume_upload(
    user: dict[str, Any],
    *,
    filename: str,
    file_obj: Any,
    mime_type: str | None = None,
    target_role: str | None = None,
    note: str | None = None,
) -> dict[str, Any]:
    _require_candidate(user)
    original_filename = filename or "resume.pdf"
    suffix = Path(original_filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="unsupported file type")
    upload_id = str(uuid.uuid4())
    safe_name = _safe_filename(original_filename)
    upload_dir = CANDIDATE_PORTAL_DATA_DIR / str(user["id"]) / "uploads" / upload_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_path = upload_dir / safe_name
    data = file_obj.read()
    if not data:
        raise HTTPException(status_code=400, detail="resume file is empty")
    stored_path.write_bytes(data)
    digest = hashlib.sha256(data).hexdigest()
    with db() as conn:
        row = conn.execute(
            """
            insert into candidate_resume_uploads (
              id, candidate_user_id, original_filename, stored_path, mime_type, size_bytes,
              sha256, target_role, candidate_note, status, stage, progress
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'queued', 'queued', 5)
            returning *
            """,
            (
                upload_id,
                user["id"],
                original_filename,
                str(stored_path),
                mime_type,
                len(data),
                digest,
                _clean_optional_text(target_role),
                _clean_optional_text(note),
            ),
        ).fetchone()
        conn.commit()
    return {"upload": _upload_row(row)}


def list_resume_uploads(user: dict[str, Any]) -> dict[str, Any]:
    _require_candidate(user)
    with db() as conn:
        rows = conn.execute(
            """
            select *
            from candidate_resume_uploads
            where candidate_user_id=%s
            order by updated_at desc
            limit 20
            """,
            (user["id"],),
        ).fetchall()
    return {"uploads": [_upload_row(row) for row in rows]}


def get_resume_upload(user: dict[str, Any], upload_id: str) -> dict[str, Any]:
    _require_candidate(user)
    row = _load_resume_upload(user["id"], upload_id)
    return {"upload": _upload_row(row)}


def run_resume_upload_parse(upload_id: str, candidate_user_id: str) -> None:
    row = _load_resume_upload(candidate_user_id, upload_id)
    if row["status"] in {"succeeded", "failed"}:
        return
    stored_path = Path(row["stored_path"])
    if not stored_path.exists():
        _mark_upload_failed(upload_id, candidate_user_id, "stored resume file not found")
        return
    try:
        _set_upload_stage(upload_id, candidate_user_id, "running")
        settings = load_settings()
        output_dir = CANDIDATE_PORTAL_DATA_DIR / candidate_user_id / "parsed" / upload_id
        work_dir = CANDIDATE_PORTAL_DATA_DIR / candidate_user_id / "work" / upload_id
        record = parse_file(stored_path, output_dir, work_dir, settings)
        _set_upload_stage(upload_id, candidate_user_id, "profile")
        parsed_profile = profile_from_parsed_resume(record)
        parsed_resume = resume_from_parsed_record(record, target_role=row.get("target_role"))
        needs_review = resume_review_items(record, parsed_profile)
        parse_quality = ((record.get("_metadata") or {}).get("parse_quality") or {})
        raw_text = _read_raw_text(record)
        with db() as conn:
            current = conn.execute(
                "select profile_json from candidate_profiles where user_id=%s",
                (candidate_user_id,),
            ).fetchone()
            merged_profile = _merge_profile_from_upload(dict((current or {}).get("profile_json") or {}), parsed_profile)
            display_name = merged_profile.get("display_name") or None
            headline = merged_profile.get("headline") or ""
            conn.execute(
                """
                update candidate_profiles
                set display_name=%s, headline=%s, profile_json=%s, updated_at=now()
                where user_id=%s
                """,
                (display_name, headline, Jsonb(merged_profile), candidate_user_id),
            )
            if display_name:
                conn.execute("update users set name=%s, updated_at=now() where id=%s", (display_name, candidate_user_id))
            _set_upload_stage_with_conn(conn, upload_id, candidate_user_id, "version")
            version_title = _version_title_for_upload(row, parsed_resume)
            version = conn.execute(
                """
                insert into candidate_resume_versions
                  (candidate_user_id, title, target_role, resume_json, profile_snapshot_json, status)
                values (%s, %s, %s, %s, %s, 'active')
                returning id
                """,
                (
                    candidate_user_id,
                    version_title,
                    row.get("target_role"),
                    Jsonb(parsed_resume),
                    Jsonb(merged_profile),
                ),
            ).fetchone()
            conn.execute(
                """
                update candidate_resume_uploads
                set resume_version_id=%s, status='succeeded', stage='succeeded', progress=100,
                    parsed_profile_json=%s, parsed_resume_json=%s, parsed_record_json=%s,
                    parse_quality_json=%s, needs_review_json=%s, raw_text=%s,
                    updated_at=now(), completed_at=now()
                where id=%s and candidate_user_id=%s
                """,
                (
                    version["id"],
                    Jsonb(parsed_profile),
                    Jsonb(parsed_resume),
                    Jsonb(record),
                    Jsonb(parse_quality),
                    Jsonb(needs_review),
                    raw_text,
                    upload_id,
                    candidate_user_id,
                ),
            )
            conn.commit()
    except Exception as exc:
        _mark_upload_failed(upload_id, candidate_user_id, str(exc))


def profile_from_parsed_resume(record: dict[str, Any]) -> dict[str, Any]:
    contact = dict(record.get("contact") or {})
    links = _unique_text_list([*_as_list(contact.get("links")), *_metadata_link_urls((record.get("_metadata") or {}).get("links"))])
    classified = _classify_links(links)
    derived = record.get("derived") or {}
    hr_profile = derived.get("hr_profile") or {}
    skills = _unique_text_list([*_as_list(record.get("skills")), *_all_technologies(record)])
    profile = {
        "display_name": record.get("name") or "",
        "headline": hr_profile.get("current_title") or _first_text(record.get("experience"), "title") or "",
        "summary": record.get("summary") or "",
        "summary_highlights": _summary_highlights(record),
        "ai_enhancement": _candidate_llm_enhancement(record),
        "current_location": contact.get("location") or _latest_location(record.get("experience")) or "",
        "email": contact.get("email") or "",
        "phone": contact.get("phone") or "",
        "linkedin_url": classified.get("linkedin_url") or "",
        "portfolio_url": classified.get("portfolio_url") or "",
        "github_url": classified.get("github_url") or "",
        "skills": skills,
        "skill_groups": _skill_groups(record, skills),
        "experience": _as_dict_list(record.get("experience")),
        "education": _as_dict_list(record.get("education")),
        "certifications": _as_list(record.get("certifications")),
        "projects": _as_dict_list(record.get("projects")),
        "awards": _as_list(record.get("awards")),
        "publications": _as_list(record.get("publications")),
        "languages": _as_list(record.get("languages")),
        "other_sections": record.get("other_sections") or {},
        "links": links,
    }
    return _normalize_profile(profile)


def resume_from_parsed_record(record: dict[str, Any], *, target_role: str | None = None) -> dict[str, Any]:
    profile = profile_from_parsed_resume(record)
    resume = build_resume_from_profile(profile, target_role=target_role)
    resume["source_document_id"] = record.get("document_id")
    resume["source_filename"] = Path(str(record.get("source_file") or "")).name
    resume["parse_quality"] = ((record.get("_metadata") or {}).get("parse_quality") or {})
    resume["summary_highlights"] = _summary_highlights(record) or _as_list(profile.get("summary_highlights"))
    resume["ai_enhancement"] = _candidate_llm_enhancement(record) or profile.get("ai_enhancement") or {}
    resume["skill_groups"] = _skill_groups(record, resume.get("skills") or [])
    resume["awards"] = _as_list(record.get("awards")) or _as_list(profile.get("awards"))
    resume["publications"] = _as_list(record.get("publications")) or _as_list(profile.get("publications"))
    resume["languages"] = _as_list(record.get("languages")) or _as_list(profile.get("languages"))
    resume["other_sections"] = record.get("other_sections") or {}
    resume["links"] = _unique_text_list([*_as_list(resume.get("links")), *_as_list(profile.get("links"))])
    return _normalize_resume(resume)


def resume_review_items(record: dict[str, Any], profile: dict[str, Any]) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    if not profile.get("current_location"):
        items.append({"field": "current_location", "label": "Current location", "reason": "No reliable location was extracted from the resume header or latest role."})
    if not profile.get("linkedin_url"):
        items.append({"field": "linkedin_url", "label": "LinkedIn URL", "reason": "No LinkedIn URL was found in visible text or PDF annotations."})
    if not profile.get("phone"):
        items.append({"field": "phone", "label": "Phone", "reason": "Phone was not found or was not parseable."})
    if not profile.get("experience"):
        items.append({"field": "experience", "label": "Work experience", "reason": "No work history was extracted."})
    if not profile.get("education"):
        items.append({"field": "education", "label": "Education", "reason": "No education history was extracted."})
    if not profile.get("skills"):
        items.append({"field": "skills", "label": "Skills", "reason": "No skills were extracted into structured data."})
    parse_quality = ((record.get("_metadata") or {}).get("parse_quality") or {})
    if parse_quality.get("deep_parse_status") == "failed":
        items.append({"field": "deep_parse", "label": "Deep analysis", "reason": "The factual parse succeeded, but richer intelligence needs a retry."})
    coverage_score = parse_quality.get("coverage_score")
    if isinstance(coverage_score, (int, float)) and coverage_score < 0.8:
        items.append({"field": "coverage", "label": "Profile completeness", "reason": f"Primary field coverage is {round(coverage_score * 100)}%."})
    return items


def build_resume_from_profile(profile: dict[str, Any], *, target_role: str | None = None) -> dict[str, Any]:
    normalized = _normalize_profile(profile)
    return {
        "name": normalized.get("display_name") or "",
        "headline": target_role or normalized.get("headline") or "",
        "summary": normalized.get("summary") or "",
        "summary_highlights": normalized.get("summary_highlights") or [],
        "ai_enhancement": normalized.get("ai_enhancement") or {},
        "contact": {
            "location": normalized.get("current_location") or "",
            "email": normalized.get("email") or "",
            "phone": normalized.get("phone") or "",
            "linkedin_url": normalized.get("linkedin_url") or "",
            "portfolio_url": normalized.get("portfolio_url") or "",
            "github_url": normalized.get("github_url") or "",
        },
        "skills": normalized.get("skills") or [],
        "skill_groups": normalized.get("skill_groups") or {},
        "experience": normalized.get("experience") or [],
        "education": normalized.get("education") or [],
        "certifications": normalized.get("certifications") or [],
        "projects": normalized.get("projects") or [],
        "awards": normalized.get("awards") or [],
        "publications": normalized.get("publications") or [],
        "languages": normalized.get("languages") or [],
        "other_sections": normalized.get("other_sections") or {},
        "links": normalized.get("links") or [],
    }


_RESUME_TEMPLATES = {
    "atlas": {"font": "Inter, Arial, sans-serif", "accent": "#355c7d", "rule": "#d8e3eb", "name": 34, "section": 14},
    "classic": {"font": "Georgia, 'Times New Roman', serif", "accent": "#222222", "rule": "#222222", "name": 32, "section": 13},
    "modern": {"font": "Aptos, Calibri, Arial, sans-serif", "accent": "#1f4d5a", "rule": "#c8d7de", "name": 35, "section": 13},
    "compact": {"font": "Arial, sans-serif", "accent": "#263241", "rule": "#d7dde5", "name": 29, "section": 12},
    "executive": {"font": "Georgia, 'Times New Roman', serif", "accent": "#384152", "rule": "#c7ced8", "name": 33, "section": 13},
    "technical": {"font": "'IBM Plex Sans', Arial, sans-serif", "accent": "#234e70", "rule": "#cbdbea", "name": 32, "section": 12},
    "academic": {"font": "Georgia, 'Times New Roman', serif", "accent": "#3f3f46", "rule": "#d4d4d8", "name": 31, "section": 13},
    "startup": {"font": "Arial, sans-serif", "accent": "#164e63", "rule": "#bae6fd", "name": 34, "section": 13},
    "consulting": {"font": "Helvetica, Arial, sans-serif", "accent": "#334155", "rule": "#cbd5e1", "name": 33, "section": 12},
    "minimal": {"font": "Helvetica, Arial, sans-serif", "accent": "#111827", "rule": "#e5e7eb", "name": 31, "section": 12},
}


def _resume_template(template: str | None) -> dict[str, Any]:
    key = _clean_optional_text(template or "atlas").lower()
    return _RESUME_TEMPLATES.get(key, _RESUME_TEMPLATES["atlas"])


def render_cv_html(resume: dict[str, Any], *, template: str = "atlas") -> str:
    normalized = _normalize_resume(resume)
    contact = normalized.get("contact") or {}
    theme = _resume_template(template)
    parts = [
        "<!doctype html><html><head><meta charset='utf-8'>",
        "<title>Candidate CV</title>",
        (
            "<style>"
            f":root{{--accent:{theme['accent']};--rule:{theme['rule']};--font:{theme['font']};--name:{theme['name']}px;--section:{theme['section']}px}}"
            "body{font-family:var(--font);color:#172033;margin:42px auto;max-width:820px;line-height:1.42;background:#fff}"
            "h1{font-size:var(--name);margin:0 0 4px;letter-spacing:-.03em;text-align:center}"
            "h2{font-size:var(--section);text-transform:uppercase;letter-spacing:.12em;border-bottom:1px solid var(--rule);padding-bottom:6px;margin-top:24px;color:var(--accent)}"
            ".meta{color:#536273;margin-bottom:14px;text-align:center}.contact{text-align:center;color:#536273;font-size:13px;margin-bottom:18px}"
            ".item{margin:13px 0}.item h3{font-size:16px;margin:0;color:#111827}.dates,.tech,.links{color:#667789;font-size:12.5px}"
            ".workstream{margin:10px 0 0 16px}ul{margin:7px 0 0 20px;padding:0}li{margin:3px 0}"
            ".skills span{display:inline-block;border:1px solid #d8e1e8;border-radius:999px;padding:3px 9px;margin:3px;font-size:12.5px}"
            ".skillGroup{margin:7px 0}.skillGroup strong{display:inline-block;min-width:150px;color:#111827}"
            "</style>"
        ),
        "</head><body>",
        f"<h1>{_e(normalized.get('name'))}</h1>",
        f"<div class='meta'>{_e(normalized.get('headline'))}</div>",
        _contact_line(contact),
        f"<p>{_e(normalized.get('summary'))}</p>" if normalized.get("summary") else "",
    ]
    highlights = _as_list(normalized.get("summary_highlights"))
    if highlights:
        parts.extend(["<h2>Summary Highlights</h2>", "<ul>", "".join(f"<li>{_e(item)}</li>" for item in highlights), "</ul>"])
    skills = _as_list(normalized.get("skills"))
    skill_groups = normalized.get("skill_groups") or {}
    if skill_groups:
        parts.append("<h2>Skills</h2>")
        for label, values in skill_groups.items():
            items = _as_list(values)
            if items:
                parts.append(f"<div class='skillGroup'><strong>{_e(label)}</strong> {_e(', '.join(items))}</div>")
    elif skills:
        parts.extend(["<h2>Skills</h2>", "<div class='skills'>", "".join(f"<span>{_e(skill)}</span>" for skill in skills), "</div>"])
    parts.extend(_section_items("Experience", normalized.get("experience") or [], "company", "title"))
    parts.extend(_section_items("Projects", normalized.get("projects") or [], "name", "role"))
    parts.extend(_section_items("Education", normalized.get("education") or [], "school", "degree"))
    certs = _as_list(normalized.get("certifications"))
    if certs:
        parts.extend(["<h2>Certifications</h2>", "<ul>", "".join(f"<li>{_e(item)}</li>" for item in certs), "</ul>"])
    for title, values in [
        ("Awards", normalized.get("awards")),
        ("Publications", normalized.get("publications")),
        ("Languages", normalized.get("languages")),
    ]:
        items = _as_list(values)
        if items:
            parts.extend([f"<h2>{_e(title)}</h2>", "<ul>", "".join(f"<li>{_e(item)}</li>" for item in items), "</ul>"])
    other_sections = normalized.get("other_sections") if isinstance(normalized.get("other_sections"), dict) else {}
    for title, values in other_sections.items():
        items = _as_list(values)
        if items:
            parts.extend([f"<h2>{_e(_section_title(title))}</h2>", "<ul>", "".join(f"<li>{_e(item)}</li>" for item in items), "</ul>"])
    parts.append("</body></html>")
    return "".join(parts)


def render_cv_pdf(resume: dict[str, Any], *, template: str = "atlas") -> bytes:
    """Render a polished, ATS-safe text PDF without browser dependencies."""
    normalized = _normalize_resume(resume)
    contact = normalized.get("contact") or {}
    doc = _PdfResumeDocument(template=template)
    doc.header(
        normalized.get("name") or "Candidate Resume",
        normalized.get("headline"),
        " | ".join(_as_list([
            contact.get("location"),
            contact.get("email"),
            contact.get("phone"),
            contact.get("linkedin_url"),
            contact.get("portfolio_url"),
            contact.get("github_url"),
        ])),
    )
    doc.paragraph(normalized.get("summary"), max_lines=6)

    highlights = _as_list(normalized.get("summary_highlights"))
    if highlights:
        doc.section("Summary")
        for item in highlights[:6]:
            doc.bullet(item)

    skills = _as_list(normalized.get("skills"))
    skill_groups = normalized.get("skill_groups") or {}
    if skill_groups:
        doc.section("Skills")
        for label, values in skill_groups.items():
            items = _as_list(values)
            if items:
                doc.labeled_line(str(label), ", ".join(items))
    elif skills:
        doc.section("Skills")
        doc.paragraph(", ".join(skills))

    doc.items_section("Professional Experience", normalized.get("experience") or [], "company", "title")
    doc.items_section("Projects", normalized.get("projects") or [], "name", "role")
    doc.items_section("Education", normalized.get("education") or [], "school", "degree")

    for title, values in [
        ("Certifications", normalized.get("certifications")),
        ("Awards", normalized.get("awards")),
        ("Publications", normalized.get("publications")),
        ("Languages", normalized.get("languages")),
    ]:
        items = _as_list(values)
        if items:
            doc.section(title)
            for item in items[:18]:
                doc.bullet(item)

    other_sections = normalized.get("other_sections") if isinstance(normalized.get("other_sections"), dict) else {}
    for title, values in other_sections.items():
        items = _as_list(values)
        if items:
            doc.section(_section_title(title))
            for item in items[:18]:
                doc.bullet(item)

    extra_links = _unique_text_list([
        *_as_list(normalized.get("links")),
        contact.get("linkedin_url"),
        contact.get("portfolio_url"),
        contact.get("github_url"),
    ])
    if extra_links:
        doc.section("Links")
        for item in extra_links[:10]:
            doc.paragraph(item, style="meta", max_lines=2)

    return doc.render()


class _PdfResumeDocument:
    page_width = 612
    page_height = 792
    margin_x = 50
    right_x = page_width - margin_x
    top_y = 744
    bottom_y = 54
    styles = {
        "name": ("F2", 21, 25, "dark"),
        "headline": ("F3", 10, 15, "muted"),
        "meta": ("F1", 8.5, 12, "muted"),
        "section": ("F2", 10.2, 16, "dark"),
        "item_title": ("F2", 10.5, 14, "dark"),
        "body": ("F1", 9.4, 12.8, "body"),
        "bullet": ("F1", 9.2, 12.6, "body"),
        "label": ("F2", 9.2, 12.6, "body"),
    }

    def __init__(self, *, template: str = "atlas") -> None:
        self.template = _clean_optional_text(template).lower() or "atlas"
        self.theme = _resume_template(self.template)
        if self.template == "compact":
            self.margin_x = 42
            self.right_x = self.page_width - self.margin_x
            self.styles = {**self.styles, "name": ("F2", 18.5, 22, "dark"), "body": ("F1", 8.8, 11.6, "body"), "bullet": ("F1", 8.7, 11.4, "body")}
        elif self.template in {"classic", "executive", "academic"}:
            self.styles = {**self.styles, "name": ("F2", 21.5, 25, "dark"), "section": ("F2", 10.6, 16, "accent")}
        elif self.template in {"technical", "startup"}:
            self.styles = {**self.styles, "name": ("F2", 20.5, 24, "dark"), "section": ("F2", 10.4, 16, "accent")}
        self.pages: list[list[str]] = [[]]
        self.y = self.top_y

    def header(self, name: Any, headline: Any, contact_line: Any) -> None:
        self._text(name, self.page_width / 2, self.y, "name", align="center")
        self.y -= 18
        if _pdf_clean_text(headline):
            self._wrapped(str(headline), self.margin_x + 26, self.right_x - 26, "headline", align="center", max_lines=2)
        if _pdf_clean_text(contact_line):
            self._wrapped(str(contact_line), self.margin_x + 8, self.right_x - 8, "meta", align="center", max_lines=2)
        self.y -= 5
        self._rule(self.margin_x, self.right_x, self.y)
        self.y -= 16

    def section(self, title: str) -> None:
        self._ensure(34)
        if self.y < self.top_y - 28:
            self.y -= 5
        clean = _pdf_clean_text(title).upper()
        self._text(clean, self.margin_x, self.y, "section")
        self._rule(self.margin_x + min(175, max(80, len(clean) * 6.2)), self.right_x, self.y + 3, color="rule_light")
        self.y -= 16

    def paragraph(self, value: Any, *, style: str = "body", max_lines: int | None = None) -> None:
        if not _pdf_clean_text(value):
            return
        self._wrapped(str(value), self.margin_x, self.right_x, style, max_lines=max_lines)
        self.y -= 3

    def labeled_line(self, label: str, value: str) -> None:
        if not _pdf_clean_text(value):
            return
        self._ensure(18)
        label_text = _pdf_clean_text(label)
        label_width = min(145, max(72, len(label_text) * 5.2))
        self._text(label_text, self.margin_x, self.y, "label")
        self._wrapped(value, self.margin_x + label_width, self.right_x, "body", max_lines=3)
        self.y -= 2

    def bullet(self, value: Any, *, indent: int = 0) -> None:
        clean = _pdf_clean_text(value)
        if not clean:
            return
        bullet_x = self.margin_x + indent
        text_x = bullet_x + 13
        self._ensure(16)
        self._text("-", bullet_x, self.y, "bullet")
        self._wrapped(clean, text_x, self.right_x, "bullet", max_lines=4)
        self.y -= 1

    def items_section(self, title: str, items: list[dict[str, Any]], place_key: str, title_key: str) -> None:
        normalized_items = [item for item in items if isinstance(item, dict)]
        if not normalized_items:
            return
        self.section(title)
        for item in normalized_items:
            self.item(item, place_key, title_key)

    def item(self, item: dict[str, Any], place_key: str, title_key: str) -> None:
        item_title = _pdf_clean_text(item.get(title_key) or item.get("title") or item.get("degree") or item.get("role") or item.get("name"))
        place = _pdf_clean_text(item.get(place_key) or item.get("company") or item.get("school"))
        heading = " - ".join(part for part in [item_title, place] if part)
        meta = " | ".join(_as_list([item.get("start_date"), item.get("end_date"), item.get("location")]))
        self._ensure(38)
        if heading:
            self._text(heading, self.margin_x, self.y, "item_title")
            self.y -= 13
        if meta:
            self._wrapped(meta, self.margin_x, self.right_x, "meta", max_lines=2)
        technologies = ", ".join(_as_list(item.get("technologies")))
        if technologies:
            self._wrapped(technologies, self.margin_x, self.right_x, "headline", max_lines=2)
        for bullet in _as_list(item.get("bullets") or item.get("details") or item.get("description"))[:8]:
            self.bullet(bullet)
        for link in _as_list(item.get("links"))[:3]:
            self.paragraph(link, style="meta", max_lines=1)
        for workstream in item.get("workstreams") or []:
            if not isinstance(workstream, dict):
                continue
            stream_name = _pdf_clean_text(workstream.get("name") or workstream.get("role"))
            if stream_name:
                self._ensure(20)
                self._text(stream_name, self.margin_x + 14, self.y, "item_title")
                self.y -= 12
            stream_tech = ", ".join(_as_list(workstream.get("technologies")))
            if stream_tech:
                self._wrapped(stream_tech, self.margin_x + 14, self.right_x, "meta", max_lines=2)
            for bullet in _as_list(workstream.get("bullets") or workstream.get("details") or workstream.get("description"))[:5]:
                self.bullet(bullet, indent=14)
        self.y -= 6

    def render(self) -> bytes:
        return _build_pdf_document(self.pages, self.page_width, self.page_height)

    def _wrapped(self, value: str, x: float, right: float, style: str, *, align: str = "left", max_lines: int | None = None) -> None:
        font, size, leading, _color = self.styles.get(style, self.styles["body"])
        clean = _pdf_clean_text(value)
        if not clean:
            return
        wrap_width = max(20, int((right - x) / max(size * 0.48, 1)))
        lines = textwrap.wrap(clean, width=wrap_width, break_long_words=False, replace_whitespace=True) or [clean]
        if max_lines is not None and len(lines) > max_lines:
            lines = lines[:max_lines]
            lines[-1] = f"{lines[-1].rstrip('.')}..."
        for line in lines:
            self._ensure(leading + 2)
            draw_x = (x + right) / 2 if align == "center" else x
            self._text(line, draw_x, self.y, style, align=align)
            self.y -= leading

    def _text(self, value: Any, x: float, y: float, style: str, *, align: str = "left") -> None:
        font, size, _leading, color = self.styles.get(style, self.styles["body"])
        self.pages[-1].append(_pdf_text_command(value, x, y, font, size, align=align, color=color))

    def _rule(self, x1: float, x2: float, y: float, *, color: str = "rule") -> None:
        if color == "rule":
            stroke = _hex_to_pdf_rgb(str(self.theme.get("rule") or "#d8e3eb"))
        else:
            stroke = "0.86 0.89 0.92"
        self.pages[-1].append(f"{stroke} RG 0.7 w {x1:g} {y:g} m {x2:g} {y:g} l S")

    def _ensure(self, height: float) -> None:
        if self.y - height >= self.bottom_y:
            return
        self.pages.append([])
        self.y = self.top_y


def _build_pdf_document(page_commands: list[list[str]], page_width: int, page_height: int) -> bytes:
    page_count = max(1, len(page_commands))
    pages_obj_num = 2
    objects: list[bytes] = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"",  # filled after page object numbers are known
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>",
    ]
    page_obj_nums: list[int] = []
    for commands in page_commands or [[]]:
        content = "\n".join(commands).encode("latin-1", errors="replace")
        content_obj_num = len(objects) + 2
        page_obj_num = len(objects) + 1
        page_obj_nums.append(page_obj_num)
        objects.append(
            (
                f"<< /Type /Page /Parent {pages_obj_num} 0 R /MediaBox [0 0 {page_width} {page_height}] "
                f"/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents {content_obj_num} 0 R >>"
            ).encode("latin-1")
        )
        objects.append(b"<< /Length " + str(len(content)).encode("ascii") + b" >>\nstream\n" + content + b"\nendstream")
    kids = " ".join(f"{number} 0 R" for number in page_obj_nums)
    objects[1] = f"<< /Type /Pages /Kids [{kids}] /Count {page_count} >>".encode("latin-1")

    pdf = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf += f"{index} 0 obj\n".encode("ascii") + obj + b"\nendobj\n"
    xref_offset = len(pdf)
    pdf += f"xref\n0 {len(objects) + 1}\n".encode("ascii")
    pdf += b"0000000000 65535 f \n"
    for offset in offsets[1:]:
        pdf += f"{offset:010d} 00000 n \n".encode("ascii")
    pdf += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n"
    ).encode("ascii")
    return pdf


def _pdf_text_command(value: Any, x: float, y: float, font: str, size: float, *, align: str = "left", color: str = "body") -> str:
    clean = _pdf_clean_text(value)
    if not clean:
        return ""
    color_map = {
        "dark": "0.08 0.12 0.18",
        "body": "0.12 0.16 0.22",
        "muted": "0.36 0.43 0.51",
        "footer": "0.56 0.61 0.67",
    }
    draw_x = x
    estimated_width = len(clean) * size * 0.48
    if align == "center":
        draw_x -= estimated_width / 2
    elif align == "right":
        draw_x -= estimated_width
    return f"{color_map.get(color, color_map['body'])} rg BT /{font} {size:g} Tf {draw_x:g} {y:g} Td ({_pdf_escape(clean)}) Tj ET"


def _hex_to_pdf_rgb(value: str) -> str:
    clean = value.strip().lstrip("#")
    if len(clean) != 6:
        return "0.73 0.78 0.83"
    try:
        red = int(clean[0:2], 16) / 255
        green = int(clean[2:4], 16) / 255
        blue = int(clean[4:6], 16) / 255
    except ValueError:
        return "0.73 0.78 0.83"
    return f"{red:.3f} {green:.3f} {blue:.3f}"


def _pdf_clean_text(value: Any) -> str:
    text = str(value or "")
    replacements = {
        "\u2022": "-",
        "\u2013": "-",
        "\u2014": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\ufb01": "fi",
        "\ufb02": "fl",
    }
    for source, replacement in replacements.items():
        text = text.replace(source, replacement)
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", text).strip()


def _pdf_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def score_resume_against_requirement(resume: dict[str, Any], requirement_text: str) -> dict[str, Any]:
    normalized = _normalize_resume(resume)
    resume_text = _resume_search_text(normalized)
    requirement_terms = _important_terms(requirement_text)
    resume_terms = _important_terms(resume_text)
    matched = sorted(requirement_terms & resume_terms)
    missing = sorted(requirement_terms - resume_terms)
    coverage = len(matched) / max(1, len(requirement_terms))
    skill_terms = {str(skill).strip().lower() for skill in _as_list(normalized.get("skills")) if str(skill).strip()}
    skill_hits = sorted(term for term in requirement_terms if term in skill_terms or any(term in skill for skill in skill_terms))
    score = min(100, round((coverage * 72) + (min(len(skill_hits), 8) * 3.5)))
    if score >= 80:
        label = "strong_fit"
        next_action = "Use this version for the application, then tailor evidence bullets for the highest-weight requirements."
    elif score >= 65:
        label = "review_worthy"
        next_action = "Add stronger evidence for the missing terms before applying."
    else:
        label = "needs_tailoring"
        next_action = "Create a targeted resume version before applying."
    return {
        "score": score,
        "fit_label": label,
        "matched_terms": matched[:40],
        "missing_or_unclear_terms": missing[:40],
        "skill_hits": skill_hits[:25],
        "summary": f"This resume version covers {round(coverage * 100)}% of the requirement signal terms found by the deterministic candidate-side matcher.",
        "recommended_next_action": next_action,
        "privacy_note": "Candidate-side matching uses only the candidate-owned resume data and requirement text. It does not run LinkedIn verification.",
    }


def tailor_resume_for_requirement(
    resume: dict[str, Any],
    requirement_text: str,
    *,
    target_role: str | None = None,
    match: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Create a candidate-approved targeted version without inventing facts.

    The function only reorders, labels, and adds explicit "missing/unclear"
    metadata. It does not fabricate employers, dates, tools, locations, or
    quantified impact that is not already in the resume text.
    """
    normalized = _normalize_resume(copy.deepcopy(resume or {}))
    clean_requirement = requirement_text.strip()
    match_payload = match or score_resume_against_requirement(normalized, clean_requirement)
    role = _clean_optional_text(target_role) or _infer_target_role_from_requirement(clean_requirement) or _clean_optional_text(normalized.get("headline"))
    matched_terms = _as_list(match_payload.get("matched_terms"))
    missing_terms = _as_list(match_payload.get("missing_or_unclear_terms"))
    skill_hits = _as_list(match_payload.get("skill_hits"))

    if role:
        normalized["headline"] = role
    normalized["skills"] = _prioritize_resume_skills(normalized.get("skills"), [*skill_hits, *matched_terms])
    normalized["summary_highlights"] = _targeted_summary_highlights(normalized, role, matched_terms)
    normalized["experience"] = _tag_resume_items_for_requirement(normalized.get("experience"), matched_terms)
    normalized["projects"] = _tag_resume_items_for_requirement(normalized.get("projects"), matched_terms)
    normalized["job_tailoring"] = {
        "target_role": role or "",
        "match_score": match_payload.get("score"),
        "fit_label": match_payload.get("fit_label"),
        "matched_terms": matched_terms[:40],
        "missing_or_unclear_terms": missing_terms[:40],
        "candidate_guardrail": "Only facts already present in the candidate-owned resume were used. Missing terms are marked unclear instead of being added as claims.",
    }
    return _normalize_resume(normalized)


def _infer_target_role_from_requirement(requirement_text: str) -> str:
    text = re.sub(r"\s+", " ", requirement_text or "").strip()
    patterns = [
        r"(?:hiring|seeking|looking for|need|needs|role is for|opening for)\s+(?:an?|the)?\s*([A-Za-z][A-Za-z0-9 /&+.-]{2,70}?(?:Engineer|Developer|Analyst|Scientist|Architect|Manager|Consultant|Specialist|Designer|Lead|Director))\b",
        r"\b(Job Title|Title|Role)\s*[:\-]\s*([A-Za-z][A-Za-z0-9 /&+.-]{2,70})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if not match:
            continue
        candidate = match.group(match.lastindex or 1)
        if match.lastindex and match.lastindex > 1:
            candidate = match.group(match.lastindex)
        clean = _clean_role_title(candidate)
        if clean:
            return clean
    return ""


def _clean_role_title(value: Any) -> str:
    text = _clean_optional_text(value) or ""
    text = re.split(r"[.;,\n]", text, maxsplit=1)[0].strip(" :-")
    text = re.sub(r"\s+", " ", text)
    words = text.split()
    if len(words) > 8:
        text = " ".join(words[:8])
    return text


def _prioritize_resume_skills(skills: Any, priority_terms: list[str]) -> list[str]:
    current = _as_list(skills)
    priorities = [term.lower() for term in _as_list(priority_terms)]
    if not current or not priorities:
        return current

    def priority_score(skill: str) -> tuple[int, int, str]:
        lowered = skill.lower()
        for index, term in enumerate(priorities):
            if term and (term == lowered or term in lowered or lowered in term):
                return (0, index, lowered)
        return (1, len(priorities), lowered)

    return _unique_text_list(sorted(current, key=priority_score))


def _targeted_summary_highlights(normalized: dict[str, Any], role: str | None, matched_terms: list[str]) -> list[str]:
    existing = _as_list(normalized.get("summary_highlights"))
    meaningful_terms = [term for term in _as_list(matched_terms) if len(term) > 3][:8]
    if not meaningful_terms:
        return existing
    label = f"Targeted evidence for {role}: " if role else "Targeted evidence: "
    addition = f"{label}{', '.join(meaningful_terms)} are already present in the resume evidence."
    return _unique_text_list([addition, *existing])[:10]


def _tag_resume_items_for_requirement(items: Any, matched_terms: list[str]) -> list[dict[str, Any]]:
    terms = [term.lower() for term in _as_list(matched_terms) if len(term) > 2]
    tagged: list[dict[str, Any]] = []
    for item in _as_dict_list(items):
        next_item = dict(item)
        text = " ".join(_flatten_dicts([item])).lower()
        tags = [term for term in terms if term in text][:8]
        if tags:
            next_item["targeted_relevance_terms"] = _unique_text_list(tags)
        tagged.append(next_item)
    return tagged


def _assert_candidate_email_available(conn: Any, normalized_email: str) -> None:
    existing = conn.execute(
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
    if existing:
        if existing.get("tenant_name"):
            raise HTTPException(status_code=409, detail="email already belongs to a recruiter workspace")
        raise HTTPException(status_code=409, detail="email is already registered")


def _require_candidate(user: dict[str, Any]) -> None:
    if user.get("platform_role") != "candidate" and user.get("role") != "candidate" and user.get("workspace_access") != "candidate":
        raise HTTPException(status_code=403, detail="candidate account required")


def _require_recruiter(user: dict[str, Any]) -> None:
    if user.get("workspace_access") != "tenant" and not user.get("tenant_id"):
        raise HTTPException(status_code=403, detail="recruiter tenant account required")
    if user.get("platform_role") == "candidate" or user.get("role") == "candidate":
        raise HTTPException(status_code=403, detail="recruiter tenant account required")


def _load_resume_version(user: dict[str, Any], version_id: str) -> Any:
    with db() as conn:
        row = conn.execute(
            """
            select id, title, target_role, status, resume_json, created_at, updated_at
            from candidate_resume_versions
            where id=%s and candidate_user_id=%s
            """,
            (version_id, user["id"]),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="resume version not found")
    return row


def _candidate_public_user(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "email": row["email"],
        "name": row.get("name"),
        "role": "candidate",
        "platform_role": "candidate",
        "tenant_role": None,
        "tenant_id": None,
        "tenant_name": None,
        "workspace_access": "candidate",
        "created_at": _iso(row.get("created_at")),
    }


def _profile_response(row: Any, profile: dict[str, Any]) -> dict[str, Any]:
    return {
        "user_id": str(row["id"]),
        "email": row["email"],
        "profile": _normalize_profile(profile),
        "privacy_settings": _normalize_privacy_settings({}),
        "updated_at": _iso(row.get("created_at")),
    }


def _normalize_privacy_settings(value: dict[str, Any]) -> dict[str, Any]:
    settings = {**DEFAULT_PRIVACY_SETTINGS, **dict(value or {})}
    settings["candidate_signal_native_search_enabled"] = bool(settings.get("candidate_signal_native_search_enabled"))
    settings["pii_visible_to_recruiters"] = bool(settings.get("pii_visible_to_recruiters"))
    settings["pii_permission_required"] = bool(settings.get("pii_permission_required", True))
    settings["allow_linkedin_verification"] = bool(settings.get("allow_linkedin_verification"))
    settings["public_resume_fields"] = [
        item for item in _as_list(settings.get("public_resume_fields"))
        if item in DEFAULT_PRIVACY_SETTINGS["public_resume_fields"]
    ] or list(DEFAULT_PRIVACY_SETTINGS["public_resume_fields"])
    if settings["pii_permission_required"]:
        settings["pii_visible_to_recruiters"] = False
    return settings


def _share_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "resume_version_id": str(row["resume_version_id"]),
        "version_title": row.get("version_title"),
        "label": row["label"],
        "access_token": row["access_token"],
        "permissions": row.get("permissions_json") or {},
        "status": row["status"],
        "expires_at": _iso(row.get("expires_at")),
        "created_at": _iso(row.get("created_at")),
    }


def _application_row(row: Any) -> dict[str, Any]:
    share_permissions = row.get("share_permissions_json") or {}
    return {
        "id": str(row["id"]),
        "candidate_user_id": str(row["candidate_user_id"]),
        "tenant_id": str(row["tenant_id"]) if row.get("tenant_id") else None,
        "campaign_id": str(row["campaign_id"]) if row.get("campaign_id") else None,
        "resume_version_id": str(row["resume_version_id"]) if row.get("resume_version_id") else None,
        "resume_share_id": str(row["resume_share_id"]) if row.get("resume_share_id") else None,
        "version_title": row.get("version_title"),
        "destination_name": row.get("destination_name") or "",
        "destination_type": row.get("destination_type") or "manual",
        "job_title": row.get("job_title") or "",
        "job_url": row.get("job_url") or "",
        "status": row["status"],
        "pii_visibility_status": row.get("pii_visibility_status") or "hidden",
        "candidate_note": row.get("candidate_note") or "",
        "share_url_token": row.get("access_token"),
        "share_status": row.get("share_status"),
        "share_permissions": share_permissions,
        "shared_at": _iso(row.get("shared_at")),
        "created_at": _iso(row.get("created_at")),
        "updated_at": _iso(row.get("updated_at")),
    }


def _normalize_application_destination_type(value: Any) -> str:
    clean = (_clean_optional_text(value) or "manual").lower().replace("-", "_").replace(" ", "_")
    return clean if clean in APPLICATION_DESTINATION_TYPES else "other"


def _normalize_application_status(value: Any) -> str:
    clean = (_clean_optional_text(value) or "shared").lower().replace("-", "_").replace(" ", "_")
    return clean if clean in APPLICATION_STATUSES else "shared"


def _public_share_payload(row: Any) -> dict[str, Any]:
    permissions = row.get("permissions_json") or {}
    resume = _normalize_resume(row.get("resume_json") or {})
    include_pii = bool(permissions.get("include_pii"))
    return {
        "id": str(row["id"]),
        "label": row["label"],
        "version_title": row.get("version_title"),
        "permissions": {"include_pii": include_pii},
        "resume": _resume_for_external_share(resume, include_pii=include_pii),
        "pii_locked": not include_pii,
        "created_at": _iso(row.get("created_at")),
    }


def _resume_for_external_share(resume: dict[str, Any], *, include_pii: bool) -> dict[str, Any]:
    shared = dict(resume)
    contact = dict(shared.get("contact") or {})
    if not include_pii:
        shared["name"] = "Candidate"
        contact["email"] = ""
        contact["phone"] = ""
        contact["linkedin_url"] = ""
        contact["portfolio_url"] = ""
        contact["github_url"] = ""
        shared["links"] = []
    shared["contact"] = contact
    return shared


def _native_candidate_preview(row: Any) -> dict[str, Any]:
    approved_snapshot = row.get("approved_snapshot_json") or {}
    include_pii = bool(approved_snapshot)
    profile = approved_snapshot or _candidate_profile_for_recruiter(dict(row.get("profile_json") or {}), include_pii=False)
    normalized = _normalize_profile(profile)
    search_resume = build_resume_from_profile(normalized)
    return {
        "candidate_user_id": str(row["candidate_user_id"]),
        "resume_version_id": str(row["latest_resume_version_id"]) if row.get("latest_resume_version_id") else None,
        "name": normalized.get("display_name") if include_pii else "candidateSignal native candidate",
        "headline": normalized.get("headline") or "",
        "summary": normalized.get("summary") or "",
        "current_location": normalized.get("current_location") or "",
        "skills": normalized.get("skills") or [],
        "experience": normalized.get("experience") or [],
        "education": normalized.get("education") or [],
        "projects": normalized.get("projects") or [],
        "pii_locked": not include_pii,
        "request_status": row.get("request_status"),
        "updated_at": _iso(row.get("updated_at")),
        "search_text": _resume_search_text(search_resume).lower(),
    }


def _candidate_profile_for_recruiter(profile: dict[str, Any], *, include_pii: bool) -> dict[str, Any]:
    normalized = _normalize_profile(profile)
    if include_pii:
        return normalized
    redacted = dict(normalized)
    redacted["display_name"] = "candidateSignal native candidate"
    redacted["email"] = ""
    redacted["phone"] = ""
    redacted["linkedin_url"] = ""
    redacted["portfolio_url"] = ""
    redacted["github_url"] = ""
    redacted["links"] = []
    return redacted


def _access_request_row(row: Any, *, candidate_side: bool) -> dict[str, Any]:
    payload = {
        "id": str(row["id"]),
        "candidate_user_id": str(row["candidate_user_id"]),
        "recruiter_user_id": str(row["recruiter_user_id"]) if row.get("recruiter_user_id") else None,
        "tenant_id": str(row["tenant_id"]) if row.get("tenant_id") else None,
        "resume_version_id": str(row["resume_version_id"]) if row.get("resume_version_id") else None,
        "status": row["status"],
        "request_message": row.get("request_message"),
        "permissions": row.get("permissions_json") or {},
        "created_at": _iso(row.get("created_at")),
        "updated_at": _iso(row.get("updated_at")),
        "decided_at": _iso(row.get("decided_at")),
    }
    if candidate_side:
        payload["tenant_name"] = row.get("tenant_name")
        payload["recruiter_email"] = row.get("recruiter_email")
    if row.get("status") == "approved" and row.get("approved_snapshot_json"):
        payload["approved_profile"] = row.get("approved_snapshot_json")
    return payload


def _version_row(row: Any, *, include_resume: bool) -> dict[str, Any]:
    payload = {
        "id": str(row["id"]),
        "title": row["title"],
        "target_role": row.get("target_role"),
        "status": row["status"],
        "created_at": _iso(row.get("created_at")),
        "updated_at": _iso(row.get("updated_at")),
    }
    if include_resume:
        payload["resume_json"] = row.get("resume_json") or {}
    return payload


def _upload_row(row: Any) -> dict[str, Any]:
    progress = int(row.get("progress") or CANDIDATE_UPLOAD_STAGES.get(row.get("stage"), (5, ""))[0])
    return {
        "id": str(row["id"]),
        "resume_version_id": str(row["resume_version_id"]) if row.get("resume_version_id") else None,
        "original_filename": row["original_filename"],
        "mime_type": row.get("mime_type"),
        "size_bytes": row.get("size_bytes"),
        "sha256": row.get("sha256"),
        "target_role": row.get("target_role"),
        "candidate_note": row.get("candidate_note"),
        "status": row["status"],
        "stage": row["stage"],
        "stage_label": CANDIDATE_UPLOAD_STAGES.get(row["stage"], (progress, row["stage"]))[1],
        "progress": progress,
        "error_message": row.get("error_message"),
        "parsed_profile_json": row.get("parsed_profile_json") or {},
        "parsed_resume_json": row.get("parsed_resume_json") or {},
        "parse_quality_json": row.get("parse_quality_json") or {},
        "needs_review_json": row.get("needs_review_json") or [],
        "created_at": _iso(row.get("created_at")),
        "updated_at": _iso(row.get("updated_at")),
        "completed_at": _iso(row.get("completed_at")),
    }


def _load_resume_upload(candidate_user_id: str, upload_id: str) -> Any:
    with db() as conn:
        row = conn.execute(
            """
            select *
            from candidate_resume_uploads
            where id=%s and candidate_user_id=%s
            """,
            (upload_id, candidate_user_id),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="candidate resume upload not found")
    return row


def _set_upload_stage(upload_id: str, candidate_user_id: str, stage: str) -> None:
    with db() as conn:
        _set_upload_stage_with_conn(conn, upload_id, candidate_user_id, stage)
        conn.commit()


def _set_upload_stage_with_conn(conn: Any, upload_id: str, candidate_user_id: str, stage: str) -> None:
    progress, _label = CANDIDATE_UPLOAD_STAGES.get(stage, (20, stage))
    status = "running" if stage not in {"queued", "succeeded", "failed"} else stage
    conn.execute(
        """
        update candidate_resume_uploads
        set status=%s, stage=%s, progress=%s, updated_at=now()
        where id=%s and candidate_user_id=%s
        """,
        (status, stage, progress, upload_id, candidate_user_id),
    )


def _mark_upload_failed(upload_id: str, candidate_user_id: str, error_message: str) -> None:
    with db() as conn:
        conn.execute(
            """
            update candidate_resume_uploads
            set status='failed', stage='failed', progress=100, error_message=%s, updated_at=now(), completed_at=now()
            where id=%s and candidate_user_id=%s
            """,
            (error_message[:4000], upload_id, candidate_user_id),
        )
        conn.commit()


def _safe_filename(filename: str) -> str:
    name = Path(filename or "resume.pdf").name
    safe = re.sub(r"[^A-Za-z0-9._ -]+", "_", name).strip(" .")
    return safe or "resume.pdf"


def _merge_profile_from_upload(current: dict[str, Any], parsed: dict[str, Any]) -> dict[str, Any]:
    merged = _normalize_profile(current)
    parsed = _normalize_profile(parsed)
    for key, value in parsed.items():
        if isinstance(value, list):
            if value:
                merged[key] = value
        elif str(value or "").strip():
            merged[key] = value
    return _normalize_profile(merged)


def _version_title_for_upload(row: Any, resume: dict[str, Any]) -> str:
    role = row.get("target_role") or resume.get("headline") or "Parsed resume"
    filename = Path(str(row.get("original_filename") or "resume")).stem
    return f"{role} - {filename}"[:160]


def _read_raw_text(record: dict[str, Any]) -> str:
    path = ((record.get("_metadata") or {}).get("raw_text_path") or "")
    if not path:
        return ""
    try:
        return Path(path).read_text(encoding="utf-8")
    except OSError:
        return ""


def _classify_links(links: list[str]) -> dict[str, str]:
    result = {"linkedin_url": "", "github_url": "", "portfolio_url": ""}
    for link in _unique_text_list(links):
        text = str(link).strip()
        lowered = text.lower()
        if not text:
            continue
        if "linkedin.com/" in lowered:
            if not result["linkedin_url"]:
                result["linkedin_url"] = text
            continue
        if "github.com/" in lowered:
            if not result["github_url"]:
                result["github_url"] = text
            continue
        if not result["portfolio_url"]:
            result["portfolio_url"] = text
    return result


def _metadata_link_urls(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    urls: list[str] = []
    for item in value:
        if isinstance(item, dict):
            url = str(item.get("url") or "").strip()
            if url:
                urls.append(url)
        elif str(item).strip():
            urls.append(str(item).strip())
    return urls


def _summary_highlights(record: dict[str, Any]) -> list[str]:
    intelligence = record.get("candidate_intelligence") or {}
    final_profile = intelligence.get("final_candidate_profile") if isinstance(intelligence, dict) else {}
    hr_intelligence = (
        intelligence.get("hr_intelligence")
        if isinstance(intelligence, dict)
        else {}
    ) or record.get("llm_hr_intelligence") or {}
    recruiter_dashboard = hr_intelligence.get("recruiter_dashboard") if isinstance(hr_intelligence, dict) else {}
    summary = _clean_optional_text(record.get("summary"))
    highlights = _unique_text_list(
        [
            *_as_list((final_profile or {}).get("recruiter_brief")),
            *_as_list((final_profile or {}).get("wow_factor")),
            *_as_list((recruiter_dashboard or {}).get("one_minute_summary")),
            *_signal_texts((recruiter_dashboard or {}).get("strongest_signals")),
            *([summary] if summary else []),
        ]
    )
    return highlights[:10]


def _candidate_llm_enhancement(record: dict[str, Any]) -> dict[str, Any]:
    intelligence = record.get("candidate_intelligence") if isinstance(record.get("candidate_intelligence"), dict) else {}
    final_profile = intelligence.get("final_candidate_profile") if isinstance(intelligence, dict) else {}
    hr_intelligence = (
        intelligence.get("hr_intelligence")
        if isinstance(intelligence, dict)
        else {}
    ) or record.get("llm_hr_intelligence") or {}
    recruiter_dashboard = hr_intelligence.get("recruiter_dashboard") if isinstance(hr_intelligence, dict) else {}
    evidence_audit = intelligence.get("evidence_audit") if isinstance(intelligence, dict) else {}
    timeline_analysis = intelligence.get("timeline_analysis") if isinstance(intelligence, dict) else {}
    summary_card = final_profile.get("summary_card") if isinstance(final_profile, dict) else {}
    detailed_report = hr_intelligence.get("detailed_analyst_report") if isinstance(hr_intelligence, dict) else {}

    enhancement = {
        "source": "llm_deep_resume_intelligence",
        "guardrail": "AI suggestions are derived from resume evidence and should not overwrite factual identity, employer, date, location, or contact fields without review.",
        "headline_suggestion": _clean_optional_text((summary_card or {}).get("headline")) or _clean_optional_text((recruiter_dashboard or {}).get("headline")) or "",
        "recruiter_brief": _unique_text_list([
            *_as_list((final_profile or {}).get("recruiter_brief")),
            *_as_list((recruiter_dashboard or {}).get("one_minute_summary")),
        ]),
        "wow_factor": _unique_text_list(_as_list((final_profile or {}).get("wow_factor"))),
        "ai_notes": _unique_text_list([
            *_as_list((final_profile or {}).get("ai_notes")),
            *_ai_note_texts((hr_intelligence or {}).get("ai_notes") if isinstance(hr_intelligence, dict) else []),
        ]),
        "best_fit_roles": _unique_text_list([
            *_as_list((final_profile or {}).get("best_fit_roles")),
            *_role_texts((hr_intelligence or {}).get("good_fit_roles") if isinstance(hr_intelligence, dict) else []),
        ]),
        "screening_questions": _unique_text_list([
            *_as_list((final_profile or {}).get("screening_questions")),
            *_as_list((recruiter_dashboard or {}).get("questions_to_ask")),
        ]),
        "risk_flags": _unique_text_list([
            *_as_list((final_profile or {}).get("risk_flags")),
            *_concern_texts((recruiter_dashboard or {}).get("possible_concerns")),
        ]),
        "search_keywords": _unique_text_list(_as_list((final_profile or {}).get("search_keywords"))),
        "profile_read": _clean_optional_text((detailed_report or {}).get("profile_read")) or "",
        "career_narrative": _clean_optional_text((detailed_report or {}).get("career_narrative")) or "",
        "chronology_summary": _clean_optional_text((timeline_analysis or {}).get("chronology_summary")) or "",
        "likely_missed_details": _missed_detail_texts((evidence_audit or {}).get("likely_missed_details")),
        "quality_score": (evidence_audit or {}).get("quality_score") if isinstance(evidence_audit, dict) else None,
    }
    return {
        key: value
        for key, value in enhancement.items()
        if value not in ("", None, []) and value != {}
    }


def _ai_note_texts(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    notes: list[str] = []
    for item in value:
        if isinstance(item, dict):
            note = _clean_optional_text(item.get("note") or item.get("summary") or item.get("claim"))
            if note:
                notes.append(note)
        elif str(item).strip():
            notes.append(str(item).strip())
    return notes


def _role_texts(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    roles: list[str] = []
    for item in value:
        if isinstance(item, dict):
            role = _clean_optional_text(item.get("role"))
            reason = _clean_optional_text(item.get("fit_reason"))
            if role and reason:
                roles.append(f"{role}: {reason}")
            elif role:
                roles.append(role)
        elif str(item).strip():
            roles.append(str(item).strip())
    return roles


def _concern_texts(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    concerns: list[str] = []
    for item in value:
        if isinstance(item, dict):
            concern = _clean_optional_text(item.get("concern") or item.get("risk") or item.get("issue"))
            verify = _clean_optional_text(item.get("how_to_verify"))
            if concern and verify:
                concerns.append(f"{concern} Verify: {verify}")
            elif concern:
                concerns.append(concern)
        elif str(item).strip():
            concerns.append(str(item).strip())
    return concerns


def _missed_detail_texts(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    details: list[str] = []
    for item in value:
        if isinstance(item, dict):
            detail = _clean_optional_text(item.get("detail"))
            target = _clean_optional_text(item.get("target_section"))
            if detail and target:
                details.append(f"{detail} ({target})")
            elif detail:
                details.append(detail)
        elif str(item).strip():
            details.append(str(item).strip())
    return details


def _signal_texts(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        if isinstance(item, dict):
            signal = _clean_optional_text(item.get("signal") or item.get("note") or item.get("claim"))
            if signal:
                result.append(signal)
        elif str(item).strip():
            result.append(str(item).strip())
    return result


def _skill_groups(record: dict[str, Any], skills: Any) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = {}
    taxonomy = _skill_taxonomy(record)
    if taxonomy:
        for key, value in taxonomy.items():
            label = _skill_group_label(key)
            values = _as_list(value)
            if values:
                grouped[label] = _unique_text_list(values)

    for skill in _as_list(skills):
        explicit_group, terms = _split_labeled_skill(skill)
        if explicit_group and terms:
            grouped[explicit_group] = _unique_text_list([*grouped.get(explicit_group, []), *terms])
            continue
        label = _infer_skill_group(skill)
        grouped[label] = _unique_text_list([*grouped.get(label, []), skill])

    return {key: values for key, values in grouped.items() if values}


def _skill_taxonomy(record: dict[str, Any]) -> dict[str, Any]:
    intelligence = record.get("llm_hr_intelligence")
    if isinstance(intelligence, dict) and isinstance(intelligence.get("skill_taxonomy"), dict):
        return intelligence["skill_taxonomy"]
    candidate_intelligence = record.get("candidate_intelligence")
    if isinstance(candidate_intelligence, dict):
        hr = candidate_intelligence.get("hr_intelligence")
        if isinstance(hr, dict) and isinstance(hr.get("skill_taxonomy"), dict):
            return hr["skill_taxonomy"]
    return {}


def _skill_group_label(key: str) -> str:
    labels = {
        "programming_languages": "Languages",
        "frameworks_libraries": "Frameworks & Libraries",
        "cloud_platforms": "Cloud & Infrastructure",
        "data_ai_tools": "Data & AI Tools",
        "business_domain_skills": "Domain Skills",
        "leadership_collaboration": "Leadership & Collaboration",
    }
    return labels.get(str(key), str(key).replace("_", " ").title())


def _split_labeled_skill(skill: str) -> tuple[str | None, list[str]]:
    if ":" not in skill:
        return None, []
    label, values = skill.split(":", 1)
    label = _skill_group_label(label.strip().lower().replace(" ", "_"))
    terms = _as_list(values)
    return label, terms


def _infer_skill_group(skill: str) -> str:
    lowered = skill.lower()
    if lowered in {"java", "python", "javascript", "typescript", "bash", "sql", "scala", "go", "golang", "c++", "c#", "c"}:
        return "Languages"
    if any(term in lowered for term in ["spring", "react", "next", "node", "django", "flask", "langchain", "langgraph", "maven", "junit", "mockito", "hibernate", "spark"]):
        return "Frameworks & Libraries"
    if any(term in lowered for term in ["aws", "azure", "gcp", "docker", "kubernetes", "lambda", "ecs", "s3", "cloudformation", "rds", "ec2", "jenkins", "terraform", "gitlab"]):
        return "Cloud & Infrastructure"
    if any(term in lowered for term in ["postgres", "postgresql", "mysql", "mongodb", "redis", "kafka", "opensearch", "databricks", "snowflake", "pandas", "nlp", "rag", "llm", "openai", "whisper", "computer vision"]):
        return "Data & AI Tools"
    if any(term in lowered for term in ["design pattern", "architecture", "optimization", "system design", "agile", "kanban", "sdlc"]):
        return "Engineering Practices"
    return "Other Skills"


def _all_technologies(record: dict[str, Any]) -> list[str]:
    values: list[str] = []
    for collection_name in ("experience", "projects"):
        for item in record.get(collection_name) or []:
            if not isinstance(item, dict):
                continue
            values.extend(_as_list(item.get("technologies")))
            for workstream in item.get("workstreams") or []:
                if isinstance(workstream, dict):
                    values.extend(_as_list(workstream.get("technologies")))
    return _unique_text_list(values)


def _unique_text_list(values: Any) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in _as_list(values):
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(value)
    return result


def _first_text(items: Any, key: str) -> str:
    if not isinstance(items, list):
        return ""
    for item in items:
        if isinstance(item, dict) and str(item.get(key) or "").strip():
            return str(item[key]).strip()
    return ""


def _latest_location(items: Any) -> str:
    if not isinstance(items, list):
        return ""
    for item in items:
        if isinstance(item, dict) and str(item.get("location") or "").strip():
            return str(item["location"]).strip()
    return ""


def _normalize_profile(profile: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(profile or {})
    for key in ["skills", "certifications", "links", "summary_highlights", "awards", "publications", "languages"]:
        normalized[key] = _as_list(normalized.get(key))
    for key in ["experience", "education", "projects"]:
        normalized[key] = _as_dict_list(normalized.get(key))
    skill_groups = normalized.get("skill_groups")
    normalized["skill_groups"] = {
        str(key): _as_list(value)
        for key, value in (skill_groups.items() if isinstance(skill_groups, dict) else [])
        if _as_list(value)
    }
    normalized["other_sections"] = normalized.get("other_sections") if isinstance(normalized.get("other_sections"), dict) else {}
    normalized["ai_enhancement"] = normalized.get("ai_enhancement") if isinstance(normalized.get("ai_enhancement"), dict) else {}
    for key in ["display_name", "headline", "summary", "current_location", "email", "phone", "linkedin_url", "portfolio_url", "github_url"]:
        normalized[key] = _clean_optional_text(normalized.get(key)) or ""
    return normalized


def _normalize_resume(resume: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(resume or {})
    normalized["contact"] = dict(normalized.get("contact") or {})
    normalized["skills"] = _as_list(normalized.get("skills"))
    normalized["summary_highlights"] = _as_list(normalized.get("summary_highlights"))
    skill_groups = normalized.get("skill_groups")
    normalized["skill_groups"] = {
        str(key): _as_list(value)
        for key, value in (skill_groups.items() if isinstance(skill_groups, dict) else [])
        if _as_list(value)
    }
    normalized["certifications"] = _as_list(normalized.get("certifications"))
    normalized["awards"] = _as_list(normalized.get("awards"))
    normalized["publications"] = _as_list(normalized.get("publications"))
    normalized["languages"] = _as_list(normalized.get("languages"))
    normalized["links"] = _as_list(normalized.get("links"))
    normalized["experience"] = _as_dict_list(normalized.get("experience"))
    normalized["education"] = _as_dict_list(normalized.get("education"))
    normalized["projects"] = _as_dict_list(normalized.get("projects"))
    normalized["other_sections"] = normalized.get("other_sections") if isinstance(normalized.get("other_sections"), dict) else {}
    normalized["ai_enhancement"] = normalized.get("ai_enhancement") if isinstance(normalized.get("ai_enhancement"), dict) else {}
    return normalized


def _as_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if item is not None and str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in re.split(r"[\n,;]+", value) if item.strip()]
    return [str(value).strip()] if str(value).strip() else []


def _as_dict_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    result: list[dict[str, Any]] = []
    for item in value:
        if isinstance(item, dict):
            result.append({str(key): item[key] for key in item})
        elif str(item).strip():
            result.append({"description": str(item).strip()})
    return result


def _clean_optional_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _section_items(title: str, items: list[dict[str, Any]], primary_key: str, secondary_key: str) -> list[str]:
    if not items:
        return []
    parts = [f"<h2>{_e(title)}</h2>"]
    for item in items:
        primary = item.get(primary_key) or item.get("company") or item.get("school") or item.get("name") or ""
        secondary = item.get(secondary_key) or item.get("title") or item.get("degree") or item.get("role") or ""
        dates = " - ".join(_as_list([item.get("start_date"), item.get("end_date")]))
        bullets = _as_list(item.get("bullets") or item.get("details") or item.get("description"))
        technologies = _as_list(item.get("technologies"))
        links = _as_list(item.get("links"))
        parts.append("<div class='item'>")
        parts.append(f"<h3>{_e(secondary)}{(' · ' + _e(primary)) if primary else ''}</h3>")
        location = _clean_optional_text(item.get("location"))
        if dates:
            parts.append(f"<div class='dates'>{_e(dates)}{(' · ' + _e(location)) if location else ''}</div>")
        elif location:
            parts.append(f"<div class='dates'>{_e(location)}</div>")
        if technologies:
            parts.append(f"<div class='tech'>{_e(', '.join(technologies))}</div>")
        if links:
            parts.append(f"<div class='links'>{_e(' | '.join(links))}</div>")
        if bullets:
            parts.append("<ul>")
            parts.append("".join(f"<li>{_e(bullet)}</li>" for bullet in bullets))
            parts.append("</ul>")
        for workstream in item.get("workstreams") or []:
            if not isinstance(workstream, dict):
                continue
            stream_title = workstream.get("name") or workstream.get("role") or "Workstream"
            stream_bullets = _as_list(workstream.get("bullets") or workstream.get("description"))
            stream_tech = _as_list(workstream.get("technologies"))
            parts.append("<div class='workstream'>")
            parts.append(f"<strong>{_e(stream_title)}</strong>")
            if stream_tech:
                parts.append(f"<div class='tech'>{_e(', '.join(stream_tech))}</div>")
            if stream_bullets:
                parts.append("<ul>")
                parts.append("".join(f"<li>{_e(bullet)}</li>" for bullet in stream_bullets))
                parts.append("</ul>")
            parts.append("</div>")
        parts.append("</div>")
    return parts


def _contact_line(contact: dict[str, Any]) -> str:
    parts = [
        contact.get("location"),
        contact.get("email"),
        contact.get("phone"),
        contact.get("linkedin_url"),
        contact.get("portfolio_url"),
        contact.get("github_url"),
    ]
    return f"<div class='meta'>{_e(' | '.join(_as_list(parts)))}</div>"


def _resume_search_text(resume: dict[str, Any]) -> str:
    pieces = [
        resume.get("name"),
        resume.get("headline"),
        resume.get("summary"),
        " ".join(_as_list(resume.get("summary_highlights"))),
        " ".join(_flatten_mapping(resume.get("contact"))),
        " ".join(_as_list(resume.get("skills"))),
        " ".join(_flatten_mapping(resume.get("skill_groups"))),
        " ".join(_as_list(resume.get("certifications"))),
        " ".join(_as_list(resume.get("awards"))),
        " ".join(_as_list(resume.get("publications"))),
        " ".join(_as_list(resume.get("languages"))),
        " ".join(_flatten_dicts(resume.get("experience"))),
        " ".join(_flatten_dicts(resume.get("education"))),
        " ".join(_flatten_dicts(resume.get("projects"))),
        " ".join(_flatten_mapping(resume.get("other_sections"))),
    ]
    return " ".join(str(piece) for piece in pieces if piece)


def _flatten_dicts(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    pieces: list[str] = []
    for item in value:
        if isinstance(item, dict):
            for child in item.values():
                if isinstance(child, list):
                    pieces.extend(str(child_item) for child_item in child if str(child_item).strip())
                elif child is not None and str(child).strip():
                    pieces.append(str(child))
        elif str(item).strip():
            pieces.append(str(item))
    return pieces


def _flatten_mapping(value: Any) -> list[str]:
    if not isinstance(value, dict):
        return []
    return [str(item) for item in value.values() if item is not None and str(item).strip()]


def _important_terms(text: str) -> set[str]:
    terms = set()
    for raw in re.findall(r"[A-Za-z][A-Za-z0-9+#.\-]{1,}", text.lower()):
        term = raw.strip(".-")
        if len(term) < 3 or term in STOPWORDS:
            continue
        terms.add(term)
    return terms


def _iso(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value) if value else None


def _e(value: Any) -> str:
    return html.escape(str(value or ""), quote=True)


def _section_title(value: Any) -> str:
    text = str(value or "").replace("_", " ").replace("-", " ").strip()
    return " ".join(part.capitalize() for part in text.split()) or "Additional"
