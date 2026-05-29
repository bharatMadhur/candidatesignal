from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any

from psycopg.types.json import Jsonb

from .db import db


def find_matches_for_record(record: dict[str, Any], limit: int = 10, tenant_id: str | None = None) -> list[dict[str, Any]]:
    tenant_id = tenant_id or record.get("tenant_id")
    signals = _version_prefilter_signals(record)
    if not signals["has_candidate_signal"]:
        return []

    candidate_limit = max(limit * 50, 250)
    with db() as conn:
        rows = conn.execute(
            """
            with candidate_pool as (
              select candidates.document_id
              from candidates
              where candidates.document_id <> %(document_id)s
                and (%(tenant_id)s::uuid is null or candidates.tenant_id=%(tenant_id)s)
                and candidates.deleted_at is null
                and (
                  (%(email)s <> '' and lower(candidates.email)=%(email)s)
                  or (%(phone)s <> '' and right(regexp_replace(candidates.phone, '\\D', '', 'g'), 10)=%(phone)s)
                  or (%(name)s <> '' and lower(candidates.name)=%(name)s)
                  or (%(name_prefix)s <> '' and lower(candidates.name) like %(name_prefix)s)
                )
              union
              select candidate_experience.document_id
              from candidate_experience
              where (%(tenant_id)s::uuid is null or candidate_experience.tenant_id=%(tenant_id)s)
                and (%(company_names)s::text[] <> '{}'::text[])
                and lower(candidate_experience.company) = any(%(company_names)s::text[])
            )
            select candidates.document_id, candidates.name, candidates.email, candidates.phone, candidates.record_json
            from candidates
            join candidate_pool on candidate_pool.document_id=candidates.document_id
            where candidates.document_id <> %(document_id)s
              and (%(tenant_id)s::uuid is null or candidates.tenant_id=%(tenant_id)s)
              and candidates.deleted_at is null
            order by
              case
                when %(email)s <> '' and lower(candidates.email)=%(email)s then 0
                when %(phone)s <> '' and right(regexp_replace(candidates.phone, '\\D', '', 'g'), 10)=%(phone)s then 1
                when %(name)s <> '' and lower(candidates.name)=%(name)s then 2
                else 3
              end,
              candidates.updated_at desc
            limit %(candidate_limit)s
            """,
            {
                "document_id": record["document_id"],
                "tenant_id": tenant_id,
                "email": signals["email"],
                "phone": signals["phone"],
                "name": signals["name"],
                "name_prefix": signals["name_prefix"],
                "company_names": signals["company_names"],
                "candidate_limit": candidate_limit,
            },
        ).fetchall()
    matches = []
    for row in rows:
        score, reasons = match_score(record, row["record_json"])
        if score >= 0.35:
            matches.append(
                {
                    "document_id": row["document_id"],
                    "name": row["name"],
                    "email": row["email"],
                    "phone": row["phone"],
                    "score": round(score, 3),
                    "reasons": reasons,
                }
            )
    matches.sort(key=lambda item: item["score"], reverse=True)
    return matches[:limit]


def _version_prefilter_signals(record: dict[str, Any]) -> dict[str, Any]:
    contact = record.get("contact") or {}
    name = _normalize_name(record.get("name"))
    name_parts = [part for part in name.split() if part]
    name_prefix = f"{name_parts[0]}%" if name_parts else ""
    companies = sorted(_companies(record))
    email = str(contact.get("email") or record.get("email") or "").strip().lower()
    phone = _normalize_phone(record.get("phone") or contact.get("phone"))
    company_names = [company for company in companies if company][:12]
    return {
        "email": email,
        "phone": phone,
        "name": name,
        "name_prefix": name_prefix,
        "company_names": company_names,
        "has_candidate_signal": bool(email or phone or name),
    }


