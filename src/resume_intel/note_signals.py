from __future__ import annotations

import re
from typing import Any

from psycopg import Connection
from psycopg.types.json import Jsonb


VISA_PATTERNS = [
    ("opt", r"\bOPT\b|optional practical training"),
    ("stem_opt", r"\bSTEM\s+OPT\b"),
    ("cpt", r"\bCPT\b|curricular practical training"),
    ("h1b", r"\bH-?1B\b"),
    ("h4_ead", r"\bH-?4\s+EAD\b"),
    ("ead", r"\bEAD\b|employment authorization document"),
    ("green_card", r"green card|\bGC\b|permanent resident"),
    ("us_citizen", r"\bUSC\b|u\.?s\.? citizen|citizenship"),
    ("w2_only", r"\bW-?2\b|w2 only"),
    ("c2c", r"\bC2C\b|corp(?:oration)?\s+to\s+corp(?:oration)?"),
    ("contract_1099", r"\b1099\b"),
    ("sponsorship_required", r"need(?:s|ing)? sponsorship|requires sponsorship|visa sponsorship"),
    ("no_sponsorship_required", r"no sponsorship|does not need sponsorship|without sponsorship"),
]
MOBILITY_PATTERNS = [
    ("open_to_relocate", r"open to relocat|willing to relocat|relocation ok"),
    ("not_open_to_relocate", r"not open to relocat|cannot relocat|no relocation"),
    ("remote_preferred", r"\bremote\b|work from home|wfh"),
    ("hybrid_preferred", r"\bhybrid\b"),
    ("onsite_preferred", r"\bonsite\b|on-site"),
]
AVAILABILITY_PATTERNS = [
    ("immediate", r"immediate(?:ly)? available|available now|join immediately"),
    ("two_weeks", r"2 weeks|two weeks|14 days"),
    ("notice_period", r"notice period|available from|start date"),
]
RELATIONSHIP_PATTERNS = [
    ("linkedin_connected", r"connected (?:with|on)\s+linkedin|linkedin connection|1st degree"),
    ("linkedin_messaged", r"messaged (?:on|via)\s+linkedin|linkedin message|inmail"),
    ("phone_screened", r"phone screen|screened by phone|called candidate|spoke with"),
    ("email_sent", r"email(?:ed)? candidate|sent email|emailed"),
]
SOURCE_PATTERNS = [
    ("linkedin_source", r"\blinkedin\b"),
    ("referral_source", r"\breferral\b|referred by"),
    ("job_board_source", r"indeed|dice|monster|ziprecruiter|job board"),
    ("direct_applicant_source", r"direct applicant|applied directly|inbound applicant"),
    ("agency_source", r"vendor submitted|agency submitted|supplier submitted"),
]
PROFILE_STATUS_PATTERNS = [
    ("linkedin_verified", r"linkedin verified|verified linkedin|profile verified"),
    ("linkedin_needs_verification", r"verify linkedin|linkedin unclear|linkedin not verified"),
    ("resume_requested", r"asked for updated resume|requested updated resume|need updated resume"),
    ("profile_stale", r"stale profile|old resume|outdated resume|resume is old"),
]
CONCERN_PATTERNS = [
    ("concern", r"\bconcern\b|\brisk\b|red flag|verify|unclear|gap"),
    ("strong_signal", r"strong fit|good fit|excellent|shortlist|priority"),
]


def extract_recruiter_note_signals(name: str | None, content: str | None) -> list[dict[str, Any]]:
    """Extract practical recruiter filters from free-flow notes.

    This intentionally stays deterministic. Notes can contain sensitive tenant-
    private context, so we should not send them to an external LLM just to create
    simple filters like OPT, salary, availability, or relocation.
    """

    title = (name or "").strip()
    body = (content or "").strip()
    text = f"{title}\n{body}".strip()
    if not text:
        return []
    signals: list[dict[str, Any]] = []
    signals.extend(_pattern_signals("work_authorization", text, VISA_PATTERNS))
    signals.extend(_pattern_signals("mobility", text, MOBILITY_PATTERNS))
    signals.extend(_pattern_signals("availability", text, AVAILABILITY_PATTERNS))
    signals.extend(_pattern_signals("relationship", text, RELATIONSHIP_PATTERNS))
    signals.extend(_pattern_signals("candidate_source", text, SOURCE_PATTERNS))
    signals.extend(_pattern_signals("profile_status", text, PROFILE_STATUS_PATTERNS))
    signals.extend(_pattern_signals("screening", text, CONCERN_PATTERNS))
    signals.extend(_salary_signals(text))
    signals.extend(_location_preference_signals(text))
    return _dedupe_signals(signals)


