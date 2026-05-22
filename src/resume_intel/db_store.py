from __future__ import annotations

import copy
import re
from pathlib import Path
from typing import Any

from psycopg.types.json import Jsonb

from .candidate_facts import factual_current_company, factual_current_title
from .coverage import primary_key_coverage
from .db import db
from .derive import normalize_domain_years
from .fact_verification import enrich_fact_verification
from .geo import current_job_location, enrich_record_locations
from .pii import enrich_record_pii
from .profile_verification import enrich_profile_verification
from .timeline import build_timeline_profile
from .vector_search import upsert_candidate_search_chunks


def save_candidate_db(
    record: dict[str, Any],
    raw_text: str | None,
    user_id: str | None,
    tenant_id: str | None = None,
    *,
    reindex_search: bool = True,
) -> dict[str, Any]:
    if not tenant_id:
        tenant_id = _default_tenant_id()
    _ensure_tenant_document_id(record, tenant_id)
    record["tenant_id"] = tenant_id
    enrich_record_pii(record, raw_text)
    enrich_profile_verification(record)
    enrich_record_locations(record, raw_text)
    normalize_domain_years(record, raw_text)
    enrich_fact_verification(record, raw_text)
    record["primary_key_coverage"] = primary_key_coverage(record)
    contact = record.get("contact") or {}
    with db() as conn:
        conn.execute(
            """
            insert into candidates (
              document_id, tenant_id, owner_user_id, created_by_user_id, source_file,
              storage_backend, storage_key, original_filename, mime_type, size_bytes, source_sha256,
              name, email, phone, record_json, raw_text, updated_at
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
            on conflict (document_id) do update set
              tenant_id = excluded.tenant_id,
              owner_user_id = coalesce(excluded.owner_user_id, candidates.owner_user_id),
              created_by_user_id = coalesce(candidates.created_by_user_id, excluded.created_by_user_id),
              source_file = excluded.source_file,
              storage_backend = excluded.storage_backend,
              storage_key = excluded.storage_key,
              original_filename = excluded.original_filename,
              mime_type = excluded.mime_type,
              size_bytes = excluded.size_bytes,
              source_sha256 = excluded.source_sha256,
              name = excluded.name,
              email = excluded.email,
              phone = excluded.phone,
              record_json = excluded.record_json,
              raw_text = excluded.raw_text,
              deleted_at = null,
              deleted_by_user_id = null,
              deletion_reason = null,
              updated_at = now()
            """,
            (
                record["document_id"],
                tenant_id,
                user_id,
                user_id,
                record.get("source_file") or "",
                record.get("storage_backend"),
                record.get("storage_key"),
                record.get("original_filename"),
                record.get("mime_type"),
                record.get("size_bytes"),
                record.get("source_sha256"),
                record.get("name"),
                contact.get("email"),
                contact.get("phone"),
                Jsonb(record),
                raw_text,
            ),
        )
        document_row = _upsert_candidate_document(conn, record, tenant_id, user_id)
        if document_row:
            _replace_document_pages(conn, record, tenant_id, str(document_row["id"]))
        _replace_llm_usage_events(conn, record, tenant_id)
        _replace_normalized_candidate_tables(conn, record, tenant_id)
        _upsert_training_data_example(conn, record, raw_text, tenant_id, "resume_parse")
        _record_activity_event(
            conn,
            tenant_id,
            record["document_id"],
            user_id,
            "candidate.parsed",
            "Resume parsed",
            record.get("original_filename") or Path(record.get("source_file") or "Uploaded CV").name,
            {"coverage": (record.get("primary_key_coverage") or {}).get("score")},
        )
        conn.commit()
    if reindex_search:
        upsert_candidate_search_chunks(record, raw_text, tenant_id)
    return record


def load_candidate_db(document_id: str, tenant_id: str | None = None) -> dict[str, Any]:
    with db() as conn:
        if tenant_id:
            row = conn.execute("select record_json from candidates where document_id=%s and tenant_id=%s and deleted_at is null", (document_id, tenant_id)).fetchone()
        else:
            row = conn.execute("select record_json from candidates where document_id=%s and deleted_at is null", (document_id,)).fetchone()
        if not row:
            raise FileNotFoundError(document_id)
        return row["record_json"]


def public_candidate_record(record: dict[str, Any], *, allow_pii: bool = True) -> dict[str, Any]:
    public = copy.deepcopy(record)
    normalize_domain_years(public)
    original_filename = public.get("original_filename") or Path(public.get("source_file") or "Uploaded CV").name
    public["source_file"] = original_filename
    if allow_pii:
        enrich_profile_verification(public)
    if not allow_pii:
        _redact_record_pii(public)
    metadata = public.get("_metadata")
    if isinstance(metadata, dict):
        for key in ("model_path", "hr_model_path", "raw_text_path", "validation_path"):
            metadata.pop(key, None)
    return public