def persist_matches(record: dict[str, Any], matches: list[dict[str, Any]], tenant_id: str | None = None) -> None:
    tenant_id = tenant_id or record.get("tenant_id")
    with db() as conn:
        for match in matches:
            left, right = sorted([record["document_id"], match["document_id"]])
            conn.execute(
                """
                insert into candidate_version_matches (tenant_id, left_document_id, right_document_id, score, reasons)
                values (%s, %s, %s, %s, %s)
                on conflict (left_document_id, right_document_id) do update set
                  tenant_id = excluded.tenant_id,
                  score = excluded.score,
                  reasons = excluded.reasons,
                  created_at = now()
                """,
                (tenant_id, left, right, match["score"], Jsonb(match["reasons"])),
            )
        conn.commit()


def list_clusters(tenant_id: str | None = None) -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            """
            select erm.id, erm.left_document_id, erm.right_document_id, erm.score, erm.reasons, erm.status,
                   left_c.name as left_name, right_c.name as right_name,
                   left_c.record_json as left_record_json, right_c.record_json as right_record_json,
                   left_c.created_at as left_created_at, left_c.updated_at as left_updated_at,
                   right_c.created_at as right_created_at, right_c.updated_at as right_updated_at
            from candidate_version_matches erm
            join candidates left_c on left_c.document_id=erm.left_document_id
            join candidates right_c on right_c.document_id=erm.right_document_id
            where (%s::uuid is null or erm.tenant_id=%s)
              and left_c.deleted_at is null
              and right_c.deleted_at is null
            order by erm.score desc, erm.created_at desc
            """,
            (tenant_id, tenant_id),
        ).fetchall()
        return [_cluster_match_from_row(conn, row, tenant_id) for row in rows]


def list_matches_for_candidate(document_id: str, tenant_id: str | None = None) -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            """
            select erm.id, erm.left_document_id, erm.right_document_id, erm.score, erm.reasons, erm.status,
                   left_c.name as left_name, right_c.name as right_name,
                   left_c.record_json as left_record_json, right_c.record_json as right_record_json,
                   left_c.created_at as left_created_at, left_c.updated_at as left_updated_at,
                   right_c.created_at as right_created_at, right_c.updated_at as right_updated_at
            from candidate_version_matches erm
            join candidates left_c on left_c.document_id=erm.left_document_id
            join candidates right_c on right_c.document_id=erm.right_document_id
            where (%s::uuid is null or erm.tenant_id=%s)
              and (erm.left_document_id=%s or erm.right_document_id=%s)
              and left_c.deleted_at is null
              and right_c.deleted_at is null
            order by
              case
                when erm.status in ('versioned', 'same_person') then 0
                when erm.status in ('suggested', 'review_later') then 1
                else 2
              end,
              erm.score desc,
              erm.created_at desc
            """,
            (tenant_id, tenant_id, document_id, document_id),
        ).fetchall()
        return [_cluster_match_from_row(conn, row, tenant_id) for row in rows]


def canonical_candidate_map(tenant_id: str | None = None, *, include_self: bool = False) -> dict[str, str]:
    """Map confirmed resume-version uploads to the latest visible candidate id.

    Versioning is non-destructive: every upload remains accessible by URL and in
    the version panel. Normal recruiter views should not show confirmed copies as
    separate people, so this map collapses a versioned component to its latest
    updated candidate record.
    """
    with db() as conn:
        candidate_rows = conn.execute(
            """
            select document_id, created_at, updated_at
            from candidates
            where (%s::uuid is null or tenant_id=%s) and deleted_at is null
            """,
            (tenant_id, tenant_id),
        ).fetchall()
        match_rows = conn.execute(
            """
            select left_document_id, right_document_id
            from candidate_version_matches
            where (%s::uuid is null or tenant_id=%s)
              and status in ('versioned', 'same_person')
            """,
            (tenant_id, tenant_id),
        ).fetchall()
    timestamps = {
        str(row["document_id"]): (row["updated_at"], row["created_at"])
        for row in candidate_rows
    }
    parent = {document_id: document_id for document_id in timestamps}

    def find(document_id: str) -> str:
        while parent[document_id] != document_id:
            parent[document_id] = parent[parent[document_id]]
            document_id = parent[document_id]
        return document_id

    def union(left: str, right: str) -> None:
        if left not in parent or right not in parent:
            return
        left_root = find(left)
        right_root = find(right)
        if left_root != right_root:
            parent[right_root] = left_root

    for row in match_rows:
        union(str(row["left_document_id"]), str(row["right_document_id"]))

    groups: dict[str, list[str]] = {}
    for document_id in parent:
        groups.setdefault(find(document_id), []).append(document_id)

    canonical: dict[str, str] = {}
    for members in groups.values():
        if len(members) <= 1:
            if include_self:
                canonical[members[0]] = members[0]
            continue
        visible = max(
            members,
            key=lambda document_id: (
                timestamps[document_id][0] or timestamps[document_id][1],
                document_id,
            ),
        )
        for document_id in members:
            if include_self or document_id != visible:
                canonical[document_id] = visible
    return canonical


