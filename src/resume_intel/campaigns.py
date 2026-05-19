from __future__ import annotations

from typing import Any

from psycopg.types.json import Jsonb

from .candidate_facts import factual_current_company, factual_current_title
from .db import db
from .geo import current_job_location
from .requirements import create_requirement_from_text, match_requirement, update_requirement_scorecard
from .settings import load_settings


CAMPAIGN_PIPELINE_STATUSES = {
    "recommended",
    "uploaded",
    "matched",
    "shortlisted",
    "contacted",
    "replied",
    "screened",
    "submitted",
    "interviewing",
    "offer",
    "placed",
    "rejected",
    "archived",
}
LOCKED_MATCH_STATUSES = {"shortlisted", "contacted", "replied", "screened", "submitted", "interviewing", "offer", "placed", "rejected", "archived"}
CAMPAIGN_STATUSES = {"active", "paused", "archived", "closed", "draft"}


def create_campaign(
    tenant_id: str,
    user_id: str,
    name: str,
    description: str = "",
    requirement_id: str | None = None,
) -> dict[str, Any]:
    campaign_name = name.strip()
    if not campaign_name:
        raise ValueError("campaign name is required")
    campaign_description = description.strip()
    requirement = None
    if not requirement_id and campaign_description:
        requirement = create_requirement_from_text(campaign_description, user_id, load_settings(), tenant_id)
        requirement_id = requirement["id"]
    with db() as conn:
        row = conn.execute(
            """
            insert into job_campaigns (tenant_id, created_by_user_id, requirement_id, name, description, status)
            values (%s, %s, %s, %s, %s, 'active')
            returning *
            """,
            (tenant_id, user_id, requirement_id, campaign_name, campaign_description),
        ).fetchone()
        conn.execute(
            """
            insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
            values (%s, %s, 'campaign.created', 'job_campaign', %s, %s)
            """,
            (tenant_id, user_id, str(row["id"]), Jsonb({"requirement_id": requirement_id, "name": campaign_name})),
        )
        conn.commit()
    campaign = get_campaign(str(row["id"]), tenant_id)
    if requirement:
        campaign["requirement"] = requirement
    return campaign


def update_campaign(
    campaign_id: str,
    tenant_id: str,
    user_id: str,
    *,
    name: str | None = None,
    description: str | None = None,
    status: str | None = None,
    requirement_id: str | None = None,
    unlink_requirement: bool = False,
) -> dict[str, Any]:
    existing = get_campaign(campaign_id, tenant_id)
    next_name = (name if name is not None else existing["name"]).strip()
    if not next_name:
        raise ValueError("campaign name is required")
    next_description = description if description is not None else existing.get("description", "")
    next_status = (status or existing.get("status") or "active").strip().lower()
    if next_status not in CAMPAIGN_STATUSES:
        raise ValueError(f"unsupported campaign status: {next_status}")
    next_requirement_id = None if unlink_requirement else (requirement_id if requirement_id is not None else existing.get("requirement_id"))
    if next_requirement_id:
        _requirement_exists(next_requirement_id, tenant_id)

    with db() as conn:
        row = conn.execute(
            """
            update job_campaigns
            set name=%s,
                description=%s,
                status=%s,
                requirement_id=%s,
                updated_at=now()
            where id=%s and tenant_id=%s
            returning id
            """,
            (next_name, next_description or "", next_status, next_requirement_id, campaign_id, tenant_id),
        ).fetchone()
        if not row:
            raise FileNotFoundError(campaign_id)
        conn.execute(
            """
            insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
            values (%s, %s, 'campaign.updated', 'job_campaign', %s, %s)
            """,
            (
                tenant_id,
                user_id,
                campaign_id,
                Jsonb({
                    "name": next_name,
                    "status": next_status,
                    "requirement_id": next_requirement_id,
                    "unlink_requirement": unlink_requirement,
                }),
            ),
        )
        conn.commit()
    return get_campaign(campaign_id, tenant_id)


