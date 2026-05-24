from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlsplit, urlunsplit


EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
PHONE_RE = re.compile(r"(?:\+?\d[\d .()/-]{7,}\d)")
URL_RE = re.compile(
    r"(?:https?://|www\.)[^\s<>()]+|(?:linkedin|github)\.com/[^\s<>()]+|"
    r"(?<!@)\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+"
    r"(?:com|ai|io|dev|co|net|org|me|app|xyz|in|us|edu)(?:/[^\s<>()]*)?",
    re.I,
)
TECH_DOMAIN_FALSE_POSITIVES = {
    "ado.net",
    "asp.net",
    "vb.net",
    "dot.net",
    "entityframework.net",
}
PII_FIELD_KEYS = {
    "email",
    "emails",
    "phone",
    "phones",
    "linkedin",
    "linkedin_url",
    "linkedin_urls",
    "github",
    "github_url",
    "github_urls",
    "portfolio",
    "portfolio_url",
    "portfolio_websites",
    "all_urls",
    "links",
    "url",
    "urls",
}


def enrich_record_pii(record: dict[str, Any], raw_text: str | None = None) -> dict[str, Any]:
    """Deterministically extract contact/PII signals from parsed fields plus raw CV text."""
    text = "\n".join([raw_text or "", _structured_contact_text(record)])
    emails = _dedupe(_clean_email(match.group(0)) for match in EMAIL_RE.finditer(text))
    phones = _dedupe(_clean_phone(match.group(0)) for match in PHONE_RE.finditer(text))
    phones = [phone for phone in phones if _valid_phone(phone)]
    links = _dedupe(_normalize_url(match.group(0)) for match in URL_RE.finditer(text))
    links = [link for link in links if link]

    linkedins_all = [link for link in links if "linkedin.com/" in link.lower()]
    linkedins = _canonical_linkedin_profiles(linkedins_all)
    other_linkedins = [
        link
        for link in linkedins_all
        if not _canonical_linkedin_profile_url(link)
    ]
    githubs = [link for link in links if "github.com/" in link.lower()]
    portfolio_websites = [
        link
        for link in links
        if link not in linkedins
        and link not in other_linkedins
        and link not in githubs
        and not any(domain in link.lower() for domain in ("mailto:", "linkedin.com/", "github.com/"))
        and not _is_false_positive_portfolio_url(link)
    ]

    contact = record.setdefault("contact", {})
    if emails and not contact.get("email"):
        contact["email"] = emails[0]
    if phones and not contact.get("phone"):
        contact["phone"] = phones[0]
    existing_links = contact.get("links") or []
    normalized_existing = [_normalize_url(value) for value in _coerce_strings(existing_links)]
    existing_other_links = [
        link
        for link in normalized_existing
        if link
        and "linkedin.com/" not in link.lower()
        and "github.com/" not in link.lower()
        and not _is_false_positive_portfolio_url(link)
    ]
    contact["links"] = _dedupe([link for link in [*linkedins, *githubs, *portfolio_websites, *existing_other_links] if link])

    pii_items = []
    pii_items.extend({"type": "email", "value": item, "source": "raw_cv_or_contact"} for item in emails)
    pii_items.extend({"type": "phone", "value": item, "source": "raw_cv_or_contact"} for item in phones)
    pii_items.extend({"type": "linkedin", "value": item, "source": "raw_cv_or_contact"} for item in linkedins)
    pii_items.extend({"type": "github", "value": item, "source": "raw_cv_or_contact"} for item in githubs)
    pii_items.extend({"type": "portfolio", "value": item, "source": "raw_cv_or_contact"} for item in portfolio_websites)

    derived = record.setdefault("derived", {})
    derived["pii_contact_intelligence"] = {
        "emails": emails,
        "phones": phones,
        "linkedin_urls": linkedins,
        "other_linkedin_urls": other_linkedins,
        "github_urls": githubs,
        "portfolio_websites": portfolio_websites,
        "all_urls": _dedupe([*linkedins, *other_linkedins, *githubs, *portfolio_websites]),
        "pii_items": pii_items,
        "coverage": {
            "has_email": bool(emails or contact.get("email")),
            "has_phone": bool(phones or contact.get("phone")),
            "has_linkedin": bool(linkedins),
            "has_portfolio": bool(portfolio_websites),
            "has_any_url": bool(links),
        },
    }
    return record


