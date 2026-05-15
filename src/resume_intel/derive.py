from __future__ import annotations

import re
from collections import Counter, defaultdict
from datetime import date
from typing import Iterable

from .geo import build_location_intelligence
from .schema import Experience, ResumeRecord


DOMAIN_KEYWORDS = {
    "generative_ai": [
        "genai",
        "generative ai",
        "llm",
        "langchain",
        "langgraph",
        "azure openai",
        "anthropic",
        "claude",
        "rag",
        "semantic kernel",
        "text-to-sql",
    ],
    "conversational_ai": [
        "chatbot",
        "virtual assistant",
        "bot framework",
        "copilot studio",
        "dialogflow",
        "ccai",
        "intent",
        "conversation",
    ],
    "data_engineering": [
        "data engineer",
        "databricks",
        "snowflake",
        "data factory",
        "spark",
        "kafka",
        "etl",
        "cdc",
        "lakehouse",
        "warehouse",
    ],
    "cloud_architecture": [
        "azure",
        "aws",
        "gcp",
        "serverless",
        "microservices",
        "functions",
        "lambda",
        "event grid",
        "service bus",
    ],
    "analytics_bi": ["tableau", "power bi", "looker", "kpi", "reporting", "analytics"],
    "security_identity": ["okta", "oauth", "entra", "rbac", "security", "governance"],
    "microsoft_365": [
        "sharepoint",
        "teams",
        "outlook",
        "power platform",
        "power automate",
        "microsoft graph",
        "m365",
    ],
}

TOOL_KEYWORDS = {
    "Azure": ["azure", "azure openai", "azure ai search", "azure data factory", "azure devops"],
    "AWS": ["aws", "lambda", "bedrock"],
    "GCP": ["gcp", "vertex ai", "dialogflow", "ccai"],
    "Microsoft 365": ["sharepoint", "teams", "outlook", "power platform", "power automate", "microsoft graph"],
    "Python": ["python"],
    "C#/.NET": ["c#", ".net"],
    "JavaScript/Node": ["javascript", "node.js", "react"],
    "Databricks": ["databricks"],
    "Snowflake": ["snowflake"],
    "Tableau": ["tableau"],
    "Power BI": ["power bi"],
}

COUNTRY_SIGNALS = {
    "United States": [
        "columbus, oh",
        "ohio",
        "united states",
        "usa",
        "illinois state university",
        "jobsohio",
        "cerner",
    ],
    "India": ["manipal institute of technology", "tekno valves", "b.tech", "india"],
}

SENIORITY_TERMS = {
    "lead": 4,
    "principal": 4,
    "staff": 4,
    "senior": 3,
    "sr.": 3,
    "architect": 3,
    "engineer": 2,
    "analyst": 1,
    "associate": 1,
}


def add_derived_fields(record: ResumeRecord, source_text: str | None = None) -> ResumeRecord:
    full_text = "\n".join([_record_text(record), source_text or ""])
    roles = [_role_intelligence(item) for item in record.experience]
    total_months = _union_months(record.experience)
    domain_months = _domain_months(record.experience)
    tool_evidence = _tool_evidence(record, full_text)
    location_intelligence = build_location_intelligence(record.model_dump(mode="json"), source_text)

    record.derived.update(
        {
            "hr_profile": {
                "current_title": _first_non_empty(item.title for item in record.experience),
                "current_company": _first_non_empty(item.company for item in record.experience),
                "current_location": record.contact.location,
                "seniority_level": _seniority_level(record),
                "total_years_experience": round(total_months / 12, 1),
                "total_months_experience": total_months,
                "role_count": len(record.experience),
                "company_count": len({item.company for item in record.experience if item.company}),
                "education_highest_level": _highest_education(record),
                "has_certifications": bool(record.certifications),
            },
            "experience_by_domain": {
                domain: {
                    "months": months,
                    "years": round(months / 12, 1),
                    "evidence_terms": _matching_terms(full_text, DOMAIN_KEYWORDS[domain]),
                }
                for domain, months in sorted(domain_months.items())
            },
            "role_timeline": roles,
            "tools_and_platforms": tool_evidence,
            "countries_associated": location_intelligence["countries_associated"],
            "location_intelligence": location_intelligence,
            "recruiter_highlights": _recruiter_highlights(record, total_months, domain_months, tool_evidence),
            "search_facets": _search_facets(record, domain_months, tool_evidence, location_intelligence),
            "data_quality": {
                "missing_contact_links": not bool(record.contact.links),
                "roles_without_location": sum(1 for item in record.experience if not item.location),
                "roles_without_dates": sum(1 for item in record.experience if not item.start_date or not item.end_date),
                "skills_count": len(record.skills),
            },
        }
    )
    normalization_target = record.model_dump(mode="json")
    normalization_target["derived"] = record.derived
    normalize_domain_years(normalization_target, source_text)
    record.derived["experience_by_domain"] = normalization_target["derived"].get("experience_by_domain", {})
    record.derived["domain_years_review"] = normalization_target["derived"].get("domain_years_review", {})
    return record