def attach_campaign_requirement(
    campaign_id: str,
    tenant_id: str,
    user_id: str,
    requirement: dict[str, Any],
) -> dict[str, Any]:
    requirement_id = requirement.get("id")
    if not requirement_id:
        raise ValueError("requirement id is required")
    _requirement_exists(requirement_id, tenant_id)
    with db() as conn:
        row = conn.execute(
            """
            update job_campaigns
            set requirement_id=%s, updated_at=now()
            where id=%s and tenant_id=%s
            returning id
            """,
            (requirement_id, campaign_id, tenant_id),
        ).fetchone()
        if not row:
            raise FileNotFoundError(campaign_id)
        conn.execute(
            """
            insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
            values (%s, %s, 'campaign.requirement_attached', 'job_campaign', %s, %s)
            """,
            (tenant_id, user_id, campaign_id, Jsonb({"requirement_id": requirement_id, "source_type": requirement.get("source_type")})),
        )
        conn.commit()
    campaign = get_campaign(campaign_id, tenant_id)
    campaign["requirement"] = requirement
    return campaign


def create_campaign_requirement_from_text(
    campaign_id: str,
    tenant_id: str,
    user_id: str,
    text: str,
) -> dict[str, Any]:
    get_campaign(campaign_id, tenant_id)
    if not text.strip():
        raise ValueError("requirement text is required")
    requirement = create_requirement_from_text(text, user_id, load_settings(), tenant_id)
    return attach_campaign_requirement(campaign_id, tenant_id, user_id, requirement)


def update_campaign_scorecard(
    campaign_id: str,
    tenant_id: str,
    user_id: str,
    fields: dict[str, Any],
) -> dict[str, Any]:
    campaign = get_campaign(campaign_id, tenant_id)
    requirement_id = campaign.get("requirement_id")
    if not requirement_id:
        seed_text = (campaign.get("description") or campaign.get("name") or "Campaign requirement").strip()
        requirement = create_requirement_from_text(seed_text, user_id, load_settings(), tenant_id)
        campaign = attach_campaign_requirement(campaign_id, tenant_id, user_id, requirement)
        requirement_id = campaign["requirement_id"]
    requirement = update_requirement_scorecard(requirement_id, fields, tenant_id)
    with db() as conn:
        conn.execute("update job_campaigns set updated_at=now() where id=%s and tenant_id=%s", (campaign_id, tenant_id))
        conn.execute(
            """
            insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
            values (%s, %s, 'campaign.scorecard_updated', 'job_campaign', %s, %s)
            """,
            (tenant_id, user_id, campaign_id, Jsonb({"requirement_id": requirement_id, "fields": sorted(fields.keys())})),
        )
        conn.commit()
    campaign = get_campaign(campaign_id, tenant_id)
    campaign["requirement"] = requirement
    return campaign


def list_campaigns(tenant_id: str) -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            """
            select job_campaigns.*,
                   requirements.title as requirement_title,
                   requirements.status as requirement_status,
                   requirements.original_text as requirement_original_text,
                   requirements.extracted_json as requirement_extracted_json,
                   requirements.recruiter_answers as requirement_recruiter_answers,
                   requirements.final_profile as requirement_final_profile,
                   count(distinct campaign_candidates.id) as candidate_count,
                   count(distinct parse_batches.id) as upload_batch_count
            from job_campaigns
            left join requirements on requirements.id = job_campaigns.requirement_id
            left join campaign_candidates on campaign_candidates.campaign_id = job_campaigns.id
            left join parse_batches on parse_batches.campaign_id = job_campaigns.id
            where job_campaigns.tenant_id=%s
            group by job_campaigns.id, requirements.id, requirements.title, requirements.status,
                     requirements.original_text, requirements.extracted_json,
                     requirements.recruiter_answers, requirements.final_profile
            order by job_campaigns.updated_at desc
            """,
            (tenant_id,),
        ).fetchall()
    return [_campaign_row(row) for row in rows]