def hidden_version_document_ids(tenant_id: str | None = None) -> set[str]:
    mapping = canonical_candidate_map(tenant_id)
    return {document_id for document_id, canonical_id in mapping.items() if document_id != canonical_id}


def _cluster_match_from_row(conn: Any, row: dict[str, Any], tenant_id: str | None = None) -> dict[str, Any]:
    match_id = str(row["id"])
    left_profile = _cluster_profile(row["left_record_json"])
    right_profile = _cluster_profile(row["right_record_json"])
    return {
        "id": match_id,
        "left_document_id": row["left_document_id"],
        "right_document_id": row["right_document_id"],
        "left_name": row["left_name"],
        "right_name": row["right_name"],
        "score": float(row["score"]),
        "reasons": row["reasons"],
        "status": _version_status(row["status"]),
        "left_profile": left_profile,
        "right_profile": right_profile,
        "left_version": _candidate_version_metadata(
            conn,
            row["left_document_id"],
            tenant_id,
            row["left_created_at"],
            row["left_updated_at"],
        ),
        "right_version": _candidate_version_metadata(
            conn,
            row["right_document_id"],
            tenant_id,
            row["right_created_at"],
            row["right_updated_at"],
        ),
        "field_diffs": build_version_diffs(left_profile, right_profile),
        "audit_events": _audit_events(match_id, tenant_id),
    }


def _version_status(status: str | None) -> str:
    return {
        "same_person": "versioned",
        "not_same_person": "separate",
    }.get(status or "suggested", status or "suggested")


def _cluster_profile(record: dict[str, Any] | None) -> dict[str, Any]:
    record = record or {}
    contact = record.get("contact") or {}
    derived = record.get("derived") or {}
    hr_profile = derived.get("hr_profile") or {}
    experience = record.get("experience") or []
    education = record.get("education") or []
    countries = derived.get("countries_associated") or []
    normalized_countries = [item.get("country") if isinstance(item, dict) else item for item in countries]
    return {
        "name": record.get("name"),
        "email": contact.get("email"),
        "phone": contact.get("phone"),
        "location": contact.get("location"),
        "current_title": hr_profile.get("current_title") or _first_present([item.get("title") for item in experience if isinstance(item, dict)]),
        "current_company": hr_profile.get("current_company") or _first_present([item.get("company") for item in experience if isinstance(item, dict)]),
        "companies": sorted({item.get("company") for item in experience if isinstance(item, dict) and item.get("company")})[:8],
        "education": [
            " | ".join(str(part) for part in [item.get("degree"), item.get("field"), item.get("school")] if part)
            for item in education[:4]
            if isinstance(item, dict)
        ],
        "skills": (record.get("skills") or [])[:12],
        "countries": [item for item in normalized_countries if item][:8],
    }