def normalize_domain_years(record: dict, source_text: str | None = None) -> dict:
    """Normalize domain-year estimates so impossible values do not become canonical.

    The LLM may infer domain years from a broad resume summary. Canonical data should
    never claim more years in a domain than the candidate's non-overlapping total
    experience, and it should carry evidence that explains how the estimate was made.
    """

    derived = record.setdefault("derived", {})
    domains = derived.get("experience_by_domain") or {}
    if not isinstance(domains, dict):
        derived["experience_by_domain"] = {}
        derived["domain_years_review"] = {"status": "no_domain_data", "flags": []}
        return record

    total_months = _total_experience_months(record)
    full_text = "\n".join([_record_text_from_dict(record), source_text or ""])
    normalized: dict[str, dict] = {}
    review_flags: list[dict] = []
    for domain, value in sorted(domains.items()):
        raw_months = _domain_raw_months(value)
        role_evidence = _domain_role_evidence(record.get("experience") or [], domain)
        role_months = _union_months_from_ranges(
            [item["covered_months"] for item in role_evidence if item.get("covered_months")]
        )
        if raw_months <= 0 and role_months > 0:
            raw_months = role_months
        capped = False
        original_months = raw_months
        if total_months > 0 and raw_months > total_months:
            raw_months = total_months
            capped = True
        terms = _domain_evidence_terms(value, full_text, domain)
        flags: list[str] = []
        if capped:
            flags.append("capped_to_total_experience")
        if not role_evidence and raw_months:
            flags.append("no_dated_role_evidence")
        if role_months and raw_months > role_months + 3:
            flags.append("domain_exceeds_role_evidence")
        if flags:
            review_flags.append({"domain": domain, "flags": flags})
        normalized[domain] = {
            "months": raw_months,
            "years": round(raw_months / 12, 1),
            "original_months": original_months if capped else _maybe_original_months(value),
            "original_years": round(original_months / 12, 1) if capped else _maybe_original_years(value),
            "capped": capped,
            "cap_reason": "domain estimate exceeded total non-overlapping experience" if capped else None,
            "evidence_terms": terms,
            "role_evidence": [
                {key: val for key, val in item.items() if key != "covered_months"}
                for item in role_evidence[:8]
            ],
            "role_evidence_months": role_months,
            "role_evidence_years": round(role_months / 12, 1),
            "evidence_quality": "role_dated" if role_months else "term_only" if terms else "estimate_only",
            "review_flags": flags,
        }
    derived["experience_by_domain"] = normalized
    derived["domain_years_review"] = {
        "status": "needs_review" if review_flags else "ok",
        "total_months_baseline": total_months,
        "total_years_baseline": round(total_months / 12, 1) if total_months else 0,
        "flags": review_flags,
        "policy": "Domain years are capped at total non-overlapping professional experience and evidence is retained per domain.",
    }
    return record


def _role_intelligence(item: Experience) -> dict:
    months = _months_between(item.start_date, item.end_date)
    role_text = _experience_text(item)
    domains = [
        domain
        for domain, terms in DOMAIN_KEYWORDS.items()
        if _contains_any(role_text, terms) or _contains_any(item.title or "", terms)
    ]
    return {
        "company": item.company,
        "title": item.title,
        "location": item.location,
        "start_date": item.start_date,
        "end_date": item.end_date,
        "months": months,
        "years": round(months / 12, 1),
        "domains": domains,
        "seniority_signal": _seniority_from_title(item.title),
        "bullet_count": len(item.bullets),
    }


