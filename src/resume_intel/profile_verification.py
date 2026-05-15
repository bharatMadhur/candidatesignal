from __future__ import annotations

import re
from typing import Any


LINKEDIN_PROFILE_RE = re.compile(r"^https://(?:[a-z]{2,3}\.)?linkedin\.com/in/[^/?#]+/?", re.I)


def enrich_profile_verification(record: dict[str, Any]) -> dict[str, Any]:
    """Add deterministic profile/link verification signals without external calls."""

    pii = (record.get("derived") or {}).get("pii_contact_intelligence") or {}
    linkedins = [str(item).strip() for item in pii.get("linkedin_urls") or [] if str(item).strip()]
    portfolios = [str(item).strip() for item in pii.get("portfolio_websites") or [] if str(item).strip()]
    githubs = [str(item).strip() for item in pii.get("github_urls") or [] if str(item).strip()]

    linkedin_status = _linkedin_status(linkedins)
    portfolio_status = "present" if portfolios else "missing"
    github_status = "present" if githubs else "missing"
    derived = record.setdefault("derived", {})
    derived["profile_verification"] = {
        "verification_source": "deterministic_link_shape",
        "external_verification_status": "not_configured",
        "linkedin": {
            "status": linkedin_status,
            "url": linkedins[0] if linkedins else None,
            "reason": _linkedin_reason(linkedin_status),
        },
        "portfolio": {
            "status": portfolio_status,
            "urls": portfolios,
            "reason": "portfolio or personal website URL found" if portfolios else "no portfolio URL found",
        },
        "github": {
            "status": github_status,
            "urls": githubs,
            "reason": "GitHub URL found" if githubs else "no GitHub URL found",
        },
        "application_validity_signals": [
            signal
            for signal in [
                "linkedin_profile_url_present" if linkedin_status == "valid_profile_url" else None,
                "portfolio_url_present" if portfolios else None,
                "github_url_present" if githubs else None,
            ]
            if signal
        ],
    }
    return record


def _linkedin_status(urls: list[str]) -> str:
    if not urls:
        return "missing"
    if any(LINKEDIN_PROFILE_RE.match(url) for url in urls):
        return "valid_profile_url"
    return "linkedin_url_not_profile"


def _linkedin_reason(status: str) -> str:
    if status == "valid_profile_url":
        return "LinkedIn personal profile URL shape found"
    if status == "linkedin_url_not_profile":
        return "LinkedIn URL exists but does not look like a personal /in/ profile"
    return "no LinkedIn URL found"