def get_campaign(campaign_id: str, tenant_id: str) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            select job_campaigns.*,
                   requirements.title as requirement_title,
                   requirements.status as requirement_status,
                   requirements.original_text as requirement_original_text,
                   requirements.extracted_json as requirement_extracted_json,
                   requirements.recruiter_answers as requirement_recruiter_answers,
                   requirements.final_profile as requirement_final_profile,
                   count(distinct campaign_candidates.id) as candidate_count,
                   count(distinct parse_batches.id) as upload_batch_count
            from job_campaigns
            left join requirements on requirements.id = job_campaigns.requirement_id
            left join campaign_candidates on campaign_candidates.campaign_id = job_campaigns.id
            left join parse_batches on parse_batches.campaign_id = job_campaigns.id
            where job_campaigns.id=%s and job_campaigns.tenant_id=%s
            group by job_campaigns.id, requirements.id, requirements.title, requirements.status,
                     requirements.original_text, requirements.extracted_json,
                     requirements.recruiter_answers, requirements.final_profile
            """,
            (campaign_id, tenant_id),
        ).fetchone()
        candidate_rows = conn.execute(
            """
            select campaign_candidates.*, candidates.record_json, candidates.updated_at as candidate_updated_at
            from campaign_candidates
            join candidates on candidates.document_id = campaign_candidates.candidate_id
              and candidates.tenant_id = campaign_candidates.tenant_id
             and candidates.deleted_at is null
            where campaign_candidates.campaign_id=%s and campaign_candidates.tenant_id=%s
            order by campaign_candidates.score desc, campaign_candidates.updated_at desc
            """,
            (campaign_id, tenant_id),
        ).fetchall()
        batch_rows = conn.execute(
            """
            select *
            from parse_batches
            where campaign_id=%s and tenant_id=%s
            order by updated_at desc
            limit 10
            """,
            (campaign_id, tenant_id),
        ).fetchall()
    if not row:
        raise FileNotFoundError(campaign_id)
    campaign = _campaign_row(row)
    campaign["candidates"] = [_campaign_candidate_row(item) for item in candidate_rows]
    campaign["upload_batches"] = [
        {
            "id": str(item["id"]),
            "name": item["name"],
            "status": item["status"],
            "total_files": int(item["total_files"] or 0),
            "completed_count": int(item["completed_count"] or 0),
            "failed_count": int(item["failed_count"] or 0),
            "context_note": item.get("context_note"),
            "estimated_cost": float(item.get("estimated_cost") or 0),
            "updated_at": item["updated_at"].isoformat() if item["updated_at"] else None,
        }
        for item in batch_rows
    ]
    return campaign


def run_campaign_match(campaign_id: str, tenant_id: str, user_id: str) -> dict[str, Any]:
    campaign = get_campaign(campaign_id, tenant_id)
    requirement_id = campaign.get("requirement_id")
    if not requirement_id:
        raise ValueError("campaign has no requirement profile")
    matches = match_requirement(requirement_id, tenant_id)
    with db() as conn:
        for match in matches:
            conn.execute(
                """
                insert into campaign_candidates (tenant_id, campaign_id, candidate_id, source, status, score, evidence)
                values (%s, %s, %s, 'matched', 'recommended', %s, %s)
                on conflict (campaign_id, candidate_id) do update set
                  source=case when campaign_candidates.source='uploaded' then campaign_candidates.source else 'matched' end,
                  status=case when campaign_candidates.status = any(%s) then campaign_candidates.status else 'recommended' end,
                  score=excluded.score,
                  evidence=excluded.evidence,
                  updated_at=now()
                """,
                (
                    tenant_id,
                    campaign_id,
                    match["candidate_id"],
                    float(match.get("total_score") or 0),
                    Jsonb(_campaign_match_evidence_payload(match)),
                    list(LOCKED_MATCH_STATUSES),
                ),
            )
        conn.execute("update job_campaigns set updated_at=now() where id=%s and tenant_id=%s", (campaign_id, tenant_id))
        conn.execute(
            """
            insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
            values (%s, %s, 'campaign.matched', 'job_campaign', %s, %s)
            """,
            (tenant_id, user_id, campaign_id, Jsonb({"requirement_id": requirement_id, "match_count": len(matches)})),
        )
        conn.commit()
    return get_campaign(campaign_id, tenant_id) | {"matches": matches}


def set_campaign_candidate_status(campaign_id: str, candidate_id: str, status: str, tenant_id: str, user_id: str, note: str | None = None) -> dict[str, Any]:
    if status not in CAMPAIGN_PIPELINE_STATUSES:
        raise ValueError(status)
    with db() as conn:
        row = conn.execute(
            """
            insert into campaign_candidates (tenant_id, campaign_id, candidate_id, source, status, score, evidence)
            select %s, job_campaigns.id, candidates.document_id, 'copilot', %s, 0, %s
            from job_campaigns
            join candidates on candidates.document_id=%s and candidates.tenant_id=job_campaigns.tenant_id
              and candidates.deleted_at is null
            where job_campaigns.id=%s and job_campaigns.tenant_id=%s
            on conflict (campaign_id, candidate_id) do update set
              status=excluded.status,
              owner_user_id=%s,
              stage_note=%s,
              last_stage_changed_at=now(),
              source=case
                when campaign_candidates.source in ('uploaded', 'matched') then campaign_candidates.source
                else excluded.source
              end,
              evidence=coalesce(campaign_candidates.evidence, '{}'::jsonb) || excluded.evidence,
              updated_at=now()
            returning *
            """,
            (
                tenant_id,
                status,
                Jsonb({"manual_action": "copilot_shortlist" if status == "shortlisted" else "copilot_status_change"}),
                candidate_id,
                campaign_id,
                tenant_id,
                user_id,
                (note or "").strip() or None,
            ),
        ).fetchone()
        if row:
            conn.execute(
                """
                insert into candidate_activity_events (tenant_id, document_id, campaign_id, user_id, event_type, title, body, metadata)
                values (%s, %s, %s, %s, 'campaign.stage_changed', %s, %s, %s)
                """,
                (
                    tenant_id,
                    candidate_id,
                    campaign_id,
                    user_id,
                    f"Moved to {status.replace('_', ' ').title()}",
                    (note or "").strip() or None,
                    Jsonb({"status": status, "campaign_id": campaign_id}),
                ),
            )
            conn.execute(
                """
                insert into audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
                values (%s, %s, 'campaign.candidate_status_changed', 'campaign_candidate', %s, %s)
                """,
                (tenant_id, user_id, str(row["id"]), Jsonb({"campaign_id": campaign_id, "candidate_id": candidate_id, "status": status, "note": note})),
            )
        conn.commit()
    if not row:
        raise FileNotFoundError(candidate_id)
    return _candidate_link_row(row)


def _campaign_match_evidence_payload(match: dict[str, Any]) -> dict[str, Any]:
    evidence = match.get("evidence") or {}
    gaps = match.get("gaps") or {}
    hard_filter_failures = evidence.get("hard_filter_failures") or match.get("hard_filter_failures") or []
    return {
        "recommendation": match.get("recommendation"),
        "gaps": gaps,
        "evidence": evidence,
        "score_breakdown": {
            "total": float(match.get("total_score") or 0),
            "must_have": float(match.get("must_have_score") or 0),
            "nice_to_have": float(match.get("nice_to_have_score") or 0),
            "years": float(match.get("years_score") or 0),
            "domain": float(match.get("domain_score") or 0),
            "location": float(match.get("location_score") or 0),
        },
        "hard_filter_pass": not bool(hard_filter_failures),
        "hard_filter_failures": hard_filter_failures,
        "top_reasons": _campaign_top_reasons(evidence, gaps, hard_filter_failures),
        "top_gaps": _campaign_top_gaps(gaps, hard_filter_failures),
    }


def _campaign_top_reasons(evidence: dict[str, Any], gaps: dict[str, Any], hard_filter_failures: list[Any]) -> list[str]:
    if hard_filter_failures:
        return ["Hard filters need review before outreach."]
    reasons: list[str] = []
    reasons.extend(f"Must-have matched: {item}" for item in _string_items(evidence.get("must_have_hits"))[:3])
    reasons.extend(f"Nice-to-have matched: {item}" for item in _string_items(evidence.get("nice_to_have_hits"))[:2])
    reasons.extend(f"Domain fit: {item}" for item in _string_items(evidence.get("domain_hits"))[:2])
    reasons.extend(f"Location fit: {item}" for item in _string_items(evidence.get("location_hits"))[:2])
    if evidence.get("candidate_years") is not None and not gaps.get("years_gap"):
        reasons.append(f"Experience fit: {evidence['candidate_years']} years captured.")
    return reasons[:5] or ["Matched on available candidate evidence."]


def _campaign_top_gaps(gaps: dict[str, Any], hard_filter_failures: list[Any]) -> list[str]:
    gap_items: list[str] = [str(item) for item in hard_filter_failures if str(item).strip()]
    for label, key in (
        ("Missing must-have", "missing_must_haves"),
        ("Missing nice-to-have", "missing_nice_to_haves"),
        ("Missing domain", "missing_domains"),
        ("Missing location", "missing_locations"),
        ("Location preference not found", "missing_preferred_locations"),
    ):
        gap_items.extend(f"{label}: {item}" for item in _string_items(gaps.get(key))[:3])
    years_gap = gaps.get("years_gap")
    if isinstance(years_gap, (int, float)) and years_gap > 0:
        gap_items.append(f"Years gap: {round(float(years_gap), 1)}")
    return gap_items[:6]


def _string_items(value: Any) -> list[str]:
    if isinstance(value, str):
        return [item.strip() for item in re.split(r"[\n,;]+", value) if item.strip()]
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _campaign_row(row: dict[str, Any]) -> dict[str, Any]:
    requirement_profile = row.get("requirement_final_profile") or row.get("requirement_extracted_json") or {}
    requirement = None
    if row.get("requirement_id"):
        requirement = {
            "id": str(row["requirement_id"]),
            "title": row.get("requirement_title"),
            "status": row.get("requirement_status"),
            "original_text": row.get("requirement_original_text"),
            "extracted_requirement_json": row.get("requirement_extracted_json") or {},
            "final_requirement_profile": row.get("requirement_final_profile"),
            "recruiter_answers": row.get("requirement_recruiter_answers") or {},
        }
    return {
        "id": str(row["id"]),
        "tenant_id": str(row["tenant_id"]),
        "created_by_user_id": str(row["created_by_user_id"]) if row.get("created_by_user_id") else None,
        "requirement_id": str(row["requirement_id"]) if row.get("requirement_id") else None,
        "requirement_title": row.get("requirement_title"),
        "requirement_status": row.get("requirement_status"),
        "requirement": requirement,
        "scorecard": _scorecard_from_profile(requirement_profile),
        "name": row["name"],
        "description": row["description"],
        "status": row["status"],
        "candidate_count": int(row.get("candidate_count") or 0),
        "upload_batch_count": int(row.get("upload_batch_count") or 0),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


def _scorecard_from_profile(profile: dict[str, Any]) -> dict[str, Any]:
    profile = profile or {}
    preferred_locations = (
        _string_items(profile.get("preferred_locations"))
        or _string_items(profile.get("location_preference"))
        or _string_items(profile.get("required_locations"))
        or _string_items(profile.get("required_countries"))
    )
    return {
        "title": profile.get("title"),
        "location_preference": preferred_locations,
        "seniority": profile.get("seniority"),
        "min_years_experience": profile.get("min_years_experience"),
        "must_have_skills": _string_items(profile.get("must_have_skills")),
        "nice_to_have_skills": _string_items(profile.get("nice_to_have_skills")),
        "dealbreakers": _string_items(profile.get("dealbreakers")),
        "domains": _string_items(profile.get("domains")),
    }


def _requirement_exists(requirement_id: str, tenant_id: str) -> None:
    with db() as conn:
        row = conn.execute(
            "select id from requirements where id=%s and tenant_id=%s",
            (requirement_id, tenant_id),
        ).fetchone()
    if not row:
        raise FileNotFoundError(requirement_id)


def _campaign_candidate_row(row: dict[str, Any]) -> dict[str, Any]:
    return _candidate_link_row(row) | {"candidate": _candidate_summary(row["record_json"], row.get("candidate_updated_at"))}


def _candidate_link_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "tenant_id": str(row["tenant_id"]),
        "campaign_id": str(row["campaign_id"]),
        "candidate_id": row["candidate_id"],
        "source": row["source"],
        "status": row["status"],
        "score": float(row["score"] or 0),
        "evidence": row["evidence"] or {},
        "stage_note": row.get("stage_note"),
        "owner_user_id": str(row["owner_user_id"]) if row.get("owner_user_id") else None,
        "last_stage_changed_at": row["last_stage_changed_at"].isoformat() if row.get("last_stage_changed_at") else None,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


def _candidate_summary(record: dict[str, Any], updated_at: Any = None) -> dict[str, Any]:
    hr_profile = record.get("derived", {}).get("hr_profile", {})
    fact_verification = record.get("derived", {}).get("fact_verification") or {}
    location_intelligence = record.get("derived", {}).get("location_intelligence") or {}
    return {
        "document_id": record.get("document_id"),
        "name": record.get("name"),
        "email": (record.get("contact") or {}).get("email"),
        "phone": (record.get("contact") or {}).get("phone"),
        "current_title": factual_current_title(record),
        "current_company": factual_current_company(record),
        "fact_verification_status": fact_verification.get("status"),
        "current_role_verification_status": fact_verification.get("current_role_status"),
        "current_role_flags": fact_verification.get("current_role_flags") or [],
        "total_years_experience": hr_profile.get("total_years_experience"),
        "seniority": hr_profile.get("seniority_level"),
        "location": location_intelligence.get("current_job_location") or current_job_location(record),
        "countries": [
            item.get("country")
            for item in record.get("derived", {}).get("countries_associated", [])
            if isinstance(item, dict) and item.get("country")
        ],
        "updated_at": updated_at.isoformat() if updated_at else None,
    }