def _redact_record_pii(record: dict[str, Any]) -> None:
    if record.get("email"):
        record["email"] = "[redacted]"
    if record.get("phone"):
        record["phone"] = "[redacted]"
    contact = record.get("contact")
    if isinstance(contact, dict):
        if contact.get("email"):
            contact["email"] = "[redacted]"
        if contact.get("phone"):
            contact["phone"] = "[redacted]"
        if contact.get("links"):
            contact["links"] = []
    pii = ((record.get("derived") or {}).get("pii_contact_intelligence"))
    if isinstance(pii, dict):
        for key in ("emails", "phones", "linkedin_urls", "github_urls", "portfolio_websites", "all_urls"):
            pii[key] = []
    profile_verification = ((record.get("derived") or {}).get("profile_verification"))
    if isinstance(profile_verification, dict):
        for key in ("linkedin", "portfolio", "github"):
            item = profile_verification.get(key)
            if isinstance(item, dict):
                item["url"] = None
                item["urls"] = []


def list_candidates_db(tenant_id: str | None = None) -> list[dict[str, Any]]:
    tenant_id = tenant_id or _default_tenant_id()
    with db() as conn:
        rows = conn.execute(
            """
            select document_id, name, email, phone, source_file, record_json, created_at, updated_at
            from candidates
            where tenant_id=%s and deleted_at is null
            order by updated_at desc
            """,
            (tenant_id,),
        ).fetchall()
        duplicate_rows = conn.execute(
            """
            select document_id, max(score) as duplicate_risk_score,
                   (array_agg(
                     case
                       when status='same_person' then 'versioned'
                       when status='not_same_person' then 'separate'
                       else status
                     end
                     order by score desc
                   ))[1] as duplicate_status
            from (
              select left_document_id as document_id, score, status
              from candidate_version_matches
              where tenant_id=%s and status in ('suggested', 'review_later', 'same_person', 'versioned')
              union all
              select right_document_id as document_id, score, status
              from candidate_version_matches
              where tenant_id=%s and status in ('suggested', 'review_later', 'same_person', 'versioned')
            ) risks
            group by document_id
            """,
            (tenant_id, tenant_id),
        ).fetchall()
        review_rows = conn.execute(
            """
            select document_id, array_agg(signal_key order by signal_key) as reviewed_signals
            from candidate_review_signals
            where tenant_id=%s and status='reviewed'
            group by document_id
            """,
            (tenant_id,),
        ).fetchall()
    duplicate_risk = {
        row["document_id"]: {
            "duplicate_risk_score": float(row["duplicate_risk_score"] or 0),
            "duplicate_status": row["duplicate_status"],
        }
        for row in duplicate_rows
    }
    reviewed_signals = {row["document_id"]: list(row["reviewed_signals"] or []) for row in review_rows}
    candidates = []
    for row in rows:
        record = row["record_json"]
        normalize_domain_years(record)
        hr_profile = record.get("derived", {}).get("hr_profile", {})
        fact_verification = record.get("derived", {}).get("fact_verification") or {}
        location_intelligence = record.get("derived", {}).get("location_intelligence") or {}
        experience_by_domain = record.get("derived", {}).get("experience_by_domain") or {}
        top_domains = sorted(experience_by_domain, key=lambda key: _domain_year_value(experience_by_domain.get(key)), reverse=True)[:5]
        candidates.append(
            {
                "document_id": row["document_id"],
                "name": row["name"],
                "email": row["email"],
                "phone": row["phone"],
                "current_title": factual_current_title(record),
                "current_company": factual_current_company(record),
                "fact_verification_status": fact_verification.get("status"),
                "current_role_verification_status": fact_verification.get("current_role_status"),
                "current_role_flags": fact_verification.get("current_role_flags") or [],
                "total_years_experience": hr_profile.get("total_years_experience"),
                "seniority": hr_profile.get("seniority_level"),
                "top_domains": top_domains,
                "location": location_intelligence.get("current_job_location") or current_job_location(record),
                "countries": [
                    item.get("country")
                    for item in record.get("derived", {}).get("countries_associated", [])
                    if isinstance(item, dict) and item.get("country")
                ],
                "coverage": record.get("primary_key_coverage", {}).get("score"),
                "reviewed_signals": reviewed_signals.get(row["document_id"], []),
                **duplicate_risk.get(row["document_id"], {"duplicate_risk_score": 0, "duplicate_status": None}),
                "source_file": record.get("original_filename") or Path(row["source_file"] or "Uploaded CV").name,
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            }
        )
    return candidates


def reviewed_candidate_signals_db(document_id: str, tenant_id: str) -> list[str]:
    with db() as conn:
        rows = conn.execute(
            """
            select signal_key
            from candidate_review_signals
            where tenant_id=%s and document_id=%s and status='reviewed'
            order by signal_key
            """,
            (tenant_id, document_id),
        ).fetchall()
    return [row["signal_key"] for row in rows]


