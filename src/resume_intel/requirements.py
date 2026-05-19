from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from psycopg.types.json import Jsonb

from .db import db
from .extractors import extract_document
from .llm import extract_requirement_profile
from .settings import Settings
from .vector_search import semantic_candidate_scores, upsert_requirement_embedding


DOMAIN_ALIASES = {
    "ai": ["ai", "genai", "generative ai", "llm", "artificial intelligence", "azure openai"],
    "generative_ai": ["genai", "generative ai", "llm", "rag", "langchain", "langgraph", "openai"],
    "conversational_ai": ["chatbot", "virtual assistant", "bot", "dialogflow", "copilot"],
    "data_engineering": ["data engineer", "etl", "spark", "databricks", "snowflake", "pipeline"],
    "cloud_architecture": ["azure", "aws", "gcp", "cloud", "serverless"],
    "analytics_bi": ["tableau", "power bi", "looker", "analytics", "reporting"],
    "api_integration": ["api", "apis", "integration", "integrations", "graph api", "microsoft graph"],
    "knowledge_management": ["knowledge management", "sharepoint", "m365", "search"],
    "security_identity": ["security", "oauth", "okta", "entra", "rbac"],
    "microsoft_365": ["sharepoint", "teams", "outlook", "power platform", "m365"],
}

SKILL_ALIASES = {
    "microsoft bot framework": ["microsoft bot framework", "bot framework", "azure bot service", "copilot studio"],
    "google cloud contact center ai": ["google cloud contact center ai", "contact center ai", "ccai", "dialogflow"],
    "ccai": ["google cloud contact center ai", "contact center ai", "ccai", "dialogflow"],
    "azure openai": ["azure openai", "openai", "azure ai"],
    "sharepoint": ["sharepoint", "m365", "microsoft 365"],
    "m365": ["m365", "microsoft 365", "sharepoint", "teams", "outlook", "power platform"],
    "power platform": ["power platform", "power apps", "power automate", "power bi"],
    "microsoft graph": ["microsoft graph", "graph api"],
    "rag": ["rag", "retrieval augmented generation", "vector search", "semantic search"],
    "aws bedrock": ["aws bedrock", "bedrock"],
    "looker": ["looker", "dashboard", "dashboards", "analytics"],
}

MATCH_STOPWORDS = {
    "ability",
    "applications",
    "application",
    "building",
    "develop",
    "developing",
    "development",
    "experience",
    "hands",
    "including",
    "knowledge",
    "minimum",
    "solution",
    "solutions",
    "using",
    "with",
    "year",
    "years",
}


def create_requirement_from_text(text: str, user_id: str, settings: Settings, tenant_id: str | None = None) -> dict[str, Any]:
    profile = _profile_with_fallback(text, settings)
    return _save_requirement(user_id, "text", text, profile, tenant_id)


def create_requirement_from_file(path: Path, user_id: str, settings: Settings, work_dir: Path, tenant_id: str | None = None) -> dict[str, Any]:
    extracted = extract_document(path, settings, work_dir)
    profile = _profile_with_fallback(extracted.text, settings)
    return _save_requirement(user_id, path.suffix.lower().lstrip(".") or "file", extracted.text, profile, tenant_id)


def clarify_requirement(requirement_id: str, answers: dict[str, str], tenant_id: str | None = None) -> dict[str, Any]:
    req = get_requirement(requirement_id, tenant_id)
    merged = dict(req.get("final_requirement_profile") or req.get("extracted_requirement_json") or {})
    _apply_structured_answers(merged, answers)
    merged["recruiter_answers"] = answers
    for question, answer in answers.items():
        if question.startswith("__profile."):
            continue
        if answer.strip():
            merged.setdefault("clarified_constraints", []).append({"question": question, "answer": answer})
    with db() as conn:
        row = conn.execute(
            """
            update requirements
            set recruiter_answers=%s, final_profile=%s, status='clarified', updated_at=now()
            where id=%s and (%s::uuid is null or tenant_id=%s)
            returning id, title, source_type, original_text, extracted_json, clarification_questions,
                      recruiter_answers, final_profile, status, tenant_id, created_at, updated_at
            """,
            (Jsonb(answers), Jsonb(merged), requirement_id, tenant_id, tenant_id),
        ).fetchone()
        conn.commit()
    if not row:
        raise FileNotFoundError(requirement_id)
    return _requirement_row(row)


