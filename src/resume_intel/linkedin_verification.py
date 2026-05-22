from __future__ import annotations

import re
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Any

import httpx
from psycopg.types.json import Jsonb

from .candidate_facts import factual_current_company, factual_current_title
from .db import db
from .db_store import load_candidate_db, load_raw_text_db
from .pii import _canonical_linkedin_profile_url
from .settings import Settings, load_settings
from .vector_search import upsert_candidate_search_chunks


PROVIDER = "apify_harvestapi"
LINKEDIN_SOURCE_LABEL = "linkedin_profile_verification"


def canonical_linkedin_url(value: str | None) -> str | None:
    if not value:
        return None
    return _canonical_linkedin_profile_url(value)


def enqueue_linkedin_verification(
    document_id: str,
    tenant_id: str,
    user_id: str,
    linkedin_url: str | None = None,
) -> dict[str, Any]:
    record = load_candidate_db(document_id, tenant_id)
    canonical_url = canonical_linkedin_url(linkedin_url) or _first_candidate_linkedin(record)
    if not canonical_url:
        raise ValueError("candidate has no LinkedIn profile URL; paste a LinkedIn /in/ URL first")
    settings = load_settings()
    with db() as conn:
        row = conn.execute(
            """
            insert into linkedin_verification_runs (
              tenant_id, document_id, requested_by_user_id, linkedin_url, canonical_url,
              status, stage, provider, actor_id
            )
            values (%s, %s, %s, %s, %s, 'queued', 'queued', %s, %s)
            returning *
            """,
            (tenant_id, document_id, user_id, linkedin_url or canonical_url, canonical_url, PROVIDER, settings.linkedin_actor_id),
        ).fetchone()
        conn.execute(
            """
            insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
            values (%s, %s, 'candidate.linkedin_verification_queued', 'candidate', %s, %s)
            """,
            (tenant_id, user_id, document_id, Jsonb({"run_id": str(row["id"]), "linkedin_url": canonical_url})),
        )
        conn.commit()
    return _run_row(row)


def latest_linkedin_verification(document_id: str, tenant_id: str) -> dict[str, Any] | None:
    with db() as conn:
        row = conn.execute(
            """
            select *
            from linkedin_verification_runs
            where tenant_id=%s and document_id=%s
            order by created_at desc
            limit 1
            """,
            (tenant_id, document_id),
        ).fetchone()
    return _run_row(row) if row else None


def run_linkedin_verification(run_id: str, tenant_id: str) -> dict[str, Any]:
    with db() as conn:
        run = conn.execute(
            """
            update linkedin_verification_runs
            set status='running', stage='fetching_linkedin', started_at=coalesce(started_at, now()), updated_at=now()
            where id=%s and tenant_id=%s and status in ('queued', 'retrying', 'running')
            returning *
            """,
            (run_id, tenant_id),
        ).fetchone()
        conn.commit()
    if not run:
        raise FileNotFoundError(run_id)
    try:
        settings = load_settings()
        if not settings.apify_api_token:
            raise RuntimeError("APIFY_API_TOKEN is not configured")
        raw_profile = fetch_linkedin_profile(str(run["canonical_url"]), settings)
        snapshot = normalize_linkedin_profile(raw_profile, str(run["canonical_url"]))
        candidate_record = load_candidate_db(str(run["document_id"]), tenant_id)
        comparison = compare_candidate_to_linkedin(candidate_record, snapshot)
        diff = build_linkedin_profile_diff(candidate_record, snapshot)
        external_profile_id = _upsert_external_profile(raw_profile, snapshot)
        _link_candidate_profile(
            tenant_id=tenant_id,
            document_id=str(run["document_id"]),
            external_profile_id=external_profile_id,
            requested_by_user_id=str(run["requested_by_user_id"]) if run.get("requested_by_user_id") else None,
            run_id=str(run["id"]),
            comparison=comparison,
        )
        updated_record = _attach_linkedin_result_to_candidate(candidate_record, snapshot, comparison, diff, str(run["id"]))
        raw_text = load_raw_text_db(str(run["document_id"]), tenant_id)
        with db() as conn:
            conn.execute(
                """
                update candidates
                set record_json=%s, updated_at=now()
                where tenant_id=%s and document_id=%s and deleted_at is null
                """,
                (Jsonb(updated_record), tenant_id, str(run["document_id"])),
            )
            row = conn.execute(
                """
                update linkedin_verification_runs
                set status='succeeded',
                    stage='completed',
                    result_status=%s,
                    match_confidence=%s,
                    comparison_json=%s,
                    profile_diff_json=%s,
                    credits_used=1,
                    completed_at=now(),
                    updated_at=now()
                where id=%s and tenant_id=%s
                returning *
                """,
                (
                    comparison["status"],
                    comparison["match_confidence"],
                    Jsonb(comparison),
                    Jsonb(diff),
                    run_id,
                    tenant_id,
                ),
            ).fetchone()
            conn.execute(
                """
                insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
                values (%s, %s, 'candidate.linkedin_verification_completed', 'candidate', %s, %s)
                """,
                (
                    tenant_id,
                    str(run["requested_by_user_id"]) if run.get("requested_by_user_id") else None,
                    str(run["document_id"]),
                    Jsonb({"run_id": run_id, "status": comparison["status"], "match_confidence": comparison["match_confidence"]}),
                ),
            )
            conn.commit()
        upsert_candidate_search_chunks(updated_record, raw_text, tenant_id)
        return _run_row(row)
    except Exception as exc:
        with db() as conn:
            row = conn.execute(
                """
                update linkedin_verification_runs
                set status='failed', stage='failed', error_message=%s, completed_at=now(), updated_at=now()
                where id=%s and tenant_id=%s
                returning *
                """,
                (str(exc), run_id, tenant_id),
            ).fetchone()
            conn.commit()
        return _run_row(row)


