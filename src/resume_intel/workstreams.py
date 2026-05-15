from __future__ import annotations

import copy
import re
from datetime import date
from typing import Any


ROLE_WORDS = {
    "engineer",
    "developer",
    "architect",
    "analyst",
    "manager",
    "lead",
    "principal",
    "senior",
    "staff",
    "director",
    "consultant",
    "specialist",
    "officer",
    "founder",
    "founding",
    "intern",
}

PROJECT_WORDS = {
    "agent",
    "app",
    "application",
    "assistant",
    "automation",
    "chatbot",
    "dashboard",
    "engine",
    "implementation",
    "integration",
    "migration",
    "pipeline",
    "platform",
    "portal",
    "product",
    "project",
    "service",
    "system",
    "tool",
    "workflow",
}


def nest_same_company_workstreams(raw: dict[str, Any]) -> dict[str, Any]:
    """Move same-company project-like experience rows under their parent role.

    Some resumes list projects under a company with the same date range as the
    employment role. Keeping those rows as peer roles creates fake concurrency.
    This keeps the parent role in `experience` and preserves the project rows as
    `experience[].workstreams`.
    """
    record = copy.deepcopy(raw)
    experience = [item for item in record.get("experience") or [] if isinstance(item, dict)]
    if len(experience) < 2:
        return record

    remove_indexes: set[int] = set()
    for child_index, child in enumerate(experience):
        if not _is_project_like(child):
            continue
        parent_index = _find_parent_role(child_index, child, experience)
        if parent_index is None:
            continue
        parent = experience[parent_index]
        parent.setdefault("workstreams", [])
        parent["workstreams"].append(_workstream_from_experience(child, child_index))
        remove_indexes.add(child_index)

    if remove_indexes:
        record["experience"] = [item for index, item in enumerate(experience) if index not in remove_indexes]
        record.setdefault("derived", {})
        record["derived"]["workstream_normalization"] = {
            "moved_experience_rows": len(remove_indexes),
            "policy": "Same-company project-like rows with overlapping dates are nested under the parent role.",
        }
    return record


def _find_parent_role(child_index: int, child: dict[str, Any], experience: list[dict[str, Any]]) -> int | None:
    candidates = []
    for index, item in enumerate(experience):
        if index == child_index or _normalize_org(item.get("company")) != _normalize_org(child.get("company")):
            continue
        if not _is_role_like(item):
            continue
        if not _ranges_overlap_or_match(item, child):
            continue
        candidates.append((index, _duration_months(item)))
    if not candidates:
        return None
    # Prefer the broadest role as the parent. Stable sort keeps resume order for ties.
    candidates.sort(key=lambda item: item[1], reverse=True)
    return candidates[0][0]


def _workstream_from_experience(item: dict[str, Any], index: int) -> dict[str, Any]:
    return {
        "name": item.get("title") or f"Workstream {index + 1}",
        "role": item.get("role"),
        "location": item.get("location"),
        "start_date": item.get("start_date"),
        "end_date": item.get("end_date"),
        "bullets": item.get("bullets") or [],
        "technologies": item.get("technologies") or [],
        "evidence_note": "Nested from a same-company project-like experience row.",
    }


def _is_project_like(item: dict[str, Any]) -> bool:
    title = _normalize_words(item.get("title"))
    if not title:
        return False
    has_project_word = bool(title & PROJECT_WORDS)
    has_role_word = bool(title & ROLE_WORDS)
    compact_project_title = len(title) <= 5 and not has_role_word
    return has_project_word and (compact_project_title or not has_role_word)


def _is_role_like(item: dict[str, Any]) -> bool:
    title = _normalize_words(item.get("title"))
    return bool(title & ROLE_WORDS)


def _ranges_overlap_or_match(parent: dict[str, Any], child: dict[str, Any]) -> bool:
    parent_start = _parse_year_month(parent.get("start_date"))
    parent_end = _parse_year_month(parent.get("end_date")) or (date.today().year, date.today().month)
    child_start = _parse_year_month(child.get("start_date"))
    child_end = _parse_year_month(child.get("end_date")) or (date.today().year, date.today().month)
    if not parent_start or not child_start:
        return False
    return _month_index(parent_start) <= _month_index(child_end) and _month_index(child_start) <= _month_index(parent_end)


def _duration_months(item: dict[str, Any]) -> int:
    start = _parse_year_month(item.get("start_date"))
    end = _parse_year_month(item.get("end_date")) or (date.today().year, date.today().month)
    if not start or not end:
        return 0
    return max(0, _month_index(end) - _month_index(start) + 1)


def _parse_year_month(value: Any) -> tuple[int, int] | None:
    if not value:
        return None
    text = str(value).lower().strip()
    if text in {"present", "current", "now"}:
        return date.today().year, date.today().month
    match = re.search(r"(20\d{2}|19\d{2})[-/](1[0-2]|0?[1-9])", text)
    if match:
        return int(match.group(1)), int(match.group(2))
    match = re.search(r"(20\d{2}|19\d{2})", text)
    if match:
        return int(match.group(1)), 1
    return None


def _month_index(value: tuple[int, int]) -> int:
    return value[0] * 12 + value[1]


def _normalize_org(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def _normalize_words(value: Any) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", str(value or "").lower()))