def _domain_months(experience: list[Experience]) -> dict[str, int]:
    months_by_domain: dict[str, set[tuple[int, int]]] = defaultdict(set)
    for item in experience:
        covered_months = _covered_months(item.start_date, item.end_date)
        role_text = _experience_text(item)
        for domain, terms in DOMAIN_KEYWORDS.items():
            if _contains_any(role_text, terms) or _contains_any(item.title or "", terms):
                months_by_domain[domain].update(covered_months)
    return {domain: len(months) for domain, months in months_by_domain.items()}


def _domain_raw_months(value: object) -> int:
    if isinstance(value, dict):
        for key in ("months", "total_months", "estimated_months", "duration_months"):
            if key in value:
                return max(0, int(round(_safe_float(value.get(key)))))
        for key in ("years", "duration_years", "total_years", "estimated_years"):
            if key in value:
                return max(0, int(round(_safe_float(value.get(key)) * 12)))
        return 0
    return max(0, int(round(_safe_float(value) * 12)))


def _maybe_original_months(value: object) -> int | None:
    if not isinstance(value, dict):
        return None
    for key in ("original_months", "raw_months"):
        if key in value:
            return max(0, int(round(_safe_float(value.get(key)))))
    return None


def _maybe_original_years(value: object) -> float | None:
    if not isinstance(value, dict):
        return None
    for key in ("original_years", "raw_years"):
        if key in value:
            return round(_safe_float(value.get(key)), 1)
    return None


def _domain_evidence_terms(value: object, full_text: str, domain: str) -> list[str]:
    existing: list[str] = []
    if isinstance(value, dict):
        for key in ("evidence_terms", "matched_terms", "keywords"):
            maybe_terms = value.get(key)
            if isinstance(maybe_terms, list):
                existing.extend(str(item) for item in maybe_terms if str(item).strip())
    terms = [*existing, *_matching_terms(full_text, DOMAIN_KEYWORDS.get(domain, []))]
    return sorted({term for term in terms if term})


def _domain_role_evidence(experience: list[object], domain: str) -> list[dict]:
    terms = DOMAIN_KEYWORDS.get(domain, [])
    evidence: list[dict] = []
    for item in experience:
        if not isinstance(item, dict):
            continue
        text = _experience_text_from_dict(item)
        matched = _matching_terms(text, terms)
        if matched or _contains_any(str(item.get("title") or ""), terms):
            covered = _covered_months(item.get("start_date"), item.get("end_date"))
            evidence.append(
                {
                    "company": item.get("company"),
                    "title": item.get("title"),
                    "start_date": item.get("start_date"),
                    "end_date": item.get("end_date"),
                    "matched_terms": matched,
                    "covered_months": covered,
                    "months": len(covered),
                    "years": round(len(covered) / 12, 1),
                    "source": "experience",
                }
            )
        for workstream in item.get("workstreams") or []:
            if not isinstance(workstream, dict):
                continue
            workstream_text = _workstream_text_from_dict(workstream)
            matched_workstream = _matching_terms(workstream_text, terms)
            if not matched_workstream:
                continue
            start_date = workstream.get("start_date") or item.get("start_date")
            end_date = workstream.get("end_date") or item.get("end_date")
            covered = _covered_months(start_date, end_date)
            evidence.append(
                {
                    "company": item.get("company"),
                    "title": workstream.get("name") or workstream.get("role") or item.get("title"),
                    "start_date": start_date,
                    "end_date": end_date,
                    "matched_terms": matched_workstream,
                    "covered_months": covered,
                    "months": len(covered),
                    "years": round(len(covered) / 12, 1),
                    "source": "workstream",
                }
            )
    return evidence


def _union_months_from_ranges(ranges: list[set[tuple[int, int]]]) -> int:
    covered: set[tuple[int, int]] = set()
    for value in ranges:
        covered.update(value)
    return len(covered)


def _total_experience_months(record: dict) -> int:
    derived = record.get("derived") or {}
    accounting = ((derived.get("timeline") or {}).get("experience_accounting") or {})
    for value in (
        accounting.get("total_months_unique"),
        (derived.get("hr_profile") or {}).get("total_months_experience"),
    ):
        months = int(round(_safe_float(value)))
        if months > 0:
            return months
    years = _safe_float((derived.get("hr_profile") or {}).get("total_years_experience"))
    if years > 0:
        return int(round(years * 12))
    return _union_months_from_ranges([_covered_months(item.get("start_date"), item.get("end_date")) for item in record.get("experience") or [] if isinstance(item, dict)])