def _candidate_version_metadata(
    conn: Any,
    document_id: str,
    tenant_id: str | None,
    candidate_created_at: Any,
    candidate_updated_at: Any,
) -> dict[str, Any]:
    documents = conn.execute(
        """
        select cd.id, cd.storage_backend, cd.storage_key, cd.original_filename, cd.mime_type,
               cd.size_bytes, cd.sha256, cd.extraction_method, cd.page_count, cd.created_at,
               pj.status as parse_status, pj.stage as parse_stage, pj.attempt_count,
               pj.input_tokens, pj.output_tokens, pj.total_tokens, pj.estimated_cost,
               pj.completed_at as parse_completed_at
        from candidate_documents cd
        left join lateral (
          select status, stage, attempt_count, input_tokens, output_tokens, total_tokens,
                 estimated_cost, completed_at
          from parse_jobs pj
          where pj.tenant_id=cd.tenant_id
            and pj.document_id=cd.document_id
            and (
              pj.storage_key=cd.storage_key
              or pj.source_hash=cd.sha256
              or pj.original_filename=cd.original_filename
            )
          order by pj.updated_at desc
          limit 1
        ) pj on true
        where cd.document_id=%s and (%s::uuid is null or cd.tenant_id=%s)
        order by cd.created_at desc
        """,
        (document_id, tenant_id, tenant_id),
    ).fetchall()
    page_methods = conn.execute(
        """
        select extraction_method, count(*) as page_count
        from document_pages
        where document_id=%s and (%s::uuid is null or tenant_id=%s)
        group by extraction_method
        order by page_count desc, extraction_method
        """,
        (document_id, tenant_id, tenant_id),
    ).fetchall()
    normalized_documents = [
        {
            "id": str(row["id"]),
            "storage_backend": row["storage_backend"],
            "storage_key": row["storage_key"],
            "original_filename": row["original_filename"],
            "mime_type": row["mime_type"],
            "size_bytes": row["size_bytes"],
            "sha256": row["sha256"],
            "extraction_method": row["extraction_method"],
            "page_count": row["page_count"],
            "uploaded_at": row["created_at"],
            "parse_status": row["parse_status"],
            "parse_stage": row["parse_stage"],
            "attempt_count": row["attempt_count"],
            "input_tokens": row["input_tokens"],
            "output_tokens": row["output_tokens"],
            "total_tokens": row["total_tokens"],
            "estimated_cost": float(row["estimated_cost"] or 0),
            "parse_completed_at": row["parse_completed_at"],
        }
        for row in documents
    ]
    return {
        "document_id": document_id,
        "candidate_created_at": candidate_created_at,
        "candidate_updated_at": candidate_updated_at,
        "latest_document": normalized_documents[0] if normalized_documents else None,
        "documents": normalized_documents,
        "page_methods": [
            {"extraction_method": row["extraction_method"], "page_count": int(row["page_count"])}
            for row in page_methods
        ],
    }


def build_version_diffs(left_profile: dict[str, Any], right_profile: dict[str, Any]) -> list[dict[str, Any]]:
    fields = [
        ("name", "Name", "scalar"),
        ("email", "Email", "scalar"),
        ("phone", "Phone", "scalar"),
        ("current_title", "Current title", "scalar"),
        ("current_company", "Current company", "scalar"),
        ("location", "Location", "scalar"),
        ("countries", "Countries", "list"),
        ("companies", "Companies", "list"),
        ("education", "Education", "list"),
        ("skills", "Skills", "list"),
    ]
    return [
        _diff_field(key, label, mode, left_profile.get(key), right_profile.get(key))
        for key, label, mode in fields
    ]


def _diff_field(key: str, label: str, mode: str, left_value: Any, right_value: Any) -> dict[str, Any]:
    if mode == "list":
        left_items = _normalized_list(left_value)
        right_items = _normalized_list(right_value)
        left_set = {_normalize_text(item) for item in left_items}
        right_set = {_normalize_text(item) for item in right_items}
        left_only = [item for item in left_items if _normalize_text(item) not in right_set]
        right_only = [item for item in right_items if _normalize_text(item) not in left_set]
        overlap = [item for item in left_items if _normalize_text(item) in right_set]
        status = "same" if left_set == right_set else "missing" if not left_set or not right_set else "different"
        return {
            "key": key,
            "label": label,
            "status": status,
            "left": ", ".join(left_items[:12]),
            "right": ", ".join(right_items[:12]),
            "left_only": left_only[:12],
            "right_only": right_only[:12],
            "overlap": overlap[:12],
            "detail": _diff_detail(status, left_items, right_items, overlap),
        }

    left_text = _string_value(left_value)
    right_text = _string_value(right_value)
    left_norm = _normalize_text(left_text)
    right_norm = _normalize_text(right_text)
    status = "same" if left_norm and left_norm == right_norm else "missing" if not left_norm or not right_norm else "different"
    return {
        "key": key,
        "label": label,
        "status": status,
        "left": left_text,
        "right": right_text,
        "left_only": [left_text] if status == "different" and left_text else [],
        "right_only": [right_text] if status == "different" and right_text else [],
        "overlap": [left_text] if status == "same" and left_text else [],
        "detail": _diff_detail(status, [left_text] if left_text else [], [right_text] if right_text else [], [left_text] if status == "same" and left_text else []),
    }