def update_requirement_scorecard(
    requirement_id: str,
    fields: dict[str, Any],
    tenant_id: str | None = None,
) -> dict[str, Any]:
    req = get_requirement(requirement_id, tenant_id)
    profile = dict(req.get("final_requirement_profile") or req.get("extracted_requirement_json") or {})
    answers = dict(req.get("recruiter_answers") or {})

    for profile_key, field_key in (
        ("must_have_skills", "must_have_skills"),
        ("nice_to_have_skills", "nice_to_have_skills"),
        ("dealbreakers", "dealbreakers"),
        ("domains", "domains"),
    ):
        if field_key in fields:
            profile[profile_key] = _field_list(fields.get(field_key))
            answers[f"__profile.{profile_key}"] = ", ".join(profile[profile_key])

    if "location_preference" in fields or "preferred_locations" in fields:
        locations = _field_list(fields.get("location_preference", fields.get("preferred_locations")))
        profile["preferred_locations"] = locations
        profile["location_preference"] = locations
        # Campaign scorecards treat location as a ranking preference unless the
        # recruiter explicitly uses the standalone requirement workflow.
        profile["required_locations"] = []
        profile["required_countries"] = []
        answers["__profile.preferred_locations"] = ", ".join(locations)

    if "min_years_experience" in fields:
        years = _field_number(fields.get("min_years_experience"))
        profile["min_years_experience"] = years
        answers["__profile.min_years_experience"] = "" if years is None else str(years)

    if "seniority" in fields:
        seniority = str(fields.get("seniority") or "").strip()
        profile["seniority"] = seniority or None
        answers["__profile.seniority"] = seniority

    title = str(fields.get("title") or profile.get("title") or req.get("title") or "").strip() or None
    if title:
        profile["title"] = title

    with db() as conn:
        row = conn.execute(
            """
            update requirements
            set title=coalesce(%s, title),
                recruiter_answers=%s,
                final_profile=%s,
                status='finalized',
                updated_at=now()
            where id=%s and (%s::uuid is null or tenant_id=%s)
            returning id, title, source_type, original_text, extracted_json, clarification_questions,
                      recruiter_answers, final_profile, status, tenant_id, created_at, updated_at
            """,
            (title, Jsonb(answers), Jsonb(profile), requirement_id, tenant_id, tenant_id),
        ).fetchone()
        conn.commit()
    if not row:
        raise FileNotFoundError(requirement_id)
    requirement = _requirement_row(row)
    upsert_requirement_embedding(requirement["id"], _requirement_text(profile, requirement["original_text"]), tenant_id)
    return requirement


def _apply_structured_answers(profile: dict[str, Any], answers: dict[str, str]) -> None:
    list_fields = {
        "__profile.must_have_skills": "must_have_skills",
        "__profile.nice_to_have_skills": "nice_to_have_skills",
        "__profile.required_locations": "required_locations",
        "__profile.required_countries": "required_countries",
        "__profile.domains": "domains",
        "__profile.dealbreakers": "dealbreakers",
    }
    for answer_key, profile_key in list_fields.items():
        parsed = _answer_list(answers.get(answer_key))
        if parsed:
            profile[profile_key] = parsed

    min_years = _answer_number(answers.get("__profile.min_years_experience"))
    if min_years is not None:
        profile["min_years_experience"] = min_years

    for answer_key, profile_key in {
        "__profile.seniority": "seniority",
        "__profile.work_authorization": "work_authorization",
    }.items():
        value = str(answers.get(answer_key) or "").strip()
        if value:
            profile[profile_key] = value


def _answer_list(value: str | None) -> list[str]:
    if not value:
        return []
    return [
        item.strip()
        for item in re.split(r"[\n,;]+", value)
        if item.strip()
    ]


def _answer_number(value: str | None) -> float | int | None:
    if not value:
        return None
    match = re.search(r"\d+(?:\.\d+)?", value)
    if not match:
        return None
    number = float(match.group(0))
    return int(number) if number.is_integer() else number


def _field_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        raw_items = value
    else:
        raw_items = re.split(r"[\n,;]+", str(value))
    return [str(item).strip() for item in raw_items if str(item).strip()]


def _field_number(value: Any) -> float | int | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        number = float(value)
        return int(number) if number.is_integer() else number
    return _answer_number(str(value))


def finalize_requirement(requirement_id: str, answers: dict[str, str], tenant_id: str | None = None) -> dict[str, Any]:
    req = clarify_requirement(requirement_id, answers, tenant_id)
    with db() as conn:
        row = conn.execute(
            """
            update requirements
            set status='finalized', updated_at=now()
            where id=%s and (%s::uuid is null or tenant_id=%s)
            returning id, title, source_type, original_text, extracted_json, clarification_questions,
                      recruiter_answers, final_profile, status, tenant_id, created_at, updated_at
            """,
            (requirement_id, tenant_id, tenant_id),
        ).fetchone()
        conn.commit()
    if not row:
        raise FileNotFoundError(requirement_id)
    return _requirement_row(row)


