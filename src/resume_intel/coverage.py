from __future__ import annotations

from typing import Any


CoverageMeta = dict[str, str]


COVERAGE_SCHEMA: dict[str, CoverageMeta] = {
    "identity.name": {"label": "Candidate name", "category": "identity", "severity": "critical"},
    "contact.email": {"label": "Email", "category": "identity", "severity": "critical"},
    "contact.phone": {"label": "Phone", "category": "identity", "severity": "critical"},
    "contact.links": {"label": "LinkedIn / portfolio links", "category": "identity", "severity": "enrichment"},
    "contact.location": {"label": "Location", "category": "identity", "severity": "critical"},
    "profile.summary": {"label": "Professional summary", "category": "resume_extraction", "severity": "standard"},
    "profile.skills": {"label": "Skills", "category": "resume_extraction", "severity": "critical"},
    "experience.current_title": {"label": "Current title", "category": "experience_dates", "severity": "critical"},
    "experience.current_company": {"label": "Current company", "category": "experience_dates", "severity": "critical"},
    "experience.history": {"label": "Experience history", "category": "experience_dates", "severity": "critical"},
    "experience.dates": {"label": "Role dates", "category": "experience_dates", "severity": "critical"},
    "education.history": {"label": "Education", "category": "education_credentials", "severity": "enrichment"},
    "hr.total_experience": {"label": "Total years experience", "category": "hr_intelligence", "severity": "critical"},
    "hr.domain_experience": {"label": "Domain experience", "category": "hr_intelligence", "severity": "standard"},
    "hr.countries": {"label": "Countries associated", "category": "location_intelligence", "severity": "standard"},
    "hr.recruiter_highlights": {"label": "Recruiter highlights", "category": "hr_intelligence", "severity": "enrichment"},
    "human.notes": {"label": "Human notes", "category": "recruiter_context", "severity": "context"},
}

PRIMARY_KEYS = {key: meta["label"] for key, meta in COVERAGE_SCHEMA.items()}

CATEGORY_LABELS = {
    "identity": "Identity",
    "resume_extraction": "Resume Extraction",
    "experience_dates": "Experience & Dates",
    "education_credentials": "Education",
    "hr_intelligence": "HR Intelligence",
    "location_intelligence": "Location Intelligence",
    "recruiter_context": "Recruiter Context",
}


def primary_key_coverage(record: dict[str, Any]) -> dict[str, Any]:
    contact = _dict(record.get("contact"))
    derived = _dict(record.get("derived"))
    pii = _dict(derived.get("pii_contact_intelligence"))
    hr_profile = _dict(derived.get("hr_profile"))
    llm_hr = _dict(record.get("llm_hr_intelligence"))
    hr_screening = _dict(llm_hr.get("hr_screening_summary"))
    checks = {
        "identity.name": _present(record.get("name")),
        "contact.email": _present(contact.get("email")),
        "contact.phone": _present(contact.get("phone")),
        "contact.links": _present(contact.get("links")) or _present(pii.get("all_urls")),
        "contact.location": _present(contact.get("location")),
        "profile.summary": _present(record.get("summary")),
        "profile.skills": len(record.get("skills") or []) > 0,
        "experience.current_title": _present(hr_profile.get("current_title")),
        "experience.current_company": _present(hr_profile.get("current_company")),
        "experience.history": len(record.get("experience") or []) > 0,
        "experience.dates": _experience_dates_present(record),
        "education.history": len(record.get("education") or []) > 0,
        "hr.total_experience": _present(hr_profile.get("total_years_experience")),
        "hr.domain_experience": len(derived.get("experience_by_domain") or {}) > 0,
        "hr.countries": len(derived.get("countries_associated") or []) > 0,
        "hr.recruiter_highlights": len(derived.get("recruiter_highlights") or []) > 0
        or len(hr_screening.get("strongest_matches") or []) > 0,
        "human.notes": len(record.get("notes") or []) > 0,
    }
    present = sum(1 for value in checks.values() if value)
    total = len(checks)
    items = [
        {
            "key": key,
            "label": COVERAGE_SCHEMA[key]["label"],
            "category": COVERAGE_SCHEMA[key]["category"],
            "category_label": CATEGORY_LABELS[COVERAGE_SCHEMA[key]["category"]],
            "severity": COVERAGE_SCHEMA[key]["severity"],
            "status": "present" if value else "missing",
        }
        for key, value in checks.items()
    ]
    categories = _coverage_categories(items)
    critical_missing = [item["key"] for item in items if item["status"] == "missing" and item["severity"] == "critical"]
    score = round(present / total, 3)
    missing_items = [item for item in items if item["status"] == "missing"]
    return {
        "score": score,
        "present": present,
        "total": total,
        "items": items,
        "categories": categories,
        "review_threshold": 0.8,
        "minimum_usable_threshold": 0.65,
        "status": "good" if score >= 0.8 else "needs_review" if score >= 0.65 else "low_confidence",
        "low_coverage_reasons": _low_coverage_reasons(missing_items, score),
        "missing_keys": [key for key, value in checks.items() if not value],
        "critical_missing_keys": critical_missing,
        "critical_missing_count": len(critical_missing),
        "enrichment_missing_keys": [
            item["key"] for item in items if item["status"] == "missing" and item["severity"] in {"standard", "enrichment", "context"}
        ],
    }


def _experience_dates_present(record: dict[str, Any]) -> bool:
    experience = record.get("experience") or []
    return bool(experience) and all(item.get("start_date") and item.get("end_date") for item in experience)


def _present(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, dict)):
        return bool(value)
    return True


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _coverage_categories(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    categories: list[dict[str, Any]] = []
    for category, label in CATEGORY_LABELS.items():
        category_items = [item for item in items if item["category"] == category]
        if not category_items:
            continue
        present = sum(1 for item in category_items if item["status"] == "present")
        missing = [item for item in category_items if item["status"] == "missing"]
        critical_missing = [item for item in missing if item["severity"] == "critical"]
        categories.append(
            {
                "key": category,
                "label": label,
                "score": round(present / len(category_items), 3),
                "present": present,
                "total": len(category_items),
                "status": "critical_missing" if critical_missing else "needs_enrichment" if missing else "complete",
                "missing_keys": [item["key"] for item in missing],
                "critical_missing_keys": [item["key"] for item in critical_missing],
            }
        )
    return categories


def _low_coverage_reasons(missing_items: list[dict[str, Any]], score: float) -> list[dict[str, str]]:
    reasons: list[dict[str, str]] = []
    if score >= 0.8:
        return reasons
    if score < 0.65:
        reasons.append(
            {
                "severity": "critical",
                "label": "Below usable profile threshold",
                "detail": "Profile coverage is below 65%, so this upload may be the wrong document, a weak scan, or missing core resume sections.",
            }
        )
    for item in missing_items:
        severity = str(item.get("severity") or "standard")
        label = str(item.get("label") or item.get("key") or "Missing field")
        category = str(item.get("category_label") or item.get("category") or "Profile")
        if severity == "critical":
            detail = f"{label} is required for reliable search, matching, and recruiter screening."
        elif severity in {"standard", "enrichment"}:
            detail = f"{label} improves ranking, evidence, and recruiter confidence."
        else:
            detail = f"{label} can be added by the recruiter to improve context."
        reasons.append({"severity": severity, "label": label, "detail": f"{category}: {detail}"})
    return reasons[:8]