def _diff_detail(status: str, left_items: list[str], right_items: list[str], overlap: list[str]) -> str:
    if status == "same":
        return "Same on both versions"
    if status == "missing":
        return "Missing from one version"
    if overlap:
        return f"{len(overlap)} shared, {abs(len(left_items) - len(overlap)) + abs(len(right_items) - len(overlap))} different"
    return "Different values"


def _normalized_list(value: Any) -> list[str]:
    if not value:
        return []
    values = value if isinstance(value, list) else [value]
    result = []
    for item in values:
        text = _string_value(item)
        if text and _normalize_text(text) not in {_normalize_text(existing) for existing in result}:
            result.append(text)
    return result


def _string_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _normalize_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9+#. ]", " ", (value or "").lower())).strip()


def _first_present(values: list[Any]) -> Any:
    return next((value for value in values if value), None)


def decide_match(match_id: str, status: str, user_id: str, tenant_id: str | None = None) -> dict[str, Any]:
    legacy_map = {
        "same_person": "versioned",
        "not_same_person": "separate",
    }
    status = legacy_map.get(status, status)
    if status not in {"versioned", "separate", "review_later"}:
        raise ValueError(status)
    with db() as conn:
        row = conn.execute(
            """
            update candidate_version_matches
            set status=%s, decided_by=%s, decided_at=now()
            where id=%s and (%s::uuid is null or tenant_id=%s)
            returning id, left_document_id, right_document_id, score, reasons, status
            """,
            (status, user_id, match_id, tenant_id, tenant_id),
        ).fetchone()
        if row:
            conn.execute(
                """
                insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
                values (%s, %s, %s, %s, %s, %s)
                """,
                (
                    tenant_id,
                    user_id,
                    f"candidate_versions.{status}",
                    "candidate_version_match",
                    match_id,
                    Jsonb(
                        {
                            "left_document_id": row["left_document_id"],
                            "right_document_id": row["right_document_id"],
                            "score": float(row["score"]),
                            "status": status,
                        }
                    ),
                ),
            )
        conn.commit()
    if not row:
        raise FileNotFoundError(match_id)
    return {
        "id": str(row["id"]),
        "left_document_id": row["left_document_id"],
        "right_document_id": row["right_document_id"],
        "score": float(row["score"]),
        "reasons": row["reasons"],
        "status": row["status"],
    }


def merge_match(match_id: str, user_id: str, tenant_id: str | None = None) -> dict[str, Any]:
    raise RuntimeError("candidate merging is disabled; preserve uploads as candidate versions")


def _audit_events(match_id: str, tenant_id: str | None = None) -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            """
            select audit_logs.action, audit_logs.user_id, users.email, audit_logs.metadata, audit_logs.created_at
            from audit_logs
            left join users on users.id=audit_logs.user_id
            where audit_logs.entity_type='candidate_version_match'
              and audit_logs.entity_id=%s
              and (%s::uuid is null or audit_logs.tenant_id=%s)
            order by audit_logs.created_at desc
            limit 10
            """,
            (match_id, tenant_id, tenant_id),
        ).fetchall()
    return [
        {
            "action": row["action"],
            "user_id": str(row["user_id"]) if row.get("user_id") else None,
            "user_email": row.get("email"),
            "metadata": row["metadata"],
            "created_at": row["created_at"].isoformat(),
        }
        for row in rows
    ]


