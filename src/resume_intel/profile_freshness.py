from __future__ import annotations

from typing import Any


FRESHNESS_LABELS = {
    "fresh": "Fresh",
    "needs_verification": "Needs verification",
    "possibly_stale": "Possibly stale",
    "stale": "Stale",
    "unknown": "Unknown",
}

FRESHNESS_SCORES = {
    "fresh": 0.95,
    "needs_verification": 0.62,
    "possibly_stale": 0.45,
    "stale": 0.2,
    "unknown": 0.35,
}


def enrich_profile_freshness(record: dict[str, Any]) -> dict[str, Any]:
    """Attach recruiter-facing freshness signals.

    Freshness is intentionally conservative. Unknown data becomes a verification
    task, not a negative claim about the candidate.
    """

    derived = record.setdefault("derived", {})
    verification = derived.get("profile_verification") if isinstance(derived.get("profile_verification"), dict) else {}
    fact_verification = derived.get("fact_verification") if isinstance(derived.get("fact_verification"), dict) else {}
    location = derived.get("location_intelligence") if isinstance(derived.get("location_intelligence"), dict) else {}
    note_signals = derived.get("recruiter_note_signals") if isinstance(derived.get("recruiter_note_signals"), dict) else {}
    labels = _note_signal_labels(note_signals)

    flags: list[dict[str, Any]] = []
    verified_sources: list[str] = []
    missing_verifications: list[str] = []

    linkedin = verification.get("linkedin") if isinstance(verification.get("linkedin"), dict) else {}
    linkedin_status = str(linkedin.get("status") or "").lower()
    if linkedin_status in {"verified", "valid_profile_url"} or "linkedin_verified" in labels:
        verified_sources.append("LinkedIn" if linkedin_status == "verified" or "linkedin_verified" in labels else "LinkedIn URL")
    else:
        missing_verifications.append("LinkedIn")
        flags.append(_flag("linkedin_unverified", "LinkedIn is not verified", "medium"))

    if verification.get("portfolio", {}).get("status") == "present":
        verified_sources.append("Portfolio URL")
    if verification.get("github", {}).get("status") == "present":
        verified_sources.append("GitHub URL")

    if "profile_stale" in labels:
        flags.append(_flag("recruiter_marked_stale", "Recruiter notes mark this profile or resume as stale", "high"))
    if "resume_requested" in labels:
        flags.append(_flag("updated_resume_requested", "Recruiter requested an updated resume", "medium"))
    if "linkedin_needs_verification" in labels:
        flags.append(_flag("linkedin_needs_verification", "Recruiter notes say LinkedIn needs verification", "medium"))

    current_role_status = str(fact_verification.get("current_role_status") or "").lower()
    if current_role_status and current_role_status not in {"verified"}:
        flags.append(_flag("current_role_needs_review", "Current role facts need source review", "medium"))

    if not location.get("current_location"):
        flags.append(_flag("current_location_unknown", "Current location is not stated", "medium"))
    elif location.get("location_conflict"):
        flags.append(_flag("location_conflict", "Resume header and latest role locations differ", "low"))

    source_type = str(derived.get("source_type") or "").lower()
    if source_type == "linkedin_profile":
        verified_sources.append("LinkedIn import")

    status = _freshness_status(flags, verified_sources)
    derived["profile_freshness"] = {
        "status": status,
        "label": FRESHNESS_LABELS[status],
        "score": FRESHNESS_SCORES[status],
        "summary": _freshness_summary(status, flags, verified_sources),
        "verified_sources": _dedupe(verified_sources),
        "missing_verifications": _dedupe(missing_verifications),
        "flags": flags,
    }
    return record


def _freshness_status(flags: list[dict[str, Any]], verified_sources: list[str]) -> str:
    keys = {str(item.get("key")) for item in flags}
    severities = {str(item.get("severity")) for item in flags}
    if "recruiter_marked_stale" in keys:
        return "stale"
    if "updated_resume_requested" in keys:
        return "possibly_stale"
    if "high" in severities:
        return "stale"
    if "medium" in severities:
        return "needs_verification"
    if verified_sources:
        return "fresh"
    return "unknown"


def _freshness_summary(status: str, flags: list[dict[str, Any]], verified_sources: list[str]) -> str:
    if status == "fresh":
        return f"Profile has usable verification signals: {', '.join(_dedupe(verified_sources)[:3])}."
    if flags:
        return str(flags[0]["label"])
    return "No strong freshness signal is available yet."


def _note_signal_labels(note_signals: dict[str, Any]) -> set[str]:
    labels: set[str] = set()
    for item in note_signals.get("signals") or []:
        if isinstance(item, dict) and item.get("label"):
            labels.add(str(item["label"]).lower())
    return labels


def _flag(key: str, label: str, severity: str) -> dict[str, str]:
    return {"key": key, "label": label, "severity": severity}


def _dedupe(values: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = str(value or "").strip()
        key = text.lower()
        if not text or key in seen:
            continue
        seen.add(key)
        result.append(text)
    return result