def mark_candidate_review_signal_db(
    document_id: str,
    tenant_id: str,
    user_id: str,
    signal_key: str,
    note: str | None = None,
) -> dict[str, Any]:
    load_candidate_db(document_id, tenant_id)
    signal_key = _clean_review_signal(signal_key)
    note = _clean_manual_text(note)
    with db() as conn:
        row = conn.execute(
            """
            insert into candidate_review_signals (
              tenant_id, document_id, signal_key, status, reviewed_by_user_id, reviewed_at, note, updated_at
            )
            values (%s, %s, %s, 'reviewed', %s, now(), %s, now())
            on conflict (tenant_id, document_id, signal_key) do update set
              status='reviewed',
              reviewed_by_user_id=excluded.reviewed_by_user_id,
              reviewed_at=now(),
              note=excluded.note,
              updated_at=now()
            returning *
            """,
            (tenant_id, document_id, signal_key, user_id, note),
        ).fetchone()
        _record_activity_event(
            conn,
            tenant_id,
            document_id,
            user_id,
            "candidate.review_signal_reviewed",
            "Candidate review item completed",
            signal_key,
            {"signal_key": signal_key, "note": note},
        )
        conn.commit()
    return _candidate_review_signal_row(row)


def add_note_db(
    document_id: str,
    user_id: str,
    name: str,
    content: str,
    tenant_id: str | None = None,
    *,
    reindex_search: bool = True,
) -> dict[str, Any]:
    tenant_id = tenant_id or _default_tenant_id()
    record = load_candidate_db(document_id, tenant_id)
    note_name = name.strip() or "HR Note"
    note_content = content.strip()
    with db() as conn:
        raw_row = conn.execute("select raw_text from candidates where document_id=%s and tenant_id=%s", (document_id, tenant_id)).fetchone()
    raw_text = raw_row["raw_text"] if raw_row else None
    with db() as conn:
        note_row = conn.execute(
            """
            insert into notes (tenant_id, document_id, user_id, name, content)
            values (%s, %s, %s, %s, %s)
            returning id, name, content, created_at, updated_at
            """,
            (tenant_id, document_id, user_id, note_name, note_content),
        ).fetchone()
        conn.commit()
    note = _note_row(note_row)
    record.setdefault("notes", []).append(note)
    # Note writes must feel immediate. Heavy candidate enrichment is owned by
    # parse/reparse/maintenance jobs; notes only change recruiter context and
    # search chunks.
    record["primary_key_coverage"] = primary_key_coverage(record)
    with db() as conn:
        conn.execute(
            "update candidates set record_json=%s, updated_at=now() where document_id=%s and tenant_id=%s",
            (Jsonb(record), document_id, tenant_id),
        )
        _upsert_training_data_example(conn, record, raw_text, tenant_id, "recruiter_note")
        _record_activity_event(
            conn,
            tenant_id,
            document_id,
            user_id,
            "note.created",
            f"Note added: {note_name}",
            note_content[:500],
            {"note_id": note["id"], "note_name": note_name},
        )
        conn.commit()
    if reindex_search:
        upsert_candidate_search_chunks(record, raw_text, tenant_id)
    return record


def update_note_db(
    document_id: str,
    note_id: str,
    user_id: str,
    name: str,
    content: str,
    tenant_id: str | None = None,
    *,
    reindex_search: bool = True,
) -> dict[str, Any]:
    tenant_id = tenant_id or _default_tenant_id()
    record = load_candidate_db(document_id, tenant_id)
    with db() as conn:
        row = conn.execute(
            """
            update notes
            set name=%s, content=%s, updated_at=now()
            where id=%s and document_id=%s and tenant_id=%s and deleted_at is null
            returning id, name, content, created_at, updated_at
            """,
            (name.strip() or "HR Note", content.strip(), note_id, document_id, tenant_id),
        ).fetchone()
        raw_row = conn.execute("select raw_text from candidates where document_id=%s and tenant_id=%s", (document_id, tenant_id)).fetchone()
        conn.commit()
    if not row:
        raise FileNotFoundError(note_id)
    raw_text = raw_row["raw_text"] if raw_row else None
    _sync_notes_from_db(record, tenant_id, document_id)
    # Keep note edits on the fast path. Profile facts are not re-derived here.
    record["primary_key_coverage"] = primary_key_coverage(record)
    with db() as conn:
        conn.execute("update candidates set record_json=%s, updated_at=now() where document_id=%s and tenant_id=%s", (Jsonb(record), document_id, tenant_id))
        _upsert_training_data_example(conn, record, raw_text, tenant_id, "recruiter_note")
        _record_activity_event(
            conn,
            tenant_id,
            document_id,
            user_id,
            "note.updated",
            "Note updated",
            content.strip()[:500],
            {"note_id": note_id},
        )
        conn.commit()
    if reindex_search:
        upsert_candidate_search_chunks(record, raw_text, tenant_id)
    return record