def replace_note_signals(
    conn: Connection,
    *,
    tenant_id: str,
    document_id: str,
    note_id: str,
    note_name: str,
    note_content: str,
) -> list[dict[str, Any]]:
    conn.execute(
        "delete from candidate_note_signals where tenant_id=%s and document_id=%s and note_id=%s",
        (tenant_id, document_id, note_id),
    )
    signals = extract_recruiter_note_signals(note_name, note_content)
    for signal in signals:
        conn.execute(
            """
            insert into candidate_note_signals (
              tenant_id, document_id, note_id, category, label, value, confidence, source_text, metadata
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                tenant_id,
                document_id,
                note_id,
                signal["category"],
                signal["label"],
                signal.get("value"),
                signal.get("confidence", 0.75),
                signal.get("source_text"),
                Jsonb(signal.get("metadata") or {}),
            ),
        )
    return signals


def delete_note_signals(conn: Connection, *, tenant_id: str, document_id: str, note_id: str) -> None:
    conn.execute(
        "delete from candidate_note_signals where tenant_id=%s and document_id=%s and note_id=%s",
        (tenant_id, document_id, note_id),
    )


def candidate_note_signal_summary(conn: Connection, *, tenant_id: str, document_id: str) -> dict[str, Any]:
    rows = conn.execute(
        """
        select category, label, value, confidence, source_text, created_at
        from candidate_note_signals
        where tenant_id=%s and document_id=%s
        order by category, label, created_at desc
        """,
        (tenant_id, document_id),
    ).fetchall()
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault(row["category"], []).append(
            {
                "label": row["label"],
                "value": row.get("value"),
                "confidence": float(row.get("confidence") or 0),
                "source_text": row.get("source_text"),
            }
        )
    flat = [
        {
            "category": category,
            "label": item["label"],
            "value": item.get("value"),
            "confidence": item.get("confidence"),
            "source_text": item.get("source_text"),
        }
        for category, items in grouped.items()
        for item in items
    ]
    return {"signals": flat, "by_category": grouped, "count": len(flat)}


def _pattern_signals(category: str, text: str, patterns: list[tuple[str, str]]) -> list[dict[str, Any]]:
    signals: list[dict[str, Any]] = []
    for label, pattern in patterns:
        match = re.search(pattern, text, re.I)
        if not match:
            continue
        signals.append(
            {
                "category": category,
                "label": label,
                "value": match.group(0),
                "confidence": 0.85,
                "source_text": _source_window(text, match.start(), match.end()),
            }
        )
    return signals


def _salary_signals(text: str) -> list[dict[str, Any]]:
    signals: list[dict[str, Any]] = []
    for match in re.finditer(r"(?:salary|comp|compensation|rate|expect(?:ed|ation)?|base)?\s*(\$?\s*\d{2,4}(?:,\d{3})?\s*[kK]?)", text, re.I):
        value = match.group(1).replace(" ", "")
        if not _looks_like_compensation(value):
            continue
        signals.append(
            {
                "category": "compensation",
                "label": "compensation_expectation",
                "value": value,
                "confidence": 0.8,
                "source_text": _source_window(text, match.start(), match.end()),
            }
        )
    return signals[:3]


def _location_preference_signals(text: str) -> list[dict[str, Any]]:
    signals: list[dict[str, Any]] = []
    for match in re.finditer(r"(?:location|based in|prefers?|open to)\s*[:\-]?\s*([A-Z][A-Za-z .'-]+(?:,\s*[A-Z]{2})?)", text):
        value = match.group(1).strip().strip(".")
        if len(value) < 3 or len(value.split()) > 6:
            continue
        signals.append(
            {
                "category": "location_preference",
                "label": "location_preference",
                "value": value,
                "confidence": 0.72,
                "source_text": _source_window(text, match.start(), match.end()),
            }
        )
    return signals[:3]


def _looks_like_compensation(value: str) -> bool:
    digits = re.sub(r"\D", "", value)
    if not digits:
        return False
    amount = int(digits)
    if "k" in value.lower():
        return 20 <= amount <= 900
    return 20000 <= amount <= 900000


def _source_window(text: str, start: int, end: int) -> str:
    left = max(0, start - 80)
    right = min(len(text), end + 80)
    return re.sub(r"\s+", " ", text[left:right]).strip()


def _dedupe_signals(signals: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for signal in signals:
        key = (signal["category"], signal["label"], str(signal.get("value") or "").lower())
        if key in seen:
            continue
        seen.add(key)
        result.append(signal)
    return result
