from __future__ import annotations

from typing import Any


def factual_current_title(record: dict[str, Any]) -> str | None:
    """Return the best factual current title without letting AI fit summaries override it."""

    hr_profile = (record.get("derived") or {}).get("hr_profile") or {}
    if _current_role_needs_review(record):
        suggested = _current_role_suggested_title(record)
        if suggested:
            return suggested
        verified = _first_verified_role_check(record)
        if verified:
            title = _clean_text(verified.get("title"))
            if title:
                return title
    title = _clean_text(hr_profile.get("current_title"))
    if title:
        return title

    for item in record.get("experience") or []:
        if not isinstance(item, dict):
            continue
        title = _clean_text(item.get("title"))
        if title:
            return title

    final_profile = (record.get("candidate_intelligence") or {}).get("final_candidate_profile") or {}
    summary_card = final_profile.get("summary_card") or {}
    return _clean_text(summary_card.get("current_or_target_title"))


def factual_current_company(record: dict[str, Any]) -> str | None:
    hr_profile = (record.get("derived") or {}).get("hr_profile") or {}
    if _current_role_needs_review(record):
        verified = _first_verified_role_check(record)
        if verified:
            company = _clean_text(verified.get("company"))
            if company:
                return company
    company = _clean_text(hr_profile.get("current_company"))
    if company:
        return company
    for item in record.get("experience") or []:
        if not isinstance(item, dict):
            continue
        company = _clean_text(item.get("company"))
        if company:
            return company
    return None


def _clean_text(value: Any) -> str | None:
    text = str(value or "").strip()
    return text or None


def _current_role_needs_review(record: dict[str, Any]) -> bool:
    verification = ((record.get("derived") or {}).get("fact_verification") or {})
    return verification.get("current_role_status") == "needs_review"


def _first_verified_role_check(record: dict[str, Any]) -> dict[str, Any] | None:
    verification = ((record.get("derived") or {}).get("fact_verification") or {})
    for item in verification.get("role_checks") or []:
        if isinstance(item, dict) and item.get("status") == "verified":
            return item
    return None


def _current_role_suggested_title(record: dict[str, Any]) -> str | None:
    verification = ((record.get("derived") or {}).get("fact_verification") or {})
    role_checks = verification.get("role_checks") or []
    if not role_checks or not isinstance(role_checks[0], dict):
        return None
    return _clean_text(role_checks[0].get("suggested_title"))