def _union_months(experience: list[Experience]) -> int:
    covered: set[tuple[int, int]] = set()
    for item in experience:
        covered.update(_covered_months(item.start_date, item.end_date))
    return len(covered)


def _covered_months(start_text: str | None, end_text: str | None) -> set[tuple[int, int]]:
    start = _parse_year_month(start_text)
    end = _parse_year_month(end_text) or (date.today().year, date.today().month)
    if not start:
        return set()
    covered: set[tuple[int, int]] = set()
    year, month = start
    while (year, month) <= end:
        covered.add((year, month))
        month += 1
        if month > 12:
            month = 1
            year += 1
    return covered


def _months_between(start_text: str | None, end_text: str | None) -> int:
    start = _parse_year_month(start_text)
    end = _parse_year_month(end_text) or (date.today().year, date.today().month)
    if not start:
        return 0
    return max(0, (end[0] - start[0]) * 12 + end[1] - start[1] + 1)


def _parse_year_month(value: str | None) -> tuple[int, int] | None:
    if not value:
        return None
    text = value.lower().strip()
    if text in {"present", "current", "now"}:
        return date.today().year, date.today().month
    match = re.search(r"(20\d{2}|19\d{2})[-/](1[0-2]|0?[1-9])", text)
    if match:
        return int(match.group(1)), int(match.group(2))
    month_names = {
        "jan": 1,
        "feb": 2,
        "mar": 3,
        "apr": 4,
        "may": 5,
        "jun": 6,
        "jul": 7,
        "aug": 8,
        "sep": 9,
        "oct": 10,
        "nov": 11,
        "dec": 12,
    }
    match = re.search(r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(20\d{2}|19\d{2})", text)
    if match:
        return int(match.group(2)), month_names[match.group(1)]
    match = re.search(r"(20\d{2}|19\d{2})", text)
    if match:
        return int(match.group(1)), 1
    return None


def _tool_evidence(record: ResumeRecord, full_text: str) -> dict[str, dict]:
    evidence = {}
    for tool, terms in TOOL_KEYWORDS.items():
        matched = _matching_terms(full_text, terms)
        if matched:
            evidence[tool] = {
                "matched_terms": matched,
                "in_skills": any(_contains_any(skill, terms) for skill in record.skills),
                "in_experience": any(_contains_any(_experience_text(item), terms) for item in record.experience),
            }
    return evidence


def _countries_associated(record: ResumeRecord, full_text: str) -> list[dict]:
    countries = []
    for country, terms in COUNTRY_SIGNALS.items():
        matched = _matching_terms(full_text, terms)
        if matched:
            countries.append({"country": country, "evidence": matched})
    return countries


def _recruiter_highlights(
    record: ResumeRecord,
    total_months: int,
    domain_months: dict[str, int],
    tool_evidence: dict[str, dict],
) -> list[str]:
    highlights = []
    current_title = _first_non_empty(item.title for item in record.experience)
    if current_title:
        highlights.append(f"Current role: {current_title}")
    if total_months:
        highlights.append(f"{round(total_months / 12, 1)} years of total professional experience")
    for domain in ["generative_ai", "conversational_ai", "data_engineering", "cloud_architecture"]:
        months = domain_months.get(domain, 0)
        if months:
            highlights.append(f"{round(months / 12, 1)} years exposure in {domain.replace('_', ' ')}")
    if tool_evidence:
        top_tools = list(tool_evidence)[:8]
        highlights.append("Tool/platform exposure: " + ", ".join(top_tools))
    if record.certifications:
        highlights.append("Certification: " + "; ".join(record.certifications))
    return highlights


def _search_facets(
    record: ResumeRecord,
    domain_months: dict[str, int],
    tool_evidence: dict[str, dict],
    location_intelligence: dict,
) -> dict:
    return {
        "titles": [item.title for item in record.experience if item.title],
        "companies": [item.company for item in record.experience if item.company],
        "domains": sorted(domain_months),
        "tools": sorted(tool_evidence),
        "skills": record.skills,
        "degrees": [item.degree for item in record.education if item.degree],
        "locations": [value for value in [record.contact.location, *[item.location for item in record.experience], *[item.location for item in record.education]] if value],
        "countries": [item["country"] for item in location_intelligence.get("countries_associated", []) if isinstance(item, dict)],
    }


def _highest_education(record: ResumeRecord) -> str | None:
    degree_text = " ".join(item.degree or "" for item in record.education).lower()
    if "ph.d" in degree_text or "phd" in degree_text:
        return "doctorate"
    if "m.s" in degree_text or "master" in degree_text or "mba" in degree_text:
        return "masters"
    if "b.tech" in degree_text or "b.s" in degree_text or "bachelor" in degree_text:
        return "bachelors"
    return None


def _seniority_level(record: ResumeRecord) -> str | None:
    scores = [_seniority_from_title(item.title) for item in record.experience if item.title]
    if not scores:
        return None
    highest = max(scores)
    if highest >= 4:
        return "lead"
    if highest == 3:
        return "senior"
    if highest == 2:
        return "mid-level"
    return "early-career"


def _seniority_from_title(title: str | None) -> int:
    if not title:
        return 0
    lowered = title.lower()
    return max((score for term, score in SENIORITY_TERMS.items() if term in lowered), default=0)


def _record_text(record: ResumeRecord) -> str:
    parts = [
        record.name or "",
        record.summary or "",
        " ".join(record.skills),
        " ".join(record.certifications),
        " ".join(record.awards),
        " ".join(record.publications),
        " ".join(record.languages),
        " ".join(_experience_text(item) for item in record.experience),
        " ".join(" ".join(filter(None, [item.school, item.degree, item.field, item.location])) for item in record.education),
    ]
    return "\n".join(parts).lower()


def _record_text_from_dict(record: dict) -> str:
    parts = [
        record.get("name") or "",
        record.get("summary") or "",
        " ".join(str(item) for item in record.get("skills") or []),
        " ".join(str(item) for item in record.get("certifications") or []),
        " ".join(str(item) for item in record.get("awards") or []),
        " ".join(str(item) for item in record.get("publications") or []),
        " ".join(str(item) for item in record.get("languages") or []),
        " ".join(_experience_text_from_dict(item) for item in record.get("experience") or [] if isinstance(item, dict)),
        " ".join(
            " ".join(str(value) for value in [item.get("school"), item.get("degree"), item.get("field"), item.get("location")] if value)
            for item in record.get("education") or []
            if isinstance(item, dict)
        ),
    ]
    return "\n".join(parts).lower()


def _experience_text(item: Experience) -> str:
    workstream_text = []
    for workstream in item.workstreams:
        workstream_text.extend(
            [
                workstream.name or "",
                workstream.role or "",
                workstream.location or "",
                " ".join(workstream.bullets),
                " ".join(workstream.technologies),
            ]
        )
    return " ".join(
        [
            item.company or "",
            item.title or "",
            item.location or "",
            " ".join(item.bullets),
            " ".join(item.technologies),
            " ".join(workstream_text),
        ]
    ).lower()


def _experience_text_from_dict(item: dict) -> str:
    workstream_text = [_workstream_text_from_dict(workstream) for workstream in item.get("workstreams") or [] if isinstance(workstream, dict)]
    return " ".join(
        str(value)
        for value in [
            item.get("company") or "",
            item.get("title") or "",
            item.get("location") or "",
            " ".join(str(entry) for entry in item.get("bullets") or []),
            " ".join(str(entry) for entry in item.get("technologies") or []),
            " ".join(workstream_text),
        ]
    ).lower()


def _workstream_text_from_dict(item: dict) -> str:
    return " ".join(
        str(value)
        for value in [
            item.get("name") or "",
            item.get("role") or "",
            item.get("location") or "",
            " ".join(str(entry) for entry in item.get("bullets") or []),
            " ".join(str(entry) for entry in item.get("technologies") or []),
        ]
    ).lower()


def _matching_terms(text: str, terms: Iterable[str]) -> list[str]:
    lowered = text.lower()
    return sorted({term for term in terms if term.lower() in lowered})


def _contains_any(text: str, terms: Iterable[str]) -> bool:
    lowered = text.lower()
    return any(term.lower() in lowered for term in terms)


def _first_non_empty(values: Iterable[str | None]) -> str | None:
    return next((value for value in values if value), None)


def _safe_float(value: object) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0