def get_requirement(requirement_id: str, tenant_id: str | None = None) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            select id, title, source_type, original_text, extracted_json, clarification_questions,
                   recruiter_answers, final_profile, status, tenant_id, created_at, updated_at
            from requirements where id=%s and (%s::uuid is null or tenant_id=%s)
            """,
            (requirement_id, tenant_id, tenant_id),
        ).fetchone()
    if not row:
        raise FileNotFoundError(requirement_id)
    return _requirement_row(row)


def list_requirements(tenant_id: str | None = None) -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            """
            select id, title, source_type, original_text, extracted_json, clarification_questions,
                   recruiter_answers, final_profile, status, tenant_id, created_at, updated_at
            from requirements
            where (%s::uuid is null or tenant_id=%s)
            order by updated_at desc
            """,
            (tenant_id, tenant_id),
        ).fetchall()
    return [_requirement_row(row) for row in rows]


def match_requirement(requirement_id: str, tenant_id: str | None = None) -> list[dict[str, Any]]:
    req = get_requirement(requirement_id, tenant_id)
    tenant_id = tenant_id or req.get("tenant_id")
    profile = req.get("final_requirement_profile") or req["extracted_requirement_json"]
    semantic_scores = semantic_candidate_scores(_requirement_text(profile, req["original_text"]), tenant_id=tenant_id)
    with db() as conn:
        candidates = conn.execute("select document_id, record_json, raw_text from candidates where tenant_id=%s and deleted_at is null", (tenant_id,)).fetchall()
    matches = []
    for row in candidates:
        candidate = row["record_json"]
        match = score_candidate(profile, candidate, row.get("raw_text") or "")
        semantic = semantic_scores.get(row["document_id"], {"semantic_score": 0.0, "top_chunks": [], "evidence": []})
        match["rule_score"] = match["total_score"]
        match["semantic_score"] = round(semantic["semantic_score"], 3)
        match["semantic_top_chunks"] = semantic["top_chunks"]
        match["total_score"] = round((match["rule_score"] * 0.78) + (match["semantic_score"] * 0.22), 3)
        if not match.get("hard_filter_pass", True):
            match["total_score"] = min(match["total_score"], 0.49)
        match["evidence"]["semantic_top_chunks"] = semantic["top_chunks"]
        match["evidence"]["semantic_evidence"] = semantic.get("evidence", [])
        match["candidate_id"] = row["document_id"]
        match["candidate"] = _candidate_summary(candidate)
        matches.append(match)
    matches.sort(key=lambda item: item["total_score"], reverse=True)
    _persist_matches(requirement_id, matches, tenant_id)
    _persist_match_run(requirement_id, profile, matches, tenant_id)
    with db() as conn:
        conn.execute(
            "update requirements set status='matched', updated_at=now() where id=%s and (%s::uuid is null or tenant_id=%s)",
            (requirement_id, tenant_id, tenant_id),
        )
        conn.commit()
    return matches


def list_match_runs(requirement_id: str, tenant_id: str | None = None) -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            """
            select id, requirement_id, run_number, candidate_count, eligible_count, blocked_count,
                   top_score, average_score, profile_snapshot, matches_snapshot, created_at
            from requirement_match_runs
            where requirement_id=%s and (%s::uuid is null or tenant_id=%s)
            order by run_number desc
            """,
            (requirement_id, tenant_id, tenant_id),
        ).fetchall()
    return [_match_run_row(row, include_matches=False) for row in rows]


def get_match_run(requirement_id: str, run_id: str, tenant_id: str | None = None) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            select id, requirement_id, run_number, candidate_count, eligible_count, blocked_count,
                   top_score, average_score, profile_snapshot, matches_snapshot, created_at
            from requirement_match_runs
            where id=%s and requirement_id=%s and (%s::uuid is null or tenant_id=%s)
            """,
            (run_id, requirement_id, tenant_id, tenant_id),
        ).fetchone()
    if not row:
        raise FileNotFoundError(run_id)
    return _match_run_row(row, include_matches=True)


def compare_match_runs(requirement_id: str, left_run_id: str | None = None, right_run_id: str | None = None, tenant_id: str | None = None) -> dict[str, Any]:
    runs = list_match_runs(requirement_id, tenant_id)
    if not runs:
        return {"runs": [], "changes": []}
    if left_run_id and right_run_id:
        left = get_match_run(requirement_id, left_run_id, tenant_id)
        right = get_match_run(requirement_id, right_run_id, tenant_id)
    elif len(runs) >= 2:
        right = get_match_run(requirement_id, runs[0]["id"], tenant_id)
        left = get_match_run(requirement_id, runs[1]["id"], tenant_id)
    else:
        only = get_match_run(requirement_id, runs[0]["id"], tenant_id)
        return {"runs": [only], "changes": []}
    return {
        "runs": [left, right],
        "changes": build_match_run_changes(left.get("matches", []), right.get("matches", [])),
    }