def redact_contact_pii_text(text: str | None, *, names: list[str] | None = None) -> str:
    """Remove direct contact PII before text leaves the tenant boundary."""

    redacted = str(text or "")
    redacted = EMAIL_RE.sub("[redacted-email]", redacted)
    redacted = PHONE_RE.sub("[redacted-phone]", redacted)
    redacted = URL_RE.sub("[redacted-url]", redacted)
    for name in names or []:
        clean = str(name or "").strip()
        if len(clean) < 3:
            continue
        redacted = re.sub(re.escape(clean), "[redacted-name]", redacted, flags=re.I)
    return redacted


def redact_contact_pii_payload(value: Any) -> Any:
    """Recursively remove direct contact data from nested API payloads."""

    if isinstance(value, str):
        return redact_contact_pii_text(value)
    if isinstance(value, list):
        return [redact_contact_pii_payload(item) for item in value]
    if isinstance(value, dict):
        redacted: dict[str, Any] = {}
        for key, item in value.items():
            normalized = str(key).lower()
            if normalized in PII_FIELD_KEYS or normalized.endswith("_url") or normalized.endswith("_urls"):
                if normalized in {"email", "phone"}:
                    redacted[key] = "[redacted]" if item else item
                else:
                    redacted[key] = [] if isinstance(item, list) else None
            else:
                redacted[key] = redact_contact_pii_payload(item)
        return redacted
    return value


def _structured_contact_text(record: dict[str, Any]) -> str:
    contact = record.get("contact") or {}
    return "\n".join(
        str(item)
        for item in [
            contact.get("email"),
            contact.get("phone"),
            contact.get("location"),
            *(contact.get("links") or []),
        ]
        if item
    )


def _coerce_strings(values: list[Any]) -> list[str]:
    return [str(value).strip() for value in values if str(value).strip()]


def _dedupe(values: Any) -> list[str]:
    result = []
    seen = set()
    for value in values:
        if not value:
            continue
        key = str(value).lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(str(value))
    return result


def _clean_email(value: str) -> str:
    return value.strip().strip(".,;:()[]{}<>").lower()


def _clean_phone(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().strip(".,;:()[]{}<>")


def _normalize_url(value: str) -> str:
    text = value.strip().strip(".,;:()[]{}<>")
    if text.lower().startswith("mailto:"):
        return ""
    if text.lower().startswith("www."):
        text = "https://" + text
    if re.match(r"^(linkedin|github)\.com/", text, re.I):
        text = "https://" + text
    if not text.lower().startswith(("http://", "https://", "mailto:")) and re.match(
        r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+"
        r"(?:com|ai|io|dev|co|net|org|me|app|xyz|in|us|edu)(?:/[^\s<>()]*)?$",
        text,
        re.I,
    ):
        text = "https://" + text
    if "linkedin.com/in/" in text.lower():
        return _canonical_linkedin_profile_url(text) or text
    return text


def _valid_phone(value: str) -> bool:
    text = value.strip()
    if re.fullmatch(r"(?:19|20)\d{2}\s*[-/]\s*(?:19|20)\d{2}", text):
        return False
    digits = re.sub(r"\D", "", text)
    if len(digits) < 10:
        return False
    return True


def _canonical_linkedin_profiles(urls: list[str]) -> list[str]:
    profiles: list[str] = []
    for url in urls:
        canonical = _canonical_linkedin_profile_url(url)
        if canonical:
            profiles.append(canonical)
    profiles = _dedupe(profiles)
    result: list[str] = []
    for item in sorted(profiles, key=lambda value: len(value.rstrip("/").rsplit("/", 1)[-1]), reverse=True):
        slug = item.rstrip("/").rsplit("/", 1)[-1].lower()
        if any(existing.rstrip("/").rsplit("/", 1)[-1].lower().startswith(slug) for existing in result):
            continue
        result.append(item)
    return result


def _canonical_linkedin_profile_url(value: str) -> str | None:
    text = value.strip().strip(".,;:()[]{}<>")
    if text.lower().startswith("www."):
        text = "https://" + text
    if text.lower().startswith("linkedin.com/"):
        text = "https://" + text
    try:
        parsed = urlsplit(text)
    except ValueError:
        return None
    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    if not host.endswith("linkedin.com"):
        return None
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) < 2 or parts[0].lower() != "in":
        return None
    slug = re.sub(r"[^A-Za-z0-9_-]", "", parts[1]).strip("-_")
    if len(slug) < 3:
        return None
    return urlunsplit(("https", "www.linkedin.com", f"/in/{slug}", "", ""))


def _is_false_positive_portfolio_url(value: str) -> bool:
    try:
        parsed = urlsplit(value)
    except ValueError:
        return True
    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host in TECH_DOMAIN_FALSE_POSITIVES