def delete_note_db(
    document_id: str,
    note_id: str,
    user_id: str,
    tenant_id: str | None = None,
    *,
    reindex_search: bool = True,
) -> dict[str, Any]:
    tenant_id = tenant_id or _default_tenant_id()
    record = load_candidate_db(document_id, tenant_id)
    with db() as conn:
        row = conn.execute(
            """
            update notes
            set deleted_at=now(), updated_at=now()
            where id=%s and document_id=%s and tenant_id=%s and deleted_at is null
            returning id
            """,
            (note_id, document_id, tenant_id),
        ).fetchone()
        raw_row = conn.execute("select raw_text from candidates where document_id=%s and tenant_id=%s", (document_id, tenant_id)).fetchone()
        conn.commit()
    if not row:
        raise FileNotFoundError(note_id)
    raw_text = raw_row["raw_text"] if raw_row else None
    _sync_notes_from_db(record, tenant_id, document_id)
    # Keep note deletes on the fast path. Search reindexing runs after response.
    record["primary_key_coverage"] = primary_key_coverage(record)
    with db() as conn:
        conn.execute("update candidates set record_json=%s, updated_at=now() where document_id=%s and tenant_id=%s", (Jsonb(record), document_id, tenant_id))
        _upsert_training_data_example(conn, record, raw_text, tenant_id, "recruiter_note")
        _record_activity_event(
            conn,
            tenant_id,
            document_id,
            user_id,
            "note.deleted",
            "Note deleted",
            None,
            {"note_id": note_id},
        )
        conn.commit()
    if reindex_search:
        upsert_candidate_search_chunks(record, raw_text, tenant_id)
    return record


def reindex_candidate_search_db(document_id: str, tenant_id: str) -> None:
    """Refresh derived semantic chunks without blocking the recruiter note write path."""

    record = load_candidate_db(document_id, tenant_id)
    raw_text = load_raw_text_db(document_id, tenant_id)
    upsert_candidate_search_chunks(record, raw_text, tenant_id)


def update_candidate_profile_db(document_id: str, user_id: str, updates: dict[str, Any], tenant_id: str | None = None) -> dict[str, Any]:
    tenant_id = tenant_id or _default_tenant_id()
    record = load_candidate_db(document_id, tenant_id)
    with db() as conn:
        raw_row = conn.execute("select raw_text from candidates where document_id=%s and tenant_id=%s", (document_id, tenant_id)).fetchone()
    raw_text = raw_row["raw_text"] if raw_row else None
    applied = _apply_candidate_profile_updates(record, updates)
    if any(field in applied for field in ("experience", "education")):
        _refresh_timeline_derivations(record, updates)
    enrich_record_pii(record, raw_text)
    enrich_profile_verification(record)
    enrich_record_locations(record, raw_text)
    normalize_domain_years(record, raw_text)
    enrich_fact_verification(record, raw_text)
    record["primary_key_coverage"] = primary_key_coverage(record)
    contact = record.get("contact") or {}
    with db() as conn:
        conn.execute(
            """
            update candidates
            set name=%s,
                email=%s,
                phone=%s,
                record_json=%s,
                updated_at=now()
            where document_id=%s and tenant_id=%s and deleted_at is null
            """,
            (record.get("name"), contact.get("email"), contact.get("phone"), Jsonb(record), document_id, tenant_id),
        )
        _replace_normalized_candidate_tables(conn, record, tenant_id)
        _upsert_training_data_example(conn, record, raw_text, tenant_id, "manual_profile_correction")
        _record_activity_event(
            conn,
            tenant_id,
            document_id,
            user_id,
            "candidate.profile_corrected",
            "Candidate fields corrected",
            ", ".join(applied)[:500],
            {"fields": applied},
        )
        conn.commit()
    upsert_candidate_search_chunks(record, raw_text, tenant_id)
    return record


def _apply_candidate_profile_updates(record: dict[str, Any], updates: dict[str, Any]) -> list[str]:
    applied: list[str] = []
    contact = record.setdefault("contact", {})
    derived = record.setdefault("derived", {})
    hr_profile = derived.setdefault("hr_profile", {})
    simple_fields = {
        "name": ("record", "name"),
        "summary": ("record", "summary"),
        "email": ("contact", "email"),
        "phone": ("contact", "phone"),
        "location": ("contact", "location"),
        "current_title": ("hr_profile", "current_title"),
        "current_company": ("hr_profile", "current_company"),
    }
    for field, (target, key) in simple_fields.items():
        if field not in updates:
            continue
        value = _clean_manual_text(updates.get(field))
        if target == "record":
            record[key] = value
        elif target == "contact":
            contact[key] = value
        else:
            hr_profile[key] = value
        applied.append(field)
    if "total_years_experience" in updates:
        years = _manual_number(updates.get("total_years_experience"))
        hr_profile["total_years_experience"] = years
        applied.append("total_years_experience")
    for field, target in (("skills", "skills"), ("countries", "countries_associated")):
        if field not in updates:
            continue
        values = _manual_list(updates.get(field))
        if target == "skills":
            record["skills"] = values
        else:
            derived[target] = values
        applied.append(field)
    if "experience" in updates:
        record["experience"] = _manual_experience_list(updates.get("experience"))
        applied.append("experience")
    if "education" in updates:
        record["education"] = _manual_education_list(updates.get("education"))
        applied.append("education")
    if "certifications" in updates:
        record["certifications"] = _manual_list(updates.get("certifications"))
        applied.append("certifications")
    if applied:
        record.setdefault("manual_corrections", []).append({"fields": applied})
    return applied