def get_matches(requirement_id: str, tenant_id: str | None = None) -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            """
            select requirement_matches.*, candidates.record_json
            from requirement_matches
            join candidates on candidates.document_id=requirement_matches.candidate_id
              and candidates.deleted_at is null
            where requirement_id=%s and (%s::uuid is null or requirement_matches.tenant_id=%s)
            order by total_score desc
            """,
            (requirement_id, tenant_id, tenant_id),
        ).fetchall()
    return [
        {
            "candidate_id": row["candidate_id"],
            "candidate": _candidate_summary(row["record_json"]),
            "total_score": float(row["total_score"]),
            "must_have_score": float(row["must_have_score"]),
            "nice_to_have_score": float(row["nice_to_have_score"]),
            "years_score": float(row["years_score"]),
            "domain_score": float(row["domain_score"]),
            "location_score": float(row["location_score"]),
            "evidence": row["evidence"],
            "gaps": row["gaps"],
            "recommendation": row["recommendation"],
            "status": row["status"],
            "created_at": row["created_at"].isoformat(),
        }
        for row in rows
    ]


def set_match_status(requirement_id: str, candidate_id: str, status: str, tenant_id: str | None = None) -> dict[str, Any]:
    if status not in {"shortlisted", "rejected", "ranked"}:
        raise ValueError(status)
    with db() as conn:
        row = conn.execute(
            """
            update requirement_matches
            set status=%s
            where requirement_id=%s and candidate_id=%s and (%s::uuid is null or tenant_id=%s)
            returning candidate_id, total_score, must_have_score, nice_to_have_score, years_score,
                      domain_score, location_score, evidence, gaps, recommendation, status, created_at
            """,
            (status, requirement_id, candidate_id, tenant_id, tenant_id),
        ).fetchone()
        conn.commit()
    if not row:
        raise FileNotFoundError(candidate_id)
    return {
        "candidate_id": row["candidate_id"],
        "total_score": float(row["total_score"]),
        "must_have_score": float(row["must_have_score"]),
        "nice_to_have_score": float(row["nice_to_have_score"]),
        "years_score": float(row["years_score"]),
        "domain_score": float(row["domain_score"]),
        "location_score": float(row["location_score"]),
        "evidence": row["evidence"],
        "gaps": row["gaps"],
        "recommendation": row["recommendation"],
        "status": row["status"],
        "created_at": row["created_at"].isoformat(),
    }


def score_candidate(profile: dict[str, Any], candidate: dict[str, Any], raw_text: str = "") -> dict[str, Any]:
    candidate_text = _candidate_text(candidate, raw_text)
    must = [str(item) for item in profile.get("must_have_skills", []) if item]
    nice = [str(item) for item in profile.get("nice_to_have_skills", []) if item]
    domain_text = _domain_text(candidate)
    must_hits = [item for item in must if _requirement_item_hit(item, candidate_text, domain_text)]
    nice_hits = [item for item in nice if _requirement_item_hit(item, candidate_text, domain_text)]
    must_score = len(must_hits) / len(must) if must else 1.0
    nice_score = len(nice_hits) / len(nice) if nice else 1.0

    min_years = profile.get("min_years_experience")
    candidate_years = candidate.get("derived", {}).get("hr_profile", {}).get("total_years_experience") or 0
    years_score = min(1.0, float(candidate_years) / float(min_years)) if min_years else 1.0

    required_domains = [_canonical_domain(item) for item in profile.get("domains", []) if item]
    candidate_domains = {_canonical_domain(key) for key in candidate.get("derived", {}).get("experience_by_domain", {})}
    domain_hits = [domain for domain in required_domains if domain in candidate_domains or any(alias in candidate_text for alias in DOMAIN_ALIASES.get(domain, []))]
    domain_score = len(domain_hits) / len(required_domains) if required_domains else 1.0

    required_locations = [str(item) for item in [*_field_list(profile.get("required_locations")), *_field_list(profile.get("required_countries"))] if item]
    preferred_locations = [str(item) for item in [*_field_list(profile.get("preferred_locations")), *_field_list(profile.get("location_preference"))] if item]
    scored_locations = [*required_locations, *preferred_locations]
    location_hits = [item for item in required_locations if _location_hit(item, candidate_text)]
    preferred_location_hits = [item for item in preferred_locations if _location_hit(item, candidate_text)]
    all_location_hits = [*location_hits, *preferred_location_hits]
    location_score = len(all_location_hits) / len(scored_locations) if scored_locations else 1.0

    total = (must_score * 0.38) + (nice_score * 0.14) + (years_score * 0.18) + (domain_score * 0.2) + (location_score * 0.1)
    gaps = {
        "missing_must_haves": [item for item in must if item not in must_hits],
        "missing_nice_to_haves": [item for item in nice if item not in nice_hits],
        "years_gap": max(0, float(min_years or 0) - float(candidate_years)),
        "missing_domains": [item for item in required_domains if item not in domain_hits],
        "missing_locations": [item for item in required_locations if item not in location_hits],
        "missing_preferred_locations": [item for item in preferred_locations if item not in preferred_location_hits],
    }
    hard_filter_failures = _hard_filter_failures(profile, gaps, candidate_text, candidate_years, min_years)
    hard_filter_pass = not hard_filter_failures
    if not hard_filter_pass:
        total = min(total, 0.49)
    evidence = {
        "must_have_hits": must_hits,
        "nice_to_have_hits": nice_hits,
        "domain_hits": domain_hits,
        "location_hits": all_location_hits,
        "preferred_location_hits": preferred_location_hits,
        "candidate_years": candidate_years,
        "hard_filter_failures": hard_filter_failures,
        "notes_relevance": _notes_relevance(profile, candidate),
    }
    return {
        "total_score": round(total, 3),
        "hard_filter_pass": hard_filter_pass,
        "hard_filter_failures": hard_filter_failures,
        "must_have_score": round(must_score, 3),
        "nice_to_have_score": round(nice_score, 3),
        "years_score": round(years_score, 3),
        "domain_score": round(domain_score, 3),
        "location_score": round(location_score, 3),
        "evidence": evidence,
        "gaps": gaps,
        "recommendation": _recommendation(total, gaps, hard_filter_failures),
    }