def match_score(left: dict[str, Any], right: dict[str, Any]) -> tuple[float, list[dict[str, Any]]]:
    score = 0.0
    reasons: list[dict[str, Any]] = []

    left_contact = left.get("contact") or {}
    right_contact = right.get("contact") or {}
    if _same_present(left_contact.get("email"), right_contact.get("email")):
        score += 0.55
        reasons.append({"type": "exact_email", "weight": 0.55})
    if _same_present(_normalize_phone(left_contact.get("phone")), _normalize_phone(right_contact.get("phone"))):
        score += 0.45
        reasons.append({"type": "exact_phone", "weight": 0.45})

    name_similarity = _similarity(_normalize_name(left.get("name")), _normalize_name(right.get("name")))
    if name_similarity >= 0.88:
        score += 0.2
        reasons.append({"type": "name_similarity", "weight": 0.2, "value": round(name_similarity, 3)})

    company_overlap = _jaccard(_companies(left), _companies(right))
    if company_overlap:
        score += min(0.2, company_overlap * 0.2)
        reasons.append({"type": "company_overlap", "weight": round(min(0.2, company_overlap * 0.2), 3)})

    education_overlap = _jaccard(_schools(left), _schools(right))
    if education_overlap:
        score += min(0.15, education_overlap * 0.15)
        reasons.append({"type": "education_overlap", "weight": round(min(0.15, education_overlap * 0.15), 3)})

    skill_overlap = _jaccard(_skills(left), _skills(right))
    if skill_overlap >= 0.25:
        score += min(0.15, skill_overlap * 0.15)
        reasons.append({"type": "skill_overlap", "weight": round(min(0.15, skill_overlap * 0.15), 3), "value": round(skill_overlap, 3)})

    country_overlap = _jaccard(_countries(left), _countries(right))
    if country_overlap:
        score += 0.05
        reasons.append({"type": "country_overlap", "weight": 0.05})

    return min(score, 1.0), reasons


def candidate_version_requirements() -> dict[str, Any]:
    return {
        "primary_identifiers": ["email", "phone", "normalized_name"],
        "secondary_identifiers": ["current_company", "previous_companies", "schools", "locations", "countries"],
        "semantic_identifiers": ["skills", "domains", "titles", "certifications", "notes"],
        "required_storage": [
            "raw candidate JSON",
            "normalized contact fields",
            "candidate notes",
            "match score",
            "match reasons",
            "manual candidate-version decisions",
        ],
        "workflow_needed": [
            "show possible duplicate uploads after upload",
            "allow HR to mark uploads as versions of the same candidate",
            "allow HR to keep candidates separate",
            "persist decisions for future matching",
            "never merge or delete candidate records automatically",
        ],
        "recommended_thresholds": {
            "auto_suggest": 0.35,
            "strong_match": 0.75,
            "version_signal": "exact email or exact phone plus name similarity",
        },
    }


def _same_present(left: str | None, right: str | None) -> bool:
    return bool(left and right and left.strip().lower() == right.strip().lower())


def _normalize_phone(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    return digits[-10:] if len(digits) >= 10 else digits


def _normalize_name(value: str | None) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z ]", " ", (value or "").lower())).strip()


def _similarity(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


def _jaccard(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def _companies(record: dict[str, Any]) -> set[str]:
    return {_normalize_name(item.get("company")) for item in record.get("experience", []) if item.get("company")}


def _schools(record: dict[str, Any]) -> set[str]:
    return {_normalize_name(item.get("school")) for item in record.get("education", []) if item.get("school")}


def _skills(record: dict[str, Any]) -> set[str]:
    return {_normalize_name(skill) for skill in record.get("skills", []) if skill}


def _countries(record: dict[str, Any]) -> set[str]:
    return {
        _normalize_name(item.get("country"))
        for item in record.get("derived", {}).get("countries_associated", [])
        if item.get("country")
    }