def _refresh_timeline_derivations(record: dict[str, Any], updates: dict[str, Any]) -> None:
    timeline_profile = build_timeline_profile(record)
    derived = record.setdefault("derived", {})
    hr_profile = derived.setdefault("hr_profile", {})
    derived["timeline"] = timeline_profile
    hr_profile["total_years_experience"] = timeline_profile["experience_accounting"]["total_years_unique"]
    hr_profile["total_months_experience"] = timeline_profile["experience_accounting"]["total_months_unique"]
    if "current_title" not in updates:
        current_role = _manual_current_experience(record)
        if current_role and _clean_manual_text(current_role.get("title")):
            hr_profile["current_title"] = _clean_manual_text(current_role.get("title"))
    if "current_company" not in updates:
        current_role = _manual_current_experience(record)
        if current_role and _clean_manual_text(current_role.get("company")):
            hr_profile["current_company"] = _clean_manual_text(current_role.get("company"))


def _manual_current_experience(record: dict[str, Any]) -> dict[str, Any] | None:
    experiences = [item for item in record.get("experience") or [] if isinstance(item, dict)]
    current = [
        item
        for item in experiences
        if str(item.get("end_date") or "").strip().lower() in {"", "present", "current", "now"}
    ]
    return (current or experiences)[0] if experiences else None


def _manual_experience_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    rows: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        row = {
            "company": _clean_manual_text(item.get("company")),
            "title": _clean_manual_text(item.get("title")),
            "location": _clean_manual_text(item.get("location")),
            "start_date": _clean_manual_text(item.get("start_date")),
            "end_date": _clean_manual_text(item.get("end_date")),
            "bullets": _manual_text_lines(item.get("bullets")),
            "technologies": _manual_list(item.get("technologies")),
            "workstreams": _manual_workstream_list(item.get("workstreams")),
        }
        if any(row.get(field) for field in ("company", "title", "location", "start_date", "end_date")) or row["bullets"]:
            rows.append(row)
    return rows


def _manual_education_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    rows: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        row = {
            "school": _clean_manual_text(item.get("school")),
            "degree": _clean_manual_text(item.get("degree")),
            "field": _clean_manual_text(item.get("field")),
            "location": _clean_manual_text(item.get("location")),
            "start_date": _clean_manual_text(item.get("start_date")),
            "end_date": _clean_manual_text(item.get("end_date")),
            "details": _manual_text_lines(item.get("details")),
        }
        if any(row.get(field) for field in ("school", "degree", "field", "location", "start_date", "end_date")) or row["details"]:
            rows.append(row)
    return rows


def _manual_workstream_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    rows: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        row = {
            "name": _clean_manual_text(item.get("name")),
            "role": _clean_manual_text(item.get("role")),
            "location": _clean_manual_text(item.get("location")),
            "start_date": _clean_manual_text(item.get("start_date")),
            "end_date": _clean_manual_text(item.get("end_date")),
            "bullets": _manual_text_lines(item.get("bullets")),
            "technologies": _manual_list(item.get("technologies")),
            "evidence_note": _clean_manual_text(item.get("evidence_note")),
        }
        if any(row.get(field) for field in ("name", "role", "location", "start_date", "end_date", "evidence_note")) or row["bullets"]:
            rows.append(row)
    return rows


def _clean_manual_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _manual_list(value: Any) -> list[str]:
    if isinstance(value, list):
        raw = value
    else:
        raw = re.split(r"[\n,;]+", str(value or ""))
    return [str(item).strip() for item in raw if str(item).strip()]


def _manual_text_lines(value: Any) -> list[str]:
    if isinstance(value, list):
        raw = value
    else:
        raw = str(value or "").splitlines()
    return [str(item).strip() for item in raw if str(item).strip()]


def _manual_number(value: Any) -> float | int | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return int(number) if number.is_integer() else number


def _clean_review_signal(value: Any) -> str:
    signal = re.sub(r"[^a-z0-9_.:-]+", "_", str(value or "").strip().lower()).strip("_")
    if not signal:
        raise ValueError("review signal is required")
    return signal[:120]