def _profile_with_fallback(text: str, settings: Settings) -> dict[str, Any]:
    try:
        profile = extract_requirement_profile(text=text, settings=settings)
    except Exception:
        profile = _heuristic_profile(text)
    profile.setdefault("clarification_questions", _default_questions(profile))
    return profile


def _heuristic_profile(text: str) -> dict[str, Any]:
    lowered = text.lower()
    skills = sorted({term for terms in DOMAIN_ALIASES.values() for term in terms if term in lowered})
    years = None
    match = re.search(r"(\d+)\+?\s*(?:years|yrs)", lowered)
    if match:
        years = int(match.group(1))
    domains = [domain for domain, aliases in DOMAIN_ALIASES.items() if any(alias in lowered for alias in aliases)]
    return {
        "title": None,
        "must_have_skills": skills[:10],
        "nice_to_have_skills": [],
        "domains": domains,
        "min_years_experience": years,
        "seniority": None,
        "required_locations": [],
        "required_countries": [],
        "work_authorization": None,
        "dealbreakers": [],
        "responsibilities": [],
        "clarification_questions": [],
    }


def _save_requirement(user_id: str, source_type: str, text: str, profile: dict[str, Any], tenant_id: str | None) -> dict[str, Any]:
    questions = profile.get("clarification_questions") or _default_questions(profile)
    with db() as conn:
        row = conn.execute(
            """
            insert into requirements (tenant_id, owner_user_id, created_by_user_id, title, source_type, original_text, extracted_json, clarification_questions)
            values (%s, %s, %s, %s, %s, %s, %s, %s)
            returning id, title, source_type, original_text, extracted_json, clarification_questions,
                      recruiter_answers, final_profile, status, tenant_id, created_at, updated_at
            """,
            (tenant_id, user_id, user_id, profile.get("title"), source_type, text, Jsonb(profile), Jsonb(questions)),
        ).fetchone()
        conn.commit()
    requirement = _requirement_row(row)
    upsert_requirement_embedding(requirement["id"], _requirement_text(profile, text), tenant_id)
    return requirement


def _persist_matches(requirement_id: str, matches: list[dict[str, Any]], tenant_id: str | None) -> None:
    with db() as conn:
        for match in matches:
            conn.execute(
                """
                insert into requirement_matches (
                  tenant_id, requirement_id, candidate_id, total_score, must_have_score, nice_to_have_score,
                  years_score, domain_score, location_score, evidence, gaps, recommendation
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (requirement_id, candidate_id) do update set
                  tenant_id=excluded.tenant_id,
                  total_score=excluded.total_score,
                  must_have_score=excluded.must_have_score,
                  nice_to_have_score=excluded.nice_to_have_score,
                  years_score=excluded.years_score,
                  domain_score=excluded.domain_score,
                  location_score=excluded.location_score,
                  evidence=excluded.evidence,
                  gaps=excluded.gaps,
                  recommendation=excluded.recommendation,
                  created_at=now()
                """,
                (
                    tenant_id,
                    requirement_id,
                    match["candidate_id"],
                    match["total_score"],
                    match["must_have_score"],
                    match["nice_to_have_score"],
                    match["years_score"],
                    match["domain_score"],
                    match["location_score"],
                    Jsonb(match["evidence"]),
                    Jsonb(match["gaps"]),
                    match["recommendation"],
                ),
            )
        conn.commit()