def fetch_linkedin_profile(linkedin_url: str, settings: Settings) -> dict[str, Any]:
    url = f"https://api.apify.com/v2/acts/{settings.linkedin_actor_id}/run-sync-get-dataset-items"
    payload = {
        "profileScraperMode": settings.linkedin_actor_mode,
        "queries": [linkedin_url],
        "urls": [],
        "publicIdentifiers": [],
        "profileIds": [],
    }
    with httpx.Client(timeout=settings.linkedin_timeout_seconds) as client:
        response = client.post(url, params={"token": settings.apify_api_token, "clean": "true"}, json=payload)
    if response.status_code >= 400:
        raise RuntimeError(f"LinkedIn provider failed with HTTP {response.status_code}")
    data = response.json()
    if isinstance(data, list) and data:
        return data[0]
    if isinstance(data, dict) and data:
        items = data.get("items")
        if isinstance(items, list) and items:
            return items[0]
        return data
    raise RuntimeError("LinkedIn provider returned an empty profile dataset")


def normalize_linkedin_profile(raw: dict[str, Any], fallback_url: str) -> dict[str, Any]:
    first_name = _clean(raw.get("firstName"))
    last_name = _clean(raw.get("lastName"))
    full_name = _clean(" ".join(item for item in [first_name, last_name] if item)) or _clean(raw.get("fullName"))
    location = raw.get("location") if isinstance(raw.get("location"), dict) else {}
    parsed_location = location.get("parsed") if isinstance(location.get("parsed"), dict) else {}
    experience = [_normalize_linkedin_experience(item) for item in raw.get("experience") or [] if isinstance(item, dict)]
    education = [_normalize_linkedin_education(item) for item in raw.get("education") or [] if isinstance(item, dict)]
    certifications = [_clean(item.get("title")) for item in raw.get("certifications") or [] if isinstance(item, dict) and _clean(item.get("title"))]
    return {
        "provider": PROVIDER,
        "provider_profile_id": _clean(raw.get("id") or raw.get("objectUrn")),
        "public_identifier": _clean(raw.get("publicIdentifier")),
        "linkedin_url": canonical_linkedin_url(raw.get("linkedinUrl")) or fallback_url,
        "full_name": full_name,
        "headline": _clean(raw.get("headline")),
        "about": _clean(raw.get("about")),
        "location": _clean(parsed_location.get("text") or location.get("linkedinText")),
        "country": _clean(parsed_location.get("countryFull") or parsed_location.get("country")),
        "city": _clean(parsed_location.get("city")),
        "state": _clean(parsed_location.get("state")),
        "current_role": experience[0] if experience else {},
        "experience": experience,
        "education": education,
        "certifications": certifications,
        "open_to_work": bool(raw.get("openToWork")),
        "follower_count": raw.get("followerCount"),
        "connections_count": raw.get("connectionsCount"),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


def compare_candidate_to_linkedin(candidate_record: dict[str, Any], linkedin_snapshot: dict[str, Any]) -> dict[str, Any]:
    candidate_linkedin_urls = set(_candidate_linkedin_urls(candidate_record))
    linkedin_url = linkedin_snapshot.get("linkedin_url")
    url_match = bool(linkedin_url and linkedin_url in candidate_linkedin_urls)
    name_score = _similarity(candidate_record.get("name"), linkedin_snapshot.get("full_name"))
    candidate_companies = _candidate_companies(candidate_record)
    linkedin_companies = [_clean(item.get("company")) for item in linkedin_snapshot.get("experience") or [] if _clean(item.get("company"))]
    company_overlap = _overlap(candidate_companies, linkedin_companies)
    title_score = _similarity(factual_current_title(candidate_record), (linkedin_snapshot.get("current_role") or {}).get("title"))
    school_overlap = _overlap(_candidate_schools(candidate_record), [_clean(item.get("school")) for item in linkedin_snapshot.get("education") or []])
    location_score = _location_score(candidate_record, linkedin_snapshot)
    score = (
        (0.22 if url_match else 0)
        + 0.24 * name_score
        + 0.22 * company_overlap["score"]
        + 0.14 * title_score
        + 0.1 * school_overlap["score"]
        + 0.08 * location_score
    )
    if url_match and name_score >= 0.55:
        score = max(score, 0.76)
    confidence = round(max(0.0, min(score, 1.0)), 3)
    status = "verified" if confidence >= 0.72 else "needs_review" if confidence >= 0.45 else "mismatch"
    reasons = []
    if url_match:
        reasons.append("LinkedIn URL exactly matches the resume/profile URL.")
    if name_score >= 0.78:
        reasons.append("Name strongly matches.")
    if company_overlap["matches"]:
        reasons.append(f"Company overlap: {', '.join(company_overlap['matches'][:4])}.")
    if school_overlap["matches"]:
        reasons.append(f"Education overlap: {', '.join(school_overlap['matches'][:3])}.")
    if location_score >= 0.75:
        reasons.append("Location signal is consistent.")
    gaps = []
    if name_score < 0.55:
        gaps.append("Name similarity is weak; recruiter should verify this is the same person.")
    if not company_overlap["matches"]:
        gaps.append("No company overlap found between resume and LinkedIn.")
    if not url_match and candidate_linkedin_urls:
        gaps.append("Candidate profile has a different LinkedIn URL than the verified URL.")
    return {
        "status": status,
        "match_confidence": confidence,
        "url_match": url_match,
        "name_score": round(name_score, 3),
        "company_overlap": company_overlap,
        "title_score": round(title_score, 3),
        "education_overlap": school_overlap,
        "location_score": round(location_score, 3),
        "reasons": reasons,
        "gaps": gaps,
    }


def build_linkedin_profile_diff(candidate_record: dict[str, Any], linkedin_snapshot: dict[str, Any]) -> dict[str, Any]:
    current_role = linkedin_snapshot.get("current_role") or {}
    updates: list[dict[str, Any]] = []
    current_title = factual_current_title(candidate_record)
    current_company = factual_current_company(candidate_record)
    if current_role.get("title") and _similarity(current_title, current_role.get("title")) < 0.72:
        updates.append({"field": "current_title", "resume_value": current_title, "linkedin_value": current_role.get("title"), "action": "review"})
    if current_role.get("company") and _similarity(current_company, current_role.get("company")) < 0.72:
        updates.append({"field": "current_company", "resume_value": current_company, "linkedin_value": current_role.get("company"), "action": "review"})
    candidate_location = _clean((candidate_record.get("contact") or {}).get("location"))
    if linkedin_snapshot.get("location") and _similarity(candidate_location, linkedin_snapshot.get("location")) < 0.65:
        updates.append({"field": "location", "resume_value": candidate_location, "linkedin_value": linkedin_snapshot.get("location"), "action": "review"})
    candidate_company_keys = set(_normalized_key(company) for company in _candidate_companies(candidate_record))
    new_roles = [
        item
        for item in linkedin_snapshot.get("experience") or []
        if _normalized_key(item.get("company")) and _normalized_key(item.get("company")) not in candidate_company_keys
    ][:6]
    candidate_school_keys = set(_normalized_key(school) for school in _candidate_schools(candidate_record))
    new_education = [
        item
        for item in linkedin_snapshot.get("education") or []
        if _normalized_key(item.get("school")) and _normalized_key(item.get("school")) not in candidate_school_keys
    ][:4]
    return {
        "summary": _diff_summary(updates, new_roles, new_education, linkedin_snapshot.get("certifications") or []),
        "suggested_updates": updates,
        "new_experience": new_roles,
        "new_education": new_education,
        "certifications": linkedin_snapshot.get("certifications") or [],
        "profile_freshness": "recent_linkedin_snapshot",
    }


def _upsert_external_profile(raw_profile: dict[str, Any], snapshot: dict[str, Any]) -> str:
    with db() as conn:
        row = conn.execute(
            """
            insert into external_profiles (
              provider, provider_profile_id, public_identifier, canonical_url, full_name,
              headline, location_text, raw_profile_json, profile_snapshot, updated_at
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, now())
            on conflict (provider, canonical_url) do update set
              provider_profile_id=coalesce(excluded.provider_profile_id, external_profiles.provider_profile_id),
              public_identifier=coalesce(excluded.public_identifier, external_profiles.public_identifier),
              full_name=excluded.full_name,
              headline=excluded.headline,
              location_text=excluded.location_text,
              raw_profile_json=excluded.raw_profile_json,
              profile_snapshot=excluded.profile_snapshot,
              updated_at=now()
            returning id
            """,
            (
                PROVIDER,
                snapshot.get("provider_profile_id"),
                snapshot.get("public_identifier"),
                snapshot.get("linkedin_url"),
                snapshot.get("full_name"),
                snapshot.get("headline"),
                snapshot.get("location"),
                Jsonb(raw_profile),
                Jsonb(snapshot),
            ),
        ).fetchone()
        conn.commit()
    return str(row["id"])


def _link_candidate_profile(
    *,
    tenant_id: str,
    document_id: str,
    external_profile_id: str,
    requested_by_user_id: str | None,
    run_id: str,
    comparison: dict[str, Any],
) -> None:
    with db() as conn:
        conn.execute(
            """
            insert into candidate_external_profiles (
              tenant_id, document_id, external_profile_id, provider, source,
              status, verification_status, match_confidence, latest_run_id, linked_by_user_id, updated_at
            )
            values (%s, %s, %s, %s, 'manual_verify', 'linked', %s, %s, %s, %s, now())
            on conflict (tenant_id, document_id, external_profile_id) do update set
              verification_status=excluded.verification_status,
              match_confidence=excluded.match_confidence,
              latest_run_id=excluded.latest_run_id,
              updated_at=now()
            """,
            (
                tenant_id,
                document_id,
                external_profile_id,
                PROVIDER,
                comparison["status"],
                comparison["match_confidence"],
                run_id,
                requested_by_user_id,
            ),
        )
        conn.commit()


def _attach_linkedin_result_to_candidate(
    record: dict[str, Any],
    snapshot: dict[str, Any],
    comparison: dict[str, Any],
    diff: dict[str, Any],
    run_id: str,
) -> dict[str, Any]:
    derived = record.setdefault("derived", {})
    verification = derived.setdefault("profile_verification", {})
    verification["external_verification_status"] = comparison["status"]
    verification["linkedin"] = {
        **(verification.get("linkedin") or {}),
        "status": comparison["status"],
        "url": snapshot.get("linkedin_url"),
        "reason": "; ".join(comparison.get("reasons") or comparison.get("gaps") or ["LinkedIn verification completed"]),
        "match_confidence": comparison["match_confidence"],
        "last_checked_at": snapshot.get("fetched_at"),
    }
    verification["linkedin_external"] = {
        "run_id": run_id,
        "profile": snapshot,
        "comparison": comparison,
        "diff": diff,
    }
    contact = record.setdefault("contact", {})
    links = [str(item).strip() for item in contact.get("links") or [] if str(item).strip()]
    if snapshot.get("linkedin_url") and snapshot["linkedin_url"] not in links:
        contact["links"] = [snapshot["linkedin_url"], *links]
    return record


def _first_candidate_linkedin(record: dict[str, Any]) -> str | None:
    for url in _candidate_linkedin_urls(record):
        canonical = canonical_linkedin_url(url)
        if canonical:
            return canonical
    return None


def _candidate_linkedin_urls(record: dict[str, Any]) -> list[str]:
    pii = (record.get("derived") or {}).get("pii_contact_intelligence") or {}
    urls = [*(pii.get("linkedin_urls") or []), *(record.get("contact", {}).get("links") or [])]
    result = []
    for url in urls:
        canonical = canonical_linkedin_url(str(url))
        if canonical and canonical not in result:
            result.append(canonical)
    return result


def _normalize_linkedin_experience(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": _clean(item.get("position")),
        "company": _clean(item.get("companyName")),
        "location": _clean(item.get("location")),
        "employment_type": _clean(item.get("employmentType")),
        "start_date": _date_text(item.get("startDate")),
        "end_date": _date_text(item.get("endDate")),
        "description": _clean(item.get("description")),
        "company_linkedin_url": canonical_linkedin_url(item.get("companyLinkedinUrl")) or _clean(item.get("companyLinkedinUrl")),
    }


def _normalize_linkedin_education(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "school": _clean(item.get("schoolName")),
        "degree": _clean(item.get("degree")),
        "field": _clean(item.get("fieldOfStudy")),
        "start_date": _date_text(item.get("startDate")),
        "end_date": _date_text(item.get("endDate")),
        "description": _clean(item.get("description") or item.get("insights")),
        "school_linkedin_url": _clean(item.get("schoolLinkedinUrl")),
    }


def _date_text(value: Any) -> str | None:
    if isinstance(value, dict):
        return _clean(value.get("text"))
    return _clean(value)


def _candidate_companies(record: dict[str, Any]) -> list[str]:
    return [_clean(item.get("company")) for item in record.get("experience") or [] if isinstance(item, dict) and _clean(item.get("company"))]


def _candidate_schools(record: dict[str, Any]) -> list[str]:
    return [_clean(item.get("school")) for item in record.get("education") or [] if isinstance(item, dict) and _clean(item.get("school"))]


def _overlap(left: list[str], right: list[str]) -> dict[str, Any]:
    matches = []
    for left_item in left:
        left_key = _normalized_key(left_item)
        if not left_key:
            continue
        for right_item in right:
            right_key = _normalized_key(right_item)
            if not right_key:
                continue
            if left_key in right_key or right_key in left_key or SequenceMatcher(None, left_key, right_key).ratio() >= 0.82:
                matches.append(right_item)
    matches = _dedupe(matches)
    return {"score": 1.0 if matches else 0.0, "matches": matches}


def _location_score(record: dict[str, Any], snapshot: dict[str, Any]) -> float:
    left_values = [
        (record.get("contact") or {}).get("location"),
        ((record.get("derived") or {}).get("location_intelligence") or {}).get("current_job_location"),
    ]
    right_values = [snapshot.get("location"), snapshot.get("city"), snapshot.get("state"), snapshot.get("country")]
    left = " ".join(_clean(value) or "" for value in left_values)
    right = " ".join(_clean(value) or "" for value in right_values)
    if not left or not right:
        return 0.0
    return _similarity(left, right)


def _similarity(left: Any, right: Any) -> float:
    left_key = _normalized_key(left)
    right_key = _normalized_key(right)
    if not left_key or not right_key:
        return 0.0
    if left_key == right_key:
        return 1.0
    if left_key in right_key or right_key in left_key:
        return 0.9
    return SequenceMatcher(None, left_key, right_key).ratio()


def _normalized_key(value: Any) -> str:
    text = _clean(value)
    if not text:
        return ""
    text = re.sub(r"\b(inc|llc|ltd|limited|corp|corporation|company|pvt|private|university|college)\b", " ", text, flags=re.I)
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _clean(value: Any) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def _dedupe(values: list[str]) -> list[str]:
    result = []
    seen = set()
    for value in values:
        key = _normalized_key(value)
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(value)
    return result


def _diff_summary(updates: list[dict[str, Any]], new_roles: list[dict[str, Any]], new_education: list[dict[str, Any]], certifications: list[str]) -> list[str]:
    summary = []
    if updates:
        summary.append(f"{len(updates)} current-profile field(s) differ from the resume.")
    if new_roles:
        summary.append(f"{len(new_roles)} LinkedIn role(s) were not found in the parsed resume companies.")
    if new_education:
        summary.append(f"{len(new_education)} education item(s) appear only on LinkedIn.")
    if certifications:
        summary.append(f"{len(certifications)} LinkedIn certification(s) available for recruiter review.")
    return summary or ["LinkedIn did not add obvious new profile data beyond the current candidate record."]


def _run_row(row: dict[str, Any] | None) -> dict[str, Any]:
    if not row:
        return {}
    return {
        "id": str(row["id"]),
        "tenant_id": str(row["tenant_id"]),
        "document_id": row["document_id"],
        "linkedin_url": row.get("canonical_url") or row.get("linkedin_url"),
        "status": row["status"],
        "stage": row.get("stage"),
        "provider": row.get("provider"),
        "actor_id": row.get("actor_id"),
        "result_status": row.get("result_status"),
        "match_confidence": float(row["match_confidence"]) if row.get("match_confidence") is not None else None,
        "comparison": row.get("comparison_json") or {},
        "profile_diff": row.get("profile_diff_json") or {},
        "error_message": row.get("error_message"),
        "credits_used": int(row.get("credits_used") or 0),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "started_at": row["started_at"].isoformat() if row.get("started_at") else None,
        "completed_at": row["completed_at"].isoformat() if row.get("completed_at") else None,
    }
