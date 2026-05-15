from __future__ import annotations

import re
from typing import Any

from pydantic import ValidationError

from .schema import ResumeRecord

EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
PHONE_RE = re.compile(r"(?:\+?\d[\d .()/-]{7,}\d)")
URL_RE = re.compile(r"https?://\S+|(?:linkedin|github)\.com/\S+", re.I)


def validate_resume(raw: dict[str, Any], source_text: str) -> tuple[ResumeRecord, dict[str, Any]]:
    warnings: list[str] = []

    try:
        record = ResumeRecord.model_validate(raw)
    except ValidationError as exc:
        repaired = _minimal_repair(raw)
        record = ResumeRecord.model_validate(repaired)
        warnings.append(f"schema_repaired: {exc.errors()[0]['msg']}")

    source_emails = set(EMAIL_RE.findall(source_text))
    if source_emails and record.contact.email not in source_emails:
        warnings.append("email_missing_or_not_grounded")

    source_phones = set(match.group(0).strip() for match in PHONE_RE.finditer(source_text))
    if source_phones and not record.contact.phone:
        warnings.append("phone_missing")

    source_urls = set(match.group(0).rstrip(".,)") for match in URL_RE.finditer(source_text))
    if source_urls and not set(record.contact.links).intersection(source_urls):
        warnings.append("links_may_be_missing")

    if not record.experience:
        warnings.append("experience_missing")
    if not record.education:
        warnings.append("education_missing")
    if not record.skills:
        warnings.append("skills_missing")

    report = {
        "ok": not warnings,
        "warnings": warnings,
        "field_counts": {
            "skills": len(record.skills),
            "experience": len(record.experience),
            "education": len(record.education),
            "projects": len(record.projects),
            "certifications": len(record.certifications),
        },
    }
    return record, report


def _minimal_repair(raw: dict[str, Any]) -> dict[str, Any]:
    repaired = dict(raw)
    repaired.setdefault("document_id", "")
    repaired.setdefault("source_file", "")
    repaired.setdefault("contact", {})
    for key in [
        "skills",
        "experience",
        "education",
        "projects",
        "certifications",
        "awards",
        "publications",
        "languages",
        "notes",
    ]:
        if repaired.get(key) is None:
            repaired[key] = []
        elif not isinstance(repaired.get(key), list):
            repaired[key] = [repaired[key]]
    repaired["experience"] = _coerce_list_of_dicts(repaired.get("experience", []))
    for item in repaired["experience"]:
        if isinstance(item, dict):
            item["workstreams"] = _coerce_list_of_dicts(item.get("workstreams", []))
    repaired["education"] = [
        *_coerce_list_of_dicts(repaired.get("education", [])),
        *_extract_education_from_malformed_experience(raw.get("experience", [])),
    ]
    repaired["projects"] = _coerce_list_of_dicts(repaired.get("projects", []))
    repaired.setdefault("other_sections", {})
    repaired.setdefault("derived", {})
    return repaired


def _coerce_list_of_dicts(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        value = [value]

    items: list[dict[str, Any]] = []
    for item in value:
        if isinstance(item, dict):
            items.append(item)
        elif isinstance(item, list):
            items.extend(child for child in item if isinstance(child, dict))
    return items


def _extract_education_from_malformed_experience(value: Any) -> list[dict[str, Any]]:
    extracted: list[dict[str, Any]] = []
    for item in _coerce_list_of_dicts(value):
        if "school" in item or "degree" in item:
            extracted.append(item)
    return extracted