def _persist_match_run(requirement_id: str, profile: dict[str, Any], matches: list[dict[str, Any]], tenant_id: str | None) -> dict[str, Any]:
    candidate_count = len(matches)
    eligible_count = sum(1 for item in matches if item.get("hard_filter_pass", True))
    blocked_count = candidate_count - eligible_count
    top_score = max((float(item.get("total_score") or 0) for item in matches), default=0.0)
    average_score = sum(float(item.get("total_score") or 0) for item in matches) / candidate_count if candidate_count else 0.0
    snapshot = [_match_snapshot(item, index) for index, item in enumerate(matches)]
    with db() as conn:
        next_run = conn.execute(
            "select coalesce(max(run_number), 0) + 1 as run_number from requirement_match_runs where requirement_id=%s",
            (requirement_id,),
        ).fetchone()["run_number"]
        row = conn.execute(
            """
            insert into requirement_match_runs (
              tenant_id, requirement_id, run_number, candidate_count, eligible_count, blocked_count,
              top_score, average_score, profile_snapshot, matches_snapshot
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            returning id, requirement_id, run_number, candidate_count, eligible_count, blocked_count,
                      top_score, average_score, profile_snapshot, matches_snapshot, created_at
            """,
            (
                tenant_id,
                requirement_id,
                next_run,
                candidate_count,
                eligible_count,
                blocked_count,
                top_score,
                average_score,
                Jsonb(profile),
                Jsonb(snapshot),
            ),
        ).fetchone()
        conn.commit()
    return _match_run_row(row, include_matches=True)


def _match_snapshot(match: dict[str, Any], index: int) -> dict[str, Any]:
    candidate = match.get("candidate") or {}
    return {
        "rank": index + 1,
        "candidate_id": match["candidate_id"],
        "candidate_name": candidate.get("name"),
        "current_title": candidate.get("current_title"),
        "current_company": candidate.get("current_company"),
        "total_score": float(match.get("total_score") or 0),
        "hard_filter_pass": bool(match.get("hard_filter_pass", True)),
        "status": match.get("status") or "ranked",
        "recommendation": match.get("recommendation"),
        "hard_filter_failures": match.get("hard_filter_failures") or match.get("evidence", {}).get("hard_filter_failures") or [],
        "gaps": match.get("gaps") or {},
    }


def _match_run_row(row: dict[str, Any], include_matches: bool) -> dict[str, Any]:
    result = {
        "id": str(row["id"]),
        "requirement_id": str(row["requirement_id"]),
        "run_number": int(row["run_number"]),
        "candidate_count": int(row["candidate_count"]),
        "eligible_count": int(row["eligible_count"]),
        "blocked_count": int(row["blocked_count"]),
        "top_score": float(row["top_score"]),
        "average_score": float(row["average_score"]),
        "profile_snapshot": row["profile_snapshot"],
        "created_at": row["created_at"].isoformat(),
    }
    if include_matches:
        result["matches"] = row["matches_snapshot"]
    return result


def build_match_run_changes(left_matches: list[dict[str, Any]], right_matches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    left_by_id = {item["candidate_id"]: item for item in left_matches}
    right_by_id = {item["candidate_id"]: item for item in right_matches}
    changes = []
    for candidate_id in sorted(set(left_by_id) | set(right_by_id)):
        left = left_by_id.get(candidate_id)
        right = right_by_id.get(candidate_id)
        if not left and right:
            changes.append({
                "candidate_id": candidate_id,
                "candidate_name": right.get("candidate_name"),
                "change_type": "added",
                "score_delta": float(right.get("total_score") or 0),
                "rank_delta": None,
            })
            continue
        if left and not right:
            changes.append({
                "candidate_id": candidate_id,
                "candidate_name": left.get("candidate_name"),
                "change_type": "removed",
                "score_delta": -float(left.get("total_score") or 0),
                "rank_delta": None,
            })
            continue
        if not left or not right:
            continue
        score_delta = round(float(right.get("total_score") or 0) - float(left.get("total_score") or 0), 3)
        rank_delta = int(left.get("rank") or 0) - int(right.get("rank") or 0)
        if score_delta or rank_delta:
            changes.append({
                "candidate_id": candidate_id,
                "candidate_name": right.get("candidate_name") or left.get("candidate_name"),
                "change_type": "changed",
                "score_delta": score_delta,
                "rank_delta": rank_delta,
                "previous_rank": left.get("rank"),
                "current_rank": right.get("rank"),
                "previous_score": left.get("total_score"),
                "current_score": right.get("total_score"),
            })
    changes.sort(key=lambda item: (abs(float(item.get("score_delta") or 0)), abs(int(item.get("rank_delta") or 0))), reverse=True)
    return changes


def _requirement_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "title": row["title"],
        "source_type": row["source_type"],
        "original_text": row["original_text"],
        "extracted_requirement_json": row["extracted_json"],
        "clarification_questions": row["clarification_questions"],
        "recruiter_answers": row["recruiter_answers"],
        "final_requirement_profile": row["final_profile"],
        "status": row["status"],
        "tenant_id": str(row["tenant_id"]) if row.get("tenant_id") else None,
        "created_at": row["created_at"].isoformat(),
        "updated_at": row["updated_at"].isoformat(),
    }