def soft_delete_candidate_db(document_id: str, tenant_id: str, user_id: str, reason: str = "removed_by_recruiter") -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            update candidates
            set deleted_at=now(), deleted_by_user_id=%s, deletion_reason=%s, updated_at=now()
            where document_id=%s and tenant_id=%s and deleted_at is null
            returning document_id, name, original_filename, source_file
            """,
            (user_id, reason[:500], document_id, tenant_id),
        ).fetchone()
        if not row:
            raise FileNotFoundError(document_id)
        conn.execute("delete from candidate_search_chunks where tenant_id=%s and document_id=%s", (tenant_id, document_id))
        _record_activity_event(
            conn,
            tenant_id,
            document_id,
            user_id,
            "candidate.deleted",
            "Candidate removed from active database",
            reason,
            {"original_filename": row.get("original_filename") or Path(row.get("source_file") or "").name},
        )
        conn.commit()
    return {"document_id": row["document_id"], "name": row["name"], "deleted": True, "reason": reason}


def candidate_document_metadata(document_id: str, tenant_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            select candidate_documents.*
            from candidate_documents
            join candidates on candidates.document_id = candidate_documents.document_id
              and candidates.tenant_id = candidate_documents.tenant_id
            where candidate_documents.document_id=%s and candidate_documents.tenant_id=%s
              and candidates.deleted_at is null
            order by candidate_documents.created_at desc
            limit 1
            """,
            (document_id, tenant_id),
        ).fetchone()
    if not row:
        record = load_candidate_db(document_id, tenant_id)
        return {
            "storage_backend": record.get("storage_backend") or "local",
            "storage_key": record.get("storage_key"),
            "original_filename": record.get("original_filename") or (record.get("source_file") or "").split("/")[-1],
            "mime_type": record.get("mime_type"),
            "source_file": record.get("source_file"),
        }
    return {
        "id": str(row["id"]),
        "storage_backend": row["storage_backend"],
        "storage_key": row["storage_key"],
        "original_filename": row["original_filename"],
        "mime_type": row["mime_type"],
        "size_bytes": int(row["size_bytes"] or 0),
        "sha256": row["sha256"],
        "extraction_method": row["extraction_method"],
        "page_count": row["page_count"],
    }


def load_raw_text_db(document_id: str, tenant_id: str) -> str:
    with db() as conn:
        row = conn.execute("select raw_text from candidates where document_id=%s and tenant_id=%s and deleted_at is null", (document_id, tenant_id)).fetchone()
    if not row:
        raise FileNotFoundError(document_id)
    return row["raw_text"] or ""


