from __future__ import annotations

import re
from typing import Any


EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
PHONE_RE = re.compile(r"(?:\+?\d[\d .()/-]{7,}\d)")
URL_RE = re.compile(
    r"(?:https?://|www\.)[^\s<>()]+|(?:linkedin|github)\.com/[^\s<>()]+|"
    r"(?<!@)\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+"
    r"(?:com|ai|io|dev|co|net|org|me|app|xyz|in|us|edu)(?:/[^\s<>()]*)?",
    re.I,
)


def enrich_record_pii(record: dict[str, Any], raw_text: str | None = None) -> dict[str, Any]:
    """Deterministically extract contact/PII signals from parsed fields plus raw CV text."""
    text = "\n".join([raw_text or "", _structured_contact_text(record)])
    emails = _dedupe(_clean_email(match.group(0)) for match in EMAIL_RE.finditer(text))
    phones = _dedupe(_clean_phone(match.group(0)) for match in PHONE_RE.finditer(text))
    links = _dedupe(_normalize_url(match.group(0)) for match in URL_RE.finditer(text))
    links = [link for link in links if link]

    linkedins = [link for link in links if "linkedin.com/" in link.lower()]
    githubs = [link for link in links if "github.com/" in link.lower()]
    portfolio_websites = [
        link
        for link in links
        if link not in linkedins
        and link not in githubs
        and not any(domain in link.lower() for domain in ("mailto:", "linkedin.com/", "github.com/"))
    ]

    contact = record.setdefault("contact", {})
    if emails and not contact.get("email"):
        contact["email"] = emails[0]
    if phones and not contact.get("phone"):
        contact["phone"] = phones[0]
    existing_links = contact.get("links") or []
    contact["links"] = _dedupe([*_coerce_strings(existing_links), *links])

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
        "github_urls": githubs,
        "portfolio_websites": portfolio_websites,
        "all_urls": links,
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
    return text