def _candidate_summary(candidate: dict[str, Any]) -> dict[str, Any]:
    hr = candidate.get("derived", {}).get("hr_profile", {})
    return {
        "document_id": candidate.get("document_id"),
        "name": candidate.get("name"),
        "current_title": hr.get("current_title"),
        "current_company": hr.get("current_company"),
        "location": candidate.get("contact", {}).get("location"),
        "total_years_experience": hr.get("total_years_experience"),
        "seniority": hr.get("seniority_level"),
    }


def _candidate_text(candidate: dict[str, Any], raw_text: str = "") -> str:
    location_intelligence = candidate.get("derived", {}).get("location_intelligence", {})
    return _norm(" ".join([
        candidate.get("name") or "",
        candidate.get("summary") or "",
        raw_text or "",
        " ".join(candidate.get("skills") or []),
        " ".join(candidate.get("certifications") or []),
        " ".join(note.get("content", "") for note in candidate.get("notes") or []),
        _domain_text(candidate),
        " ".join(item.get("country", "") for item in candidate.get("derived", {}).get("countries_associated") or [] if isinstance(item, dict)),
        _flatten_text(location_intelligence),
        " ".join(" ".join(filter(None, [exp.get("company"), exp.get("title"), exp.get("location"), " ".join(exp.get("bullets") or [])])) for exp in candidate.get("experience") or []),
        " ".join(" ".join(filter(None, [edu.get("school"), edu.get("degree"), edu.get("field")])) for edu in candidate.get("education") or []),
    ]))


def _flatten_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return " ".join(_flatten_text(item) for item in value.values())
    if isinstance(value, list):
        return " ".join(_flatten_text(item) for item in value)
    return str(value)


def _requirement_item_hit(item: str, candidate_text: str, domain_text: str = "") -> bool:
    normalized = _norm(item)
    haystack = f"{candidate_text} {domain_text}"
    if not normalized:
        return False
    if normalized in haystack:
        return True
    if any(alias in haystack for alias in _aliases_for_item(normalized)):
        return True
    tokens = _meaningful_tokens(normalized)
    if not tokens:
        return False
    hits = sum(1 for token in tokens if token in haystack)
    coverage = hits / len(tokens)
    if len(tokens) <= 3:
        return hits >= max(1, len(tokens) - 1)
    return hits >= 2 and coverage >= 0.55


def _location_hit(item: str, candidate_text: str) -> bool:
    normalized = _norm(item)
    if not normalized:
        return False
    if normalized in candidate_text:
        return True
    if "columbus" in normalized and "columbus" in candidate_text and ("oh" in candidate_text or "ohio" in candidate_text):
        return True
    tokens = [token for token in _meaningful_tokens(normalized) if token not in {"remote", "hybrid", "onsite"}]
    if not tokens:
        return normalized in candidate_text
    return sum(1 for token in tokens if token in candidate_text) / len(tokens) >= 0.6


def _aliases_for_item(normalized: str) -> list[str]:
    aliases: list[str] = []
    for key, values in SKILL_ALIASES.items():
        if key in normalized or normalized in key:
            aliases.extend(values)
    return [_norm(alias) for alias in aliases]


def _meaningful_tokens(normalized: str) -> list[str]:
    return [
        token
        for token in re.findall(r"[a-z0-9#+.]+", normalized)
        if token not in MATCH_STOPWORDS and (len(token) > 2 or token in {"ai", "c#", "c++"})
    ]


def _domain_text(candidate: dict[str, Any]) -> str:
    domains = candidate.get("derived", {}).get("experience_by_domain", {})
    return _norm(" ".join([*domains.keys(), *(key.replace("_", " ") for key in domains.keys())]))


