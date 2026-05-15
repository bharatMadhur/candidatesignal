from __future__ import annotations

import re
from datetime import date
from typing import Any


def build_timeline_profile(record: dict[str, Any]) -> dict[str, Any]:
    events = [_event_from_experience(item, index) for index, item in enumerate(record.get("experience") or [])]
    dated_events = [event for event in events if event["start_sort"] is not None]
    dated_events.sort(key=lambda event: event["start_sort"] or (9999, 12), reverse=True)

    overlap_groups = _overlap_groups(dated_events)
    overlaps_by_id = {event["id"]: [] for event in dated_events}
    for group in overlap_groups:
        ids = [event["id"] for event in group["events"]]
        for event_id in ids:
            overlaps_by_id[event_id].extend(other for other in ids if other != event_id)

    total_months = _union_months(dated_events)
    for event in dated_events:
        event["overlaps_with"] = sorted(set(overlaps_by_id.get(event["id"], [])))
        event["overlap_note"] = (
            "Overlaps with another dated role/project; counted once in total experience."
            if event["overlaps_with"]
            else None
        )
        event.pop("start_sort", None)
        event.pop("end_sort", None)

    return {
        "timeline_events": dated_events,
        "experience_accounting": {
            "total_months_unique": total_months,
            "total_years_unique": round(total_months / 12, 1),
            "overlap_policy": "Months covered by two or more roles are counted once, not double-counted.",
            "overlap_group_count": len(overlap_groups),
            "overlap_groups": [
                {
                    "event_ids": [event["id"] for event in group["events"]],
                    "label": " / ".join(
                        _compact_label(event.get("title"), event.get("organization")) for event in group["events"]
                    ),
                }
                for group in overlap_groups
            ],
        },
    }


def _event_from_experience(item: dict[str, Any], index: int) -> dict[str, Any]:
    start = _parse_year_month(item.get("start_date"))
    end = _parse_year_month(item.get("end_date")) or (date.today().year, date.today().month)
    duration_months = _months_between(start, end)
    return {
        "id": f"exp_{index + 1}",
        "type": "experience",
        "title": item.get("title"),
        "organization": item.get("company"),
        "location": item.get("location"),
        "start_date": item.get("start_date"),
        "end_date": item.get("end_date"),
        "is_current": str(item.get("end_date") or "").lower() in {"present", "current", "now", ""},
        "duration_months": duration_months,
        "duration_years": round(duration_months / 12, 1),
        "summary": _first_text(item.get("bullets")),
        "technologies": item.get("technologies") or [],
        "evidence": [text for text in (item.get("bullets") or [])[:3] if text],
        "workstreams": item.get("workstreams") or [],
        "start_sort": start,
        "end_sort": end if start else None,
        "overlaps_with": [],
        "overlap_note": None,
    }


def _union_months(events: list[dict[str, Any]]) -> int:
    covered: set[tuple[int, int]] = set()
    for event in events:
        start = event.get("start_sort")
        end = event.get("end_sort")
        if not start or not end:
            continue
        year, month = start
        while (year, month) <= end:
            covered.add((year, month))
            month += 1
            if month > 12:
                month = 1
                year += 1
    return len(covered)


def _overlap_groups(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: list[list[dict[str, Any]]] = []
    for event in events:
        if not event.get("start_sort") or not event.get("end_sort"):
            continue
        matched_group: list[dict[str, Any]] | None = None
        for group in groups:
            if any(_overlaps(event, existing) and not _same_organization(event, existing) for existing in group):
                matched_group = group
                break
        if matched_group is None:
            groups.append([event])
        else:
            matched_group.append(event)
    return [{"events": group} for group in groups if len(group) > 1]


def _overlaps(left: dict[str, Any], right: dict[str, Any]) -> bool:
    left_start = left.get("start_sort")
    left_end = left.get("end_sort")
    right_start = right.get("start_sort")
    right_end = right.get("end_sort")
    if not left_start or not left_end or not right_start or not right_end:
        return False
    # Resume date ranges usually encode month-level transitions inclusively.
    # If one role ends in the same month another role starts, treat it as a
    # handoff, not concurrent employment.
    return _month_index(left_start) < _month_index(right_end) and _month_index(right_start) < _month_index(left_end)


def _same_organization(left: dict[str, Any], right: dict[str, Any]) -> bool:
    return _normalize_org(left.get("organization")) and _normalize_org(left.get("organization")) == _normalize_org(right.get("organization"))


def _normalize_org(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def _months_between(start: tuple[int, int] | None, end: tuple[int, int] | None) -> int:
    if not start or not end:
        return 0
    return max(0, (end[0] - start[0]) * 12 + end[1] - start[1] + 1)


def _month_index(value: tuple[int, int]) -> int:
    return value[0] * 12 + value[1]


def _parse_year_month(value: str | None) -> tuple[int, int] | None:
    if not value:
        return None
    text = value.lower().strip()
    if text in {"present", "current", "now"}:
        return date.today().year, date.today().month
    match = re.search(r"(20\d{2}|19\d{2})[-/](1[0-2]|0?[1-9])", text)
    if match:
        return int(match.group(1)), int(match.group(2))
    months = {
        "jan": 1,
        "feb": 2,
        "mar": 3,
        "apr": 4,
        "may": 5,
        "jun": 6,
        "jul": 7,
        "aug": 8,
        "sep": 9,
        "sept": 9,
        "oct": 10,
        "nov": 11,
        "dec": 12,
    }
    match = re.search(r"(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(20\d{2}|19\d{2})", text)
    if match:
        return int(match.group(2)), months[match.group(1)]
    match = re.search(r"(20\d{2}|19\d{2})", text)
    if match:
        return int(match.group(1)), 1
    return None


def _first_text(values: Any) -> str | None:
    if not isinstance(values, list):
        return None
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _compact_label(title: str | None, organization: str | None) -> str:
    if title and organization:
        return f"{title} at {organization}"
    return title or organization or "Dated event"