def list_document_pages_db(document_id: str, tenant_id: str) -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            """
            select document_pages.page_number, document_pages.extraction_method, document_pages.raw_text,
                   document_pages.quality_flags, document_pages.created_at
            from document_pages
            join candidates on candidates.document_id = document_pages.document_id
              and candidates.tenant_id = document_pages.tenant_id
            where document_pages.document_id=%s and document_pages.tenant_id=%s
              and candidates.deleted_at is null
            order by document_pages.page_number
            """,
            (document_id, tenant_id),
        ).fetchall()
    return [
        {
            "page_number": int(row["page_number"]),
            "extraction_method": row["extraction_method"],
            "raw_text": row["raw_text"],
            "quality_flags": row["quality_flags"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        }
        for row in rows
    ]


def rebuild_normalized_candidate_analytics(tenant_id: str | None = None) -> int:
    with db() as conn:
        rows = conn.execute(
            """
            select tenant_id, record_json
            from candidates
            where (%s::uuid is null or tenant_id=%s)
              and deleted_at is null
            """,
            (tenant_id, tenant_id),
        ).fetchall()
        for row in rows:
            record = row.get("record_json")
            if row.get("tenant_id") and isinstance(record, dict):
                _replace_normalized_candidate_tables(conn, record, str(row["tenant_id"]))
        conn.commit()
    return len(rows)


def _default_tenant_id() -> str:
    with db() as conn:
        row = conn.execute("select id from tenants where slug='local-dev'").fetchone()
        if row:
            return str(row["id"])
        row = conn.execute(
            """
            insert into tenants (name, slug, status, plan, seat_limit)
            values ('Local Development Tenant', 'local-dev', 'active', 'manual', 25)
            on conflict (slug) do update set updated_at=now()
            returning id
            """
        ).fetchone()
        conn.commit()
    return str(row["id"])


def _ensure_tenant_document_id(record: dict[str, Any], tenant_id: str) -> None:
    document_id = record["document_id"]
    with db() as conn:
        row = conn.execute("select tenant_id from candidates where document_id=%s", (document_id,)).fetchone()
    if row and str(row["tenant_id"]) != str(tenant_id):
        record["document_id"] = f"{document_id}-{str(tenant_id)[:8]}"


def _upsert_candidate_document(conn: Any, record: dict[str, Any], tenant_id: str, user_id: str | None) -> Any | None:
    storage_backend = record.get("storage_backend")
    storage_key = record.get("storage_key")
    sha256 = record.get("source_sha256")
    original_filename = record.get("original_filename") or Path(record.get("source_file") or "resume").name
    if not storage_backend or not storage_key or not sha256:
        return None
    return conn.execute(
        """
        insert into candidate_documents (
          tenant_id, document_id, storage_backend, storage_key, original_filename, mime_type,
          size_bytes, sha256, uploaded_by_user_id, extraction_method, page_count
        )
        values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        on conflict (tenant_id, storage_backend, storage_key) do update set
          document_id=excluded.document_id,
          original_filename=excluded.original_filename,
          mime_type=excluded.mime_type,
          size_bytes=excluded.size_bytes,
          sha256=excluded.sha256,
          extraction_method=excluded.extraction_method,
          page_count=excluded.page_count
        returning id
        """,
        (
            tenant_id,
            record["document_id"],
            storage_backend,
            storage_key,
            original_filename,
            record.get("mime_type"),
            record.get("size_bytes"),
            sha256,
            user_id,
            (record.get("_metadata") or {}).get("extraction_method"),
            (record.get("_metadata") or {}).get("page_count"),
        ),
    ).fetchone()


def _replace_document_pages(conn: Any, record: dict[str, Any], tenant_id: str, candidate_document_id: str) -> None:
    pages = (record.get("_metadata") or {}).get("pages") or []
    conn.execute("delete from document_pages where candidate_document_id=%s", (candidate_document_id,))
    for index, page in enumerate(pages):
        if not isinstance(page, dict):
            continue
        conn.execute(
            """
            insert into document_pages (
              tenant_id, document_id, candidate_document_id, page_number, extraction_method, raw_text, quality_flags
            )
            values (%s, %s, %s, %s, %s, %s, %s)
            on conflict (candidate_document_id, page_number) do update set
              raw_text=excluded.raw_text,
              extraction_method=excluded.extraction_method,
              quality_flags=excluded.quality_flags
            """,
            (
                tenant_id,
                record["document_id"],
                candidate_document_id,
                int(page.get("page_number") or index + 1),
                page.get("method") or (record.get("_metadata") or {}).get("extraction_method") or "unknown",
                page.get("text") or "",
                Jsonb(page.get("quality_flags") or []),
            ),
        )


def _replace_llm_usage_events(conn: Any, record: dict[str, Any], tenant_id: str) -> None:
    usage = record.get("llm_usage") or []
    conn.execute("delete from llm_usage_events where tenant_id=%s and document_id=%s", (tenant_id, record["document_id"]))
    for item in usage:
        if not isinstance(item, dict):
            continue
        input_tokens = int(item.get("input_tokens") or 0)
        output_tokens = int(item.get("output_tokens") or 0)
        conn.execute(
            """
            insert into llm_usage_events (
              tenant_id, document_id, pass_name, provider, model, input_tokens, output_tokens, total_tokens, estimated_cost, status
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                tenant_id,
                record["document_id"],
                item.get("pass") or item.get("pass_name") or "unknown",
                item.get("provider") or "litellm",
                item.get("model") or "unknown",
                input_tokens,
                output_tokens,
                input_tokens + output_tokens,
                _estimate_cost(item.get("model") or "unknown", input_tokens, output_tokens),
                "succeeded" if not item.get("error") else "failed",
            ),
        )


def llm_usage_cost_for_document(document_id: str, tenant_id: str) -> float:
    with db() as conn:
        row = conn.execute(
            """
            select coalesce(sum(estimated_cost), 0) as estimated_cost
            from llm_usage_events
            where tenant_id=%s and document_id=%s
            """,
            (tenant_id, document_id),
        ).fetchone()
    return round(float(row["estimated_cost"] or 0), 6)


def _replace_normalized_candidate_tables(conn: Any, record: dict[str, Any], tenant_id: str) -> None:
    document_id = record["document_id"]
    for table in (
        "candidate_skills",
        "candidate_experience",
        "candidate_education",
        "candidate_certifications",
        "candidate_domain_years",
        "candidate_locations",
    ):
        conn.execute(f"delete from {table} where tenant_id=%s and document_id=%s", (tenant_id, document_id))

    for skill in _dedupe_text(record.get("skills") or []):
        conn.execute(
            """
            insert into candidate_skills (tenant_id, document_id, skill, category, source)
            values (%s, %s, %s, %s, 'parsed')
            on conflict (tenant_id, document_id, skill) do nothing
            """,
            (tenant_id, document_id, skill, _skill_category(record, skill)),
        )

    for index, item in enumerate(record.get("experience") or []):
        if not isinstance(item, dict):
            continue
        conn.execute(
            """
            insert into candidate_experience (
              tenant_id, document_id, company, title, location, start_date, end_date,
              duration_years, bullets, workstreams, sort_index
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                tenant_id,
                document_id,
                item.get("company"),
                item.get("title"),
                item.get("location"),
                item.get("start_date"),
                item.get("end_date"),
                _safe_float(item.get("duration_years")),
                Jsonb(item.get("bullets") or []),
                Jsonb(item.get("workstreams") or []),
                index,
            ),
        )

    for index, item in enumerate(record.get("education") or []):
        if not isinstance(item, dict):
            continue
        conn.execute(
            """
            insert into candidate_education (tenant_id, document_id, school, degree, field, sort_index)
            values (%s, %s, %s, %s, %s, %s)
            """,
            (tenant_id, document_id, item.get("school"), item.get("degree"), item.get("field"), index),
        )

    for certification in _dedupe_text(record.get("certifications") or []):
        conn.execute(
            """
            insert into candidate_certifications (tenant_id, document_id, certification)
            values (%s, %s, %s)
            on conflict (tenant_id, document_id, certification) do nothing
            """,
            (tenant_id, document_id, certification),
        )

    for domain, value in (record.get("derived", {}).get("experience_by_domain") or {}).items():
        conn.execute(
            """
            insert into candidate_domain_years (tenant_id, document_id, domain, years, evidence)
            values (%s, %s, %s, %s, %s)
            on conflict (tenant_id, document_id, domain) do update set
              years=excluded.years,
              evidence=excluded.evidence
            """,
            (tenant_id, document_id, domain, _domain_year_value(value), Jsonb(value if isinstance(value, dict) else {})),
        )

    location_intel = record.get("derived", {}).get("location_intelligence") or {}
    for signal in location_intel.get("location_signals") or []:
        if not isinstance(signal, dict):
            continue
        location = signal.get("value") or signal.get("location") or signal.get("text") or signal.get("raw")
        if not location:
            continue
        conn.execute(
            """
            insert into candidate_locations (tenant_id, document_id, location, country, signal_type, source)
            values (%s, %s, %s, %s, %s, %s)
            """,
            (
                tenant_id,
                document_id,
                str(location)[:500],
                signal.get("country"),
                signal.get("context") or signal.get("type") or signal.get("signal_type") or "location",
                signal.get("evidence") or signal.get("source"),
            ),
        )
    for country_item in record.get("derived", {}).get("countries_associated", []) or []:
        country = country_item.get("country") if isinstance(country_item, dict) else str(country_item)
        if not country:
            continue
        conn.execute(
            """
            insert into candidate_locations (tenant_id, document_id, location, country, signal_type, source)
            values (%s, %s, %s, %s, 'country', 'derived')
            """,
            (tenant_id, document_id, country, country),
        )


def _dedupe_text(values: list[Any]) -> list[str]:
    cleaned = []
    seen = set()
    for value in values:
        text = str(value or "").strip()
        key = text.lower()
        if not text or key in seen:
            continue
        seen.add(key)
        cleaned.append(text[:500])
    return cleaned


def _skill_category(record: dict[str, Any], skill: str) -> str | None:
    taxonomy = ((record.get("candidate_intelligence") or {}).get("hr_intelligence") or {}).get("skill_taxonomy") or {}
    skill_key = skill.lower()
    for category, values in taxonomy.items():
        if isinstance(values, list) and any(str(value).lower() == skill_key for value in values):
            return str(category)
    return None


def _safe_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    with db() as conn:
        normalized = model.removeprefix("openai/")
        row = conn.execute(
            """
            select input_per_million, output_per_million
            from model_prices
            where model in (%s, %s, %s)
            order by case when model=%s then 0 when model=%s then 1 else 2 end
            limit 1
            """,
            (model, normalized, f"openai/{normalized}", model, normalized),
        ).fetchone()
    if not row:
        return 0.0
    return round((input_tokens / 1_000_000) * float(row["input_per_million"]) + (output_tokens / 1_000_000) * float(row["output_per_million"]), 6)


def _domain_year_value(value: Any) -> float:
    if isinstance(value, dict):
        for key in ("years", "duration_years", "total_years", "estimated_years"):
            if key in value:
                try:
                    return float(value[key] or 0)
                except (TypeError, ValueError):
                    return 0.0
        return 0.0
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _sync_notes_from_db(record: dict[str, Any], tenant_id: str, document_id: str) -> None:
    with db() as conn:
        rows = conn.execute(
            """
            select id, name, content, created_at, updated_at
            from notes
            where tenant_id=%s and document_id=%s and deleted_at is null
            order by created_at
            """,
            (tenant_id, document_id),
        ).fetchall()
    record["notes"] = [_note_row(row) for row in rows]


def _upsert_training_data_example(conn: Any, record: dict[str, Any], raw_text: str | None, tenant_id: str, source_type: str) -> None:
    conn.execute(
        """
        insert into training_data_examples (tenant_id, document_id, source_type, input_text, expected_output, metadata, updated_at)
        values (%s, %s, %s, %s, %s, %s, now())
        """,
        (
            tenant_id,
            record["document_id"],
            source_type,
            (raw_text or "")[:200000],
            Jsonb(record),
            Jsonb(
                {
                    "source_file": record.get("original_filename") or record.get("source_file"),
                    "coverage": (record.get("primary_key_coverage") or {}).get("score"),
                    "llm_usage_totals": record.get("llm_usage_totals") or {},
                }
            ),
        ),
    )


def _record_activity_event(
    conn: Any,
    tenant_id: str,
    document_id: str,
    user_id: str | None,
    event_type: str,
    title: str,
    body: str | None,
    metadata: dict[str, Any] | None = None,
) -> None:
    conn.execute(
        """
        insert into candidate_activity_events (tenant_id, document_id, user_id, event_type, title, body, metadata)
        values (%s, %s, %s, %s, %s, %s, %s)
        """,
        (tenant_id, document_id, user_id, event_type, title[:300], body, Jsonb(metadata or {})),
    )


def _note_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "content": row["content"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


def _candidate_review_signal_row(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "tenant_id": str(row["tenant_id"]),
        "document_id": row["document_id"],
        "signal_key": row["signal_key"],
        "status": row["status"],
        "reviewed_by_user_id": str(row["reviewed_by_user_id"]) if row.get("reviewed_by_user_id") else None,
        "reviewed_at": row["reviewed_at"].isoformat() if row.get("reviewed_at") else None,
        "note": row.get("note"),
        "metadata": row.get("metadata") or {},
    }
