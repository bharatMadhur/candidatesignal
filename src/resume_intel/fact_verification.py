from __future__ import annotations

import re
from typing import Any


STOPWORDS = {"and", "or", "the", "a", "an", "of", "for", "to", "at", "in", "on", "with"}


def enrich_fact_verification(record: dict[str, Any], raw_text: str | None = None) -> dict[str, Any]:
    """Attach deterministic evidence checks for parsed identity and experience facts.

    This does not rewrite facts. It marks unsupported role/company/date fields so
    the UI and downstream matching can treat them as review-needed rather than
    blindly canonical.
    """

    text = raw_text or ""
    normalized_text = _normalize_text(text)
    lines = _clean_lines(text)
    role_checks: list[dict[str, Any]] = []
    for index, item in enumerate(record.get("experience") or []):
        if not isinstance(item, dict):
            continue
        check = _verify_experience_item(item, index, normalized_text, lines)
        role_checks.append(check)

    current_role = role_checks[0] if role_checks else None
    review_roles = [item for item in role_checks if item["status"] != "verified"]
    derived = record.setdefault("derived", {})
    derived["fact_verification"] = {
        "status": "needs_review" if review_roles else "verified" if role_checks else "no_experience",
        "current_role_status": current_role["status"] if current_role else "missing",
        "current_role_flags": current_role["flags"] if current_role else ["missing_current_role"],
        "role_checks": role_checks,
        "summary": {
            "verified_roles": sum(1 for item in role_checks if item["status"] == "verified"),
            "review_roles": len(review_roles),
            "total_roles": len(role_checks),
        },
        "policy": "Parsed role/company/date facts are checked against raw CV text. Unsupported fields are flagged for recruiter review.",
    }
    data_quality = derived.setdefault("data_quality", {})
    data_quality["fact_review_role_count"] = len(review_roles)
    data_quality["fact_verification_status"] = derived["fact_verification"]["status"]
    return record


def _verify_experience_item(item: dict[str, Any], index: int, normalized_text: str, lines: list[str]) -> dict[str, Any]:
    company = _clean(item.get("company"))
    title = _clean(item.get("title"))
    start_date = _clean(item.get("start_date"))
    end_date = _clean(item.get("end_date"))
    company_hit = _phrase_supported(company, normalized_text)
    title_hit = _phrase_supported(title, normalized_text)
    start_hit = _date_supported(start_date, normalized_text)
    end_hit = _date_supported(end_date, normalized_text)
    flags: list[str] = []
    if company and not company_hit:
        flags.append("company_not_found_in_raw_text")
    if title and not title_hit:
        flags.append("title_not_found_in_raw_text")
    if start_date and not start_hit:
        flags.append("start_date_not_found_in_raw_text")
    if end_date and not end_hit:
        flags.append("end_date_not_found_in_raw_text")
    if not company:
        flags.append("missing_company")
    if not title:
        flags.append("missing_title")
    status = "verified" if not flags else "needs_review"
    return {
        "index": index,
        "company": company,
        "title": title,
        "start_date": start_date,
        "end_date": end_date,
        "status": status,
        "flags": flags,
        "checks": {
            "company_supported": company_hit,
            "title_supported": title_hit,
            "start_date_supported": start_hit,
            "end_date_supported": end_hit,
        },
        "evidence_lines": _evidence_lines(lines, [company, title], limit=4),
    }


def _phrase_supported(value: str | None, normalized_text: str) -> bool:
    if not value:
        return False
    phrase = _normalize_text(value)
    if not phrase:
        return False
    if phrase in normalized_text:
        return True
    tokens = _meaningful_tokens(phrase)
    if not tokens:
        return False
    matched = sum(1 for token in tokens if re.search(rf"\b{re.escape(token)}\b", normalized_text))
    threshold = 1 if len(tokens) == 1 else max(2, int(len(tokens) * 0.75 + 0.5))
    return matched >= threshold


def _date_supported(value: str | None, normalized_text: str) -> bool:
    if not value:
        return False
    lower = value.lower()
    if lower in {"present", "current", "now"}:
        return any(term in normalized_text for term in ("present", "current", "now"))
    years = re.findall(r"(?:19|20)\d{2}", value)
    return not years or any(year in normalized_text for year in years)


def _evidence_lines(lines: list[str], values: list[str | None], *, limit: int) -> list[str]:
    tokens = {token for value in values for token in _meaningful_tokens(_normalize_text(value or ""))}
    if not tokens:
        return []
    matched: list[str] = []
    for index, line in enumerate(lines):
        normalized_line = _normalize_text(line)
        if not any(re.search(rf"\b{re.escape(token)}\b", normalized_line) for token in tokens):
            continue
        start = max(0, index - 1)
        end = min(len(lines), index + 2)
        for candidate in lines[start:end]:
            if candidate not in matched:
                matched.append(candidate)
            if len(matched) >= limit:
                return matched
    return matched


def _meaningful_tokens(value: str) -> list[str]:
    return [token for token in re.findall(r"[a-z0-9]+", value.lower()) if token not in STOPWORDS and len(token) > 1]


def _normalize_text(value: str | None) -> str:
    text = re.sub(r"[^a-z0-9]+", " ", str(value or "").lower())
    return re.sub(r"\s+", " ", text).strip()


def _clean_lines(text: str) -> list[str]:
    return [line.strip() for line in str(text or "").splitlines() if line.strip()]


def _clean(value: Any) -> str | None:
    text = str(value or "").strip()
    return text or None