def _canonical_domain(value: str) -> str:
    normalized = _norm(value).replace(" ", "_")
    if normalized in {"ai", "artificial_intelligence"}:
        return "ai"
    if "chatbot" in normalized or "conversational" in normalized:
        return "conversational_ai"
    if "generative_ai" in normalized or normalized.startswith("nlp") or "gen_ai" in normalized:
        return "generative_ai"
    if "sharepoint" in normalized or "m365" in normalized or "microsoft_365" in normalized:
        return "microsoft_365"
    if "api" in normalized or "integration" in normalized:
        return "api_integration"
    if "security" in normalized or "privacy" in normalized:
        return "security_identity"
    if "knowledge" in normalized:
        return "knowledge_management"
    if normalized in {"data", "data_engineering"}:
        return "data_engineering"
    if normalized in {"cloud", "cloud_architecture"}:
        return "cloud_architecture"
    if normalized in {"analytics", "bi", "analytics_bi"}:
        return "analytics_bi"
    if normalized in {"microsoft_365", "m365"}:
        return "microsoft_365"
    return normalized


def _notes_relevance(profile: dict[str, Any], candidate: dict[str, Any]) -> list[str]:
    terms = [_norm(item) for item in [*profile.get("must_have_skills", []), *profile.get("nice_to_have_skills", [])] if item]
    hits = []
    for note in candidate.get("notes") or []:
        note_text = _norm(note.get("content", ""))
        if any(term in note_text for term in terms):
            hits.append(note.get("name") or "note")
    return hits


def _hard_filter_failures(profile: dict[str, Any], gaps: dict[str, Any], candidate_text: str, candidate_years: float, min_years: Any) -> list[str]:
    failures: list[str] = []
    failures.extend(f"Missing must-have: {item}" for item in gaps.get("missing_must_haves", []))
    if min_years and gaps.get("years_gap", 0) > 0:
        failures.append(f"Below minimum years: has {round(float(candidate_years), 1)}, needs {min_years}")
    failures.extend(f"Missing required location/country: {item}" for item in gaps.get("missing_locations", []))
    for item in _active_dealbreakers(profile):
        if item and _requirement_item_hit(str(item), candidate_text):
            failures.append(f"Dealbreaker present: {item}")
    work_authorization = profile.get("work_authorization")
    if _requires_work_authorization_check(work_authorization) and not _requirement_item_hit(str(work_authorization), candidate_text):
        failures.append(f"Work authorization not confirmed: {work_authorization}")
    return failures


def _requires_work_authorization_check(value: Any) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    return _norm(value) not in {"not specified", "not set", "none", "n a", "na", "unknown"}


def _active_dealbreakers(profile: dict[str, Any]) -> list[str]:
    inactive_prefixes = ("lack of", "no ", "inability", "without ", "does not", "cannot ")
    return [
        str(item)
        for item in profile.get("dealbreakers") or []
        if item and not _norm(str(item)).startswith(inactive_prefixes)
    ]


def _recommendation(score: float, gaps: dict[str, Any], hard_filter_failures: list[str] | None = None) -> str:
    if hard_filter_failures:
        return "Not eligible under current hard filters: review failed constraints before outreach."
    if score >= 0.78 and not gaps["missing_must_haves"]:
        return "Strong fit: prioritize recruiter review."
    if score >= 0.55:
        return "Potential fit: review gaps before outreach."
    return "Weak fit: keep as backup unless constraints change."


def _default_questions(profile: dict[str, Any]) -> list[str]:
    questions = []
    if not profile.get("must_have_skills"):
        questions.append("What are the non-negotiable must-have skills?")
    if not profile.get("min_years_experience"):
        questions.append("What is the minimum required years of experience?")
    if not profile.get("required_locations") and not profile.get("required_countries"):
        questions.append("Are there location, country, timezone, or work authorization constraints?")
    if not profile.get("seniority"):
        questions.append("What seniority level is required?")
    if not profile.get("dealbreakers"):
        questions.append("What would disqualify a candidate?")
    return questions


def _norm(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9#+. ]", " ", value.lower())).strip()


def _requirement_text(profile: dict[str, Any], original_text: str) -> str:
    return " ".join(
        [
            original_text,
            str(profile.get("title") or ""),
            " ".join(profile.get("must_have_skills") or []),
            " ".join(profile.get("nice_to_have_skills") or []),
            " ".join(profile.get("domains") or []),
            " ".join(_field_list(profile.get("preferred_locations"))),
            " ".join(_field_list(profile.get("location_preference"))),
            " ".join(profile.get("responsibilities") or []),
            " ".join(profile.get("dealbreakers") or []),
        ]
    )
