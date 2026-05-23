from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from psycopg.types.json import Jsonb

from .db import db
from .extractors import extract_document
from .geo import candidate_current_location, countries_for_search
from .llm import extract_requirement_profile, judge_requirement_candidate_matches
from .pii import redact_contact_pii_text
from .settings import Settings, load_settings
from .vector_search import semantic_candidate_scores, semantic_candidate_scores_for_ids, upsert_requirement_embedding


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

MATCH_VISIBILITY_THRESHOLD = 0.30
RECALL_LIMIT = 250
STRUCTURED_RECALL_LIMIT = 500
LEXICAL_RECALL_LIMIT = 250
DETERMINISTIC_SCORE_POOL_LIMIT = 120
LLM_JUDGE_LIMIT = 15
LLM_JUDGE_MIN_SCORE = 0.58
CAMPAIGN_MATCH_VISIBILITY_THRESHOLD = 0.65

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
        ("industry_preferences", "industry_preferences"),
        ("soft_preferences", "soft_preferences"),
        ("hidden_intent", "hidden_intent"),
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

    if "role_intent" in fields:
        role_intent = str(fields.get("role_intent") or "").strip()
        profile["role_intent"] = role_intent or None
        answers["__profile.role_intent"] = role_intent

    for key in ("strict_must_haves", "strict_min_years"):
        if key in fields:
            profile[key] = bool(fields.get(key))
            answers[f"__profile.{key}"] = "true" if profile[key] else "false"

    if "score_weights" in fields and isinstance(fields.get("score_weights"), dict):
        profile["score_weights"] = {
            key: _score_value(value)
            for key, value in fields["score_weights"].items()
            if _score_value(value) > 0
        }
        answers["__profile.score_weights"] = ", ".join(f"{key}:{value}" for key, value in profile["score_weights"].items())

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
        "__profile.industry_preferences": "industry_preferences",
        "__profile.soft_preferences": "soft_preferences",
        "__profile.hidden_intent": "hidden_intent",
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
        "__profile.role_intent": "role_intent",
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


def match_requirement(
    requirement_id: str,
    tenant_id: str | None = None,
    *,
    deep_judge: bool = False,
    extra_candidate_ids: list[str] | None = None,
    minimum_score: float = MATCH_VISIBILITY_THRESHOLD,
    candidate_ids_only: bool = False,
) -> list[dict[str, Any]]:
    req = get_requirement(requirement_id, tenant_id)
    tenant_id = tenant_id or req.get("tenant_id")
    profile = req.get("final_requirement_profile") or req["extracted_requirement_json"]
    requirement_text = _requirement_text(profile, req["original_text"])
    if candidate_ids_only:
        recall_ids = _dedupe_ids([str(candidate_id) for candidate_id in (extra_candidate_ids or []) if candidate_id])[:RECALL_LIMIT]
        semantic_scores = semantic_candidate_scores_for_ids(requirement_text, recall_ids, tenant_id=tenant_id)
    else:
        semantic_scores = semantic_candidate_scores(requirement_text, limit=RECALL_LIMIT, tenant_id=tenant_id)
        recall_ids = _broad_recall_candidate_ids(profile, requirement_text, semantic_scores, tenant_id, extra_candidate_ids)
    if candidate_ids_only and not recall_ids:
        return []
    with db() as conn:
        if recall_ids:
            candidates = conn.execute(
                """
                select document_id, record_json, raw_text
                from candidates
                where tenant_id=%s and deleted_at is null and document_id = any(%s::text[])
                """,
                (tenant_id, recall_ids),
            ).fetchall()
        else:
            candidates = conn.execute(
                """
                select document_id, record_json, raw_text
                from candidates
                where tenant_id=%s and deleted_at is null
                order by updated_at desc
                limit %s
                """,
                (tenant_id, RECALL_LIMIT),
            ).fetchall()
    matches = []
    for row in candidates:
        candidate = row["record_json"]
        match = score_candidate(profile, candidate, row.get("raw_text") or "")
        semantic = semantic_scores.get(row["document_id"], {"semantic_score": 0.0, "top_chunks": [], "evidence": []})
        match["rule_score"] = match["total_score"]
        match["semantic_score"] = round(semantic["semantic_score"], 3)
        match["semantic_top_chunks"] = semantic["top_chunks"]
        semantic_weight = _semantic_weight(profile)
        rule_weight = round(1.0 - semantic_weight, 3)
        match["total_score"] = round((match["rule_score"] * rule_weight) + (match["semantic_score"] * semantic_weight), 3)
        match["evidence"]["score_weights"]["semantic"] = semantic_weight
        match["evidence"]["score_weights"]["structured_profile"] = rule_weight
        if not match.get("hard_filter_pass", True):
            match["total_score"] = min(match["total_score"], 0.49)
        match["evidence"]["semantic_top_chunks"] = semantic["top_chunks"]
        match["evidence"]["semantic_evidence"] = semantic.get("evidence", [])
        match["evidence"]["visibility_threshold"] = MATCH_VISIBILITY_THRESHOLD
        match["candidate_id"] = row["document_id"]
        match["candidate"] = _candidate_summary(candidate)
        match["_candidate_record"] = candidate
        match["_raw_text"] = row.get("raw_text") or ""
        matches.append(match)
    matches.sort(key=lambda item: item["total_score"], reverse=True)
    if deep_judge:
        matches = _deterministic_match_pool(matches)
    if deep_judge:
        _apply_llm_match_judgement(matches, profile, requirement_text, tenant_id)
    for match in matches:
        match.pop("_candidate_record", None)
        match.pop("_raw_text", None)
    visible_threshold = max(MATCH_VISIBILITY_THRESHOLD, min(0.95, float(minimum_score)))
    visible_matches = [item for item in matches if float(item.get("total_score") or 0) >= visible_threshold]
    _persist_matches(requirement_id, visible_matches, tenant_id, replace_all=not candidate_ids_only, candidate_scope_ids=recall_ids if candidate_ids_only else None)
    _persist_match_run(requirement_id, profile, visible_matches, tenant_id)
    with db() as conn:
        conn.execute(
            "update requirements set status='matched', updated_at=now() where id=%s and (%s::uuid is null or tenant_id=%s)",
            (requirement_id, tenant_id, tenant_id),
        )
        conn.commit()
    return visible_matches


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
    title_terms = _field_list(profile.get("title")) + _field_list(profile.get("role_intent"))
    responsibility_terms = _field_list(profile.get("responsibilities"))[:8]
    has_role_terms = bool(title_terms or responsibility_terms)
    domain_text = _domain_text(candidate)
    must_hits = [item for item in must if _requirement_item_hit(item, candidate_text, domain_text)]
    nice_hits = [item for item in nice if _requirement_item_hit(item, candidate_text, domain_text)]
    must_score = len(must_hits) / len(must) if must else 1.0
    nice_score = len(nice_hits) / len(nice) if nice else 1.0
    role_score = _term_group_score([*title_terms, *responsibility_terms], candidate_text, default=1.0)

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
    seniority_score = _seniority_score(profile, candidate_text)
    recency_score = _recency_score(profile, candidate)
    has_recency_terms = bool(_recall_terms(profile, ""))
    notes_hits = _notes_relevance(profile, candidate)
    notes_score = 1.0 if notes_hits else 0.65

    weights = _dynamic_match_weights(profile, must, nice, min_years, required_domains, scored_locations, title_terms, profile.get("seniority"))
    total = (
        (must_score * weights.get("must_have", 0))
        + (nice_score * weights.get("nice_to_have", 0))
        + (role_score * weights.get("role", 0))
        + (years_score * weights.get("years", 0))
        + (domain_score * weights.get("domain", 0))
        + (location_score * weights.get("location", 0))
        + (seniority_score * weights.get("seniority", 0))
        + (recency_score * weights.get("recency", 0))
        + (notes_score * weights.get("notes", 0))
    )
    gaps = {
        "missing_must_haves": [item for item in must if item not in must_hits],
        "missing_nice_to_haves": [item for item in nice if item not in nice_hits],
        "years_gap": max(0, float(min_years or 0) - float(candidate_years)),
        "missing_domains": [item for item in required_domains if item not in domain_hits],
        "missing_locations": [item for item in required_locations if item not in location_hits],
        "missing_preferred_locations": [item for item in preferred_locations if item not in preferred_location_hits],
        "unclear_signals": _unclear_match_signals(profile, candidate, location_score, notes_hits),
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
        "role_score": role_score,
        "role_terms_present": has_role_terms,
        "seniority_score": seniority_score,
        "recency_score": recency_score,
        "recency_terms_present": has_recency_terms,
        "notes_relevance": notes_hits,
        "notes_score": notes_score,
        "score_weights": weights,
        "match_explanation": _score_explanation(
            must_score,
            nice_score,
            years_score,
            domain_score,
            location_score,
            weights,
            role_score=role_score,
            seniority_score=seniority_score,
            recency_score=recency_score,
            notes_score=notes_score,
        ),
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


def _broad_recall_candidate_ids(
    profile: dict[str, Any],
    requirement_text: str,
    semantic_scores: dict[str, dict[str, Any]],
    tenant_id: str | None,
    extra_candidate_ids: list[str] | None = None,
) -> list[str]:
    """Retrieve a broad but bounded candidate set before the expensive judge pass."""

    ordered_ids: list[str] = [str(item) for item in (extra_candidate_ids or []) if item]
    ordered_ids.extend(_structured_recall_candidate_ids(profile, tenant_id, STRUCTURED_RECALL_LIMIT))
    ordered_ids.extend(str(candidate_id) for candidate_id in semantic_scores.keys())
    terms = _recall_terms(profile, requirement_text)
    if not terms:
        return _dedupe_ids(ordered_ids)[:RECALL_LIMIT]
    patterns = [f"%{term[:96]}%" for term in terms[:40] if len(term) >= 3]
    if not patterns:
        return _dedupe_ids(ordered_ids)[:RECALL_LIMIT]
    with db() as conn:
        if tenant_id:
            chunk_rows = conn.execute(
                """
                select document_id, count(*) as hit_count
                from candidate_search_chunks
                where tenant_id=%s and chunk_text ilike any(%s::text[])
                group by document_id
                order by hit_count desc
                limit %s
                """,
                (tenant_id, patterns, LEXICAL_RECALL_LIMIT),
            ).fetchall()
            candidate_rows = conn.execute(
                """
                select document_id
                from candidates
                where tenant_id=%s
                  and deleted_at is null
                  and (raw_text ilike any(%s::text[]) or record_json::text ilike any(%s::text[]))
                order by updated_at desc
                limit %s
                """,
                (tenant_id, patterns, patterns, LEXICAL_RECALL_LIMIT),
            ).fetchall()
        else:
            chunk_rows = conn.execute(
                """
                select document_id, count(*) as hit_count
                from candidate_search_chunks
                where chunk_text ilike any(%s::text[])
                group by document_id
                order by hit_count desc
                limit %s
                """,
                (patterns, LEXICAL_RECALL_LIMIT),
            ).fetchall()
            candidate_rows = conn.execute(
                """
                select document_id
                from candidates
                where deleted_at is null
                  and (raw_text ilike any(%s::text[]) or record_json::text ilike any(%s::text[]))
                order by updated_at desc
                limit %s
                """,
                (patterns, patterns, LEXICAL_RECALL_LIMIT),
            ).fetchall()
    ordered_ids.extend(str(row["document_id"]) for row in chunk_rows)
    ordered_ids.extend(str(row["document_id"]) for row in candidate_rows)
    return _dedupe_ids(ordered_ids)[:RECALL_LIMIT]


def _structured_recall_candidate_ids(profile: dict[str, Any], tenant_id: str | None, limit: int) -> list[str]:
    """Cheap indexed-ish recall from normalized candidate tables before semantic/LLM work."""

    if not tenant_id:
        return []
    skill_terms = _recall_skill_terms(profile)
    role_terms = _recall_role_terms(profile)
    domain_terms = [_canonical_domain(item) for item in _field_list(profile.get("domains")) if item]
    location_terms = [
        *_field_list(profile.get("required_locations")),
        *_field_list(profile.get("required_countries")),
        *_field_list(profile.get("preferred_locations")),
        *_field_list(profile.get("location_preference")),
    ]
    ordered: list[str] = []
    with db() as conn:
        skill_patterns = _like_patterns(skill_terms)
        if skill_patterns:
            rows = conn.execute(
                """
                select candidate_skills.document_id, count(*) as hit_count
                from candidate_skills
                join candidates on candidates.document_id=candidate_skills.document_id
                  and candidates.tenant_id=candidate_skills.tenant_id
                  and candidates.deleted_at is null
                where candidate_skills.tenant_id=%s
                  and lower(candidate_skills.skill) like any(%s::text[])
                group by candidate_skills.document_id
                order by hit_count desc
                limit %s
                """,
                (tenant_id, skill_patterns, limit),
            ).fetchall()
            ordered.extend(str(row["document_id"]) for row in rows)

        role_patterns = _like_patterns(role_terms)
        if role_patterns:
            rows = conn.execute(
                """
                select candidate_experience.document_id, min(candidate_experience.sort_index) as best_position, count(*) as hit_count
                from candidate_experience
                join candidates on candidates.document_id=candidate_experience.document_id
                  and candidates.tenant_id=candidate_experience.tenant_id
                  and candidates.deleted_at is null
                where candidate_experience.tenant_id=%s
                  and candidate_experience.sort_index <= 3
                  and lower(concat_ws(' ', candidate_experience.title, candidate_experience.company)) like any(%s::text[])
                group by candidate_experience.document_id
                order by best_position asc, hit_count desc
                limit %s
                """,
                (tenant_id, role_patterns, limit),
            ).fetchall()
            ordered.extend(str(row["document_id"]) for row in rows)

        if domain_terms:
            rows = conn.execute(
                """
                select candidate_domain_years.document_id, max(candidate_domain_years.years) as years
                from candidate_domain_years
                join candidates on candidates.document_id=candidate_domain_years.document_id
                  and candidates.tenant_id=candidate_domain_years.tenant_id
                  and candidates.deleted_at is null
                where candidate_domain_years.tenant_id=%s
                  and candidate_domain_years.domain = any(%s::text[])
                  and candidate_domain_years.years > 0
                group by candidate_domain_years.document_id
                order by years desc
                limit %s
                """,
                (tenant_id, domain_terms, limit),
            ).fetchall()
            ordered.extend(str(row["document_id"]) for row in rows)

        location_patterns = _like_patterns(location_terms)
        if location_patterns:
            rows = conn.execute(
                """
                select candidate_locations.document_id, count(*) as hit_count
                from candidate_locations
                join candidates on candidates.document_id=candidate_locations.document_id
                  and candidates.tenant_id=candidate_locations.tenant_id
                  and candidates.deleted_at is null
                where candidate_locations.tenant_id=%s
                  and (
                    lower(candidate_locations.location) like any(%s::text[])
                    or lower(coalesce(candidate_locations.country, '')) like any(%s::text[])
                  )
                group by candidate_locations.document_id
                order by hit_count desc
                limit %s
                """,
                (tenant_id, location_patterns, location_patterns, limit),
            ).fetchall()
            ordered.extend(str(row["document_id"]) for row in rows)
    return _dedupe_ids(ordered)[:limit]


def _recall_skill_terms(profile: dict[str, Any]) -> list[str]:
    terms = [*_field_list(profile.get("must_have_skills")), *_field_list(profile.get("nice_to_have_skills"))]
    for item in list(terms):
        terms.extend(_aliases_for_item(_norm(item)))
    return _dedupe_text(terms)


def _recall_role_terms(profile: dict[str, Any]) -> list[str]:
    terms = [
        *_field_list(profile.get("title")),
        *_field_list(profile.get("role_intent")),
        *_field_list(profile.get("seniority")),
        *_field_list(profile.get("responsibilities"))[:6],
    ]
    return _dedupe_text(terms)


def _like_patterns(values: list[str]) -> list[str]:
    patterns = []
    for value in values:
        normalized = _norm(value)
        if len(normalized) < 3 or normalized in MATCH_STOPWORDS:
            continue
        patterns.append(f"%{normalized[:80]}%")
    return _dedupe_text(patterns)[:40]


def _recall_terms(profile: dict[str, Any], requirement_text: str) -> list[str]:
    raw_terms: list[str] = []
    for key in (
        "title",
        "role_intent",
        "seniority",
        "work_authorization",
    ):
        raw_terms.extend(_field_list(profile.get(key)))
    for key in (
        "must_have_skills",
        "nice_to_have_skills",
        "domains",
        "industry_preferences",
        "required_locations",
        "preferred_locations",
        "location_preference",
        "required_countries",
        "responsibilities",
        "soft_preferences",
        "hidden_intent",
    ):
        raw_terms.extend(_field_list(profile.get(key)))
    for domain in _field_list(profile.get("domains")):
        raw_terms.extend(DOMAIN_ALIASES.get(_canonical_domain(domain), []))
    for item in list(raw_terms):
        raw_terms.extend(_aliases_for_item(_norm(item)))
    phrase_terms = [
        term.strip()
        for term in raw_terms
        if 3 <= len(term.strip()) <= 96 and not term.strip().isdigit()
    ]
    if len(phrase_terms) < 12:
        normalized_requirement = _norm(requirement_text)
        phrase_terms.extend(
            token
            for token in _meaningful_tokens(normalized_requirement)
            if len(token) >= 4 and token not in MATCH_STOPWORDS
        )
    return _dedupe_text(phrase_terms)[:50]


def _apply_llm_match_judgement(
    matches: list[dict[str, Any]],
    profile: dict[str, Any],
    requirement_text: str,
    tenant_id: str | None,
) -> None:
    """Apply an evidence-grounded LLM judgement pass to the top recalled candidates."""

    if not matches:
        return
    judged_matches = [
        match
        for match in matches
        if match.get("hard_filter_pass", True)
        and float(match.get("total_score") or 0) >= LLM_JUDGE_MIN_SCORE
        and _has_core_match_signal(match)
    ][:LLM_JUDGE_LIMIT]
    skipped_count = max(0, len(matches) - len(judged_matches))
    if not judged_matches:
        for match in matches[:LLM_JUDGE_LIMIT]:
            match.setdefault("evidence", {})["llm_judge"] = {"status": "skipped_no_plausible_candidates"}
        return
    judged_ids = {str(match.get("candidate_id")) for match in judged_matches}
    for match in matches:
        if str(match.get("candidate_id")) not in judged_ids:
            match.setdefault("evidence", {})["llm_judge"] = {
                "status": "skipped_deterministic_prescreen",
                "reason": f"Below LLM judge threshold or missing core evidence; {skipped_count} candidates skipped before LLM.",
            }
    settings = load_settings()
    if not settings.llm_api_key:
        for match in judged_matches:
            match.setdefault("evidence", {})["llm_judge"] = {"status": "skipped_no_llm_api_key"}
        return
    candidate_packets = [_candidate_llm_packet(match, profile) for match in judged_matches]
    try:
        judgement, usage = judge_requirement_candidate_matches(
            requirement_profile=profile,
            requirement_text=redact_contact_pii_text(requirement_text),
            candidates=candidate_packets,
            settings=settings,
        )
    except Exception as exc:
        for match in judged_matches:
            match.setdefault("evidence", {})["llm_judge"] = {
                "status": "failed",
                "error": f"{exc.__class__.__name__}: {str(exc)[:220]}",
            }
        return

    judgements = {
        str(item.get("candidate_id")): item
        for item in judgement.get("candidate_judgements") or []
        if item.get("candidate_id")
    }
    calibration = judgement.get("pairwise_calibration") or {}
    rank_order = [str(item) for item in calibration.get("rank_order") or []]
    rank_index = {candidate_id: index for index, candidate_id in enumerate(rank_order)}
    for match in judged_matches:
        candidate_id = str(match.get("candidate_id"))
        item = judgements.get(candidate_id)
        if not item:
            continue
        llm_score = _score_value(item.get("llm_score"))
        preliminary = _score_value(match.get("total_score"))
        rank_boost = 0.0
        if candidate_id in rank_index and rank_order:
            rank_boost = max(0.0, (len(rank_order) - rank_index[candidate_id] - 1) / max(1, len(rank_order))) * 0.03
        final_score = min(1.0, max(0.0, (preliminary * 0.55) + (llm_score * 0.45) + rank_boost))
        evidence = match.setdefault("evidence", {})
        evidence["llm_judge"] = item | {
            "status": "completed",
            "preliminary_score": round(preliminary, 3),
            "llm_score": round(llm_score, 3),
            "calibration_boost": round(rank_boost, 3),
        }
        evidence["fit_type"] = item.get("fit_type")
        evidence["would_recruiter_call"] = bool(item.get("would_recruiter_call"))
        evidence["pairwise_calibration"] = calibration
        evidence.setdefault("score_weights", {})["llm_judge"] = 0.45
        evidence["llm_usage"] = usage
        match["total_score"] = round(final_score, 3)
        if item.get("recommended_action"):
            match["recommendation"] = str(item["recommended_action"])[:500]
        if item.get("missing_or_unclear"):
            match.setdefault("gaps", {})["llm_missing_or_unclear"] = _string_list(item.get("missing_or_unclear"))[:8]
        match["llm_score"] = round(llm_score, 3)
    matches.sort(key=lambda item: item["total_score"], reverse=True)


def _deterministic_match_pool(matches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep only plausible candidates before any LLM spend."""

    plausible: list[dict[str, Any]] = []
    backups: list[dict[str, Any]] = []
    for match in matches:
        score = float(match.get("total_score") or 0)
        if not match.get("hard_filter_pass", True):
            continue
        if score >= 0.45 and _has_core_match_signal(match):
            plausible.append(match)
        elif score >= 0.40:
            backups.append(match)
    pool = plausible or backups
    for match in pool:
        match.setdefault("evidence", {})["deterministic_prescreen"] = {
            "status": "passed",
            "score_before_llm": match.get("total_score"),
            "core_signal": _core_match_signal_reasons(match),
        }
    return pool[:DETERMINISTIC_SCORE_POOL_LIMIT]


def _has_core_match_signal(match: dict[str, Any]) -> bool:
    evidence = match.get("evidence") or {}
    return bool(
        evidence.get("must_have_hits")
        or evidence.get("nice_to_have_hits")
        or evidence.get("domain_hits")
        or evidence.get("notes_relevance")
        or float(match.get("semantic_score") or 0) >= 0.58
        or (evidence.get("role_terms_present") and float(evidence.get("role_score") or 0) >= 0.74)
        or (evidence.get("recency_terms_present") and float(evidence.get("recency_score") or 0) >= 0.82)
    )


def _core_match_signal_reasons(match: dict[str, Any]) -> list[str]:
    evidence = match.get("evidence") or {}
    reasons: list[str] = []
    if evidence.get("must_have_hits"):
        reasons.append("must-have evidence")
    if evidence.get("nice_to_have_hits"):
        reasons.append("nice-to-have evidence")
    if evidence.get("domain_hits"):
        reasons.append("domain evidence")
    if float(match.get("semantic_score") or 0) >= 0.58:
        reasons.append("semantic evidence")
    if evidence.get("role_terms_present") and float(evidence.get("role_score") or 0) >= 0.74:
        reasons.append("role relevance")
    if evidence.get("recency_terms_present") and float(evidence.get("recency_score") or 0) >= 0.82:
        reasons.append("recent experience")
    if evidence.get("notes_relevance"):
        reasons.append("recruiter notes")
    return reasons or ["weak signal"]


def _candidate_llm_packet(match: dict[str, Any], profile: dict[str, Any]) -> dict[str, Any]:
    candidate = match.get("_candidate_record") or {}
    raw_text = str(match.get("_raw_text") or "")
    candidate_name = str(candidate.get("name") or "")
    final_profile = (candidate.get("candidate_intelligence") or {}).get("final_candidate_profile") or {}
    summary_card = final_profile.get("summary_card") or {}
    hr_profile = candidate.get("derived", {}).get("hr_profile") or {}
    location_intelligence = candidate.get("derived", {}).get("location_intelligence") or {}
    terms = _recall_terms(profile, "")
    snippets = _redacted_snippets(
        [
            *[
                str(item.get("snippet") or "")
                for item in (match.get("evidence") or {}).get("semantic_evidence") or []
                if isinstance(item, dict)
            ],
            *_raw_text_hits(raw_text, terms),
        ],
        names=[candidate_name],
    )
    return {
        "candidate_id": match.get("candidate_id"),
        "candidate_summary": {
            "name_redacted": "[candidate]",
            "current_title": hr_profile.get("current_title") or summary_card.get("current_or_target_title"),
            "current_company": hr_profile.get("current_company"),
            "current_location": location_intelligence.get("current_location") or (candidate.get("contact") or {}).get("location"),
            "total_years_experience": hr_profile.get("total_years_experience"),
            "seniority": hr_profile.get("seniority_level") or summary_card.get("seniority_read"),
            "summary": _redact_short(candidate.get("summary") or summary_card.get("headline"), names=[candidate_name]),
        },
        "skills": _string_list(candidate.get("skills"))[:40],
        "experience": _experience_packet(candidate, names=[candidate_name]),
        "education": _education_packet(candidate, names=[candidate_name]),
        "domains": candidate.get("derived", {}).get("experience_by_domain") or {},
        "countries_locations": {
            "countries": candidate.get("derived", {}).get("countries_associated") or [],
            "location_intelligence": location_intelligence,
        },
        "recruiter_notes": _redacted_snippets([note.get("content", "") for note in candidate.get("notes") or []], names=[candidate_name])[:6],
        "preliminary_scores": {
            "total": match.get("total_score"),
            "structured": match.get("rule_score"),
            "semantic": match.get("semantic_score"),
            "must_have": match.get("must_have_score"),
            "nice_to_have": match.get("nice_to_have_score"),
            "years": match.get("years_score"),
            "domain": match.get("domain_score"),
            "location": match.get("location_score"),
        },
        "preliminary_evidence": {
            "hits": {
                "must_have": (match.get("evidence") or {}).get("must_have_hits") or [],
                "nice_to_have": (match.get("evidence") or {}).get("nice_to_have_hits") or [],
                "domains": (match.get("evidence") or {}).get("domain_hits") or [],
                "locations": (match.get("evidence") or {}).get("location_hits") or [],
            },
            "gaps": match.get("gaps") or {},
            "semantic_snippets": snippets[:8],
        },
    }


def _experience_packet(candidate: dict[str, Any], *, names: list[str]) -> list[dict[str, Any]]:
    rows = []
    for item in (candidate.get("experience") or [])[:8]:
        if not isinstance(item, dict):
            continue
        bullets = _string_list(item.get("bullets"))[:4]
        rows.append({
            "company": item.get("company"),
            "title": item.get("title"),
            "dates": item.get("dates") or item.get("date"),
            "location": item.get("location"),
            "bullets": [_redact_short(bullet, names=names, limit=260) for bullet in bullets],
            "workstreams": _redacted_snippets([_flatten_text(item.get("workstreams") or [])], names=names)[:3],
        })
    return rows


def _education_packet(candidate: dict[str, Any], *, names: list[str]) -> list[dict[str, Any]]:
    rows = []
    for item in (candidate.get("education") or [])[:5]:
        if not isinstance(item, dict):
            continue
        rows.append({
            "school": _redact_short(item.get("school"), names=names, limit=120),
            "degree": item.get("degree"),
            "field": item.get("field"),
            "date": item.get("date") or item.get("dates"),
        })
    return rows


def _raw_text_hits(raw_text: str, terms: list[str]) -> list[str]:
    flattened = re.sub(r"\s+", " ", raw_text or "").strip()
    if not flattened:
        return []
    lowered = flattened.lower()
    snippets: list[str] = []
    for term in terms[:18]:
        normalized = term.lower().strip()
        if len(normalized) < 3:
            continue
        index = lowered.find(normalized)
        if index < 0:
            continue
        start = max(0, index - 140)
        end = min(len(flattened), index + len(normalized) + 220)
        snippets.append(flattened[start:end])
    return _dedupe_text(snippets)[:10]


def _redacted_snippets(values: list[Any], *, names: list[str] | None = None) -> list[str]:
    result = []
    for value in values:
        text = _redact_short(value, names=names, limit=420)
        if text:
            result.append(text)
    return _dedupe_text(result)


def _redact_short(value: Any, *, names: list[str] | None = None, limit: int = 420) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if not text:
        return ""
    return redact_contact_pii_text(text[:limit], names=names)


def _term_group_score(terms: list[str], candidate_text: str, *, default: float = 1.0) -> float:
    normalized_terms = _dedupe_text([term for term in terms if str(term).strip()])
    if not normalized_terms:
        return default
    hits = sum(1 for term in normalized_terms if _requirement_item_hit(term, candidate_text))
    if not hits:
        return 0.55
    coverage = hits / len(normalized_terms)
    return max(0.55, min(1.0, coverage))


def _seniority_score(profile: dict[str, Any], candidate_text: str) -> float:
    seniority = _norm(str(profile.get("seniority") or ""))
    if not seniority:
        return 1.0
    levels = {
        "intern": ["intern", "trainee"],
        "junior": ["junior", "associate", "entry"],
        "mid": ["mid", "engineer", "developer", "analyst", "consultant"],
        "senior": ["senior", "sr", "lead", "principal", "staff", "architect", "manager"],
        "lead": ["lead", "principal", "staff", "architect", "manager", "director", "head"],
        "manager": ["manager", "director", "head", "lead"],
        "director": ["director", "head", "vp", "vice president"],
    }
    requested = next((key for key in levels if key in seniority), seniority)
    aliases = levels.get(requested, [requested])
    if any(_norm(alias) in candidate_text for alias in aliases):
        return 1.0
    if requested in {"senior", "lead", "manager", "director"} and any(term in candidate_text for term in ("senior", "lead", "architect", "principal", "staff", "manager", "director")):
        return 0.82
    return 0.65


def _recency_score(profile: dict[str, Any], candidate: dict[str, Any]) -> float:
    terms = _recall_terms(profile, "")[:20]
    if not terms:
        return 1.0
    experience = candidate.get("experience") or []
    latest = experience[:2]
    latest_text = _norm(
        " ".join(
            " ".join(filter(None, [
                item.get("company") if isinstance(item, dict) else "",
                item.get("title") if isinstance(item, dict) else "",
                " ".join(item.get("bullets") or []) if isinstance(item, dict) else "",
                _flatten_text(item.get("workstreams") or []) if isinstance(item, dict) else "",
            ]))
            for item in latest
            if isinstance(item, dict)
        )
    )
    if not latest_text:
        return 0.7
    hits = sum(1 for term in terms if _requirement_item_hit(term, latest_text))
    if hits >= 3:
        return 1.0
    if hits:
        return 0.82
    return 0.62


def _unclear_match_signals(profile: dict[str, Any], candidate: dict[str, Any], location_score: float, notes_hits: list[str]) -> list[str]:
    signals: list[str] = []
    locations = [
        *_field_list(profile.get("required_locations")),
        *_field_list(profile.get("required_countries")),
        *_field_list(profile.get("preferred_locations")),
        *_field_list(profile.get("location_preference")),
    ]
    if locations and location_score <= 0:
        signals.append("Location preference or requirement was not confirmed in candidate evidence.")
    if profile.get("min_years_experience") and not candidate.get("derived", {}).get("hr_profile", {}).get("total_years_experience"):
        signals.append("Total years could not be confidently derived from the candidate profile.")
    if [*profile.get("must_have_skills", []), *profile.get("nice_to_have_skills", [])] and not notes_hits:
        signals.append("No recruiter-note evidence matched this requirement yet.")
    return signals


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


def _persist_matches(
    requirement_id: str,
    matches: list[dict[str, Any]],
    tenant_id: str | None,
    *,
    replace_all: bool = True,
    candidate_scope_ids: list[str] | None = None,
) -> None:
    visible_candidate_ids = [str(match["candidate_id"]) for match in matches]
    scope_ids = [str(candidate_id) for candidate_id in (candidate_scope_ids or []) if candidate_id]
    with db() as conn:
        if replace_all and visible_candidate_ids:
            conn.execute(
                """
                delete from requirement_matches
                where requirement_id=%s
                  and (%s::uuid is null or tenant_id=%s)
                  and not (candidate_id = any(%s::text[]))
                """,
                (requirement_id, tenant_id, tenant_id, visible_candidate_ids),
            )
        elif replace_all:
            conn.execute(
                """
                delete from requirement_matches
                where requirement_id=%s
                  and (%s::uuid is null or tenant_id=%s)
                """,
                (requirement_id, tenant_id, tenant_id),
            )
        elif scope_ids and visible_candidate_ids:
            conn.execute(
                """
                delete from requirement_matches
                where requirement_id=%s
                  and (%s::uuid is null or tenant_id=%s)
                  and candidate_id = any(%s::text[])
                  and not (candidate_id = any(%s::text[]))
                """,
                (requirement_id, tenant_id, tenant_id, scope_ids, visible_candidate_ids),
            )
        elif scope_ids:
            conn.execute(
                """
                delete from requirement_matches
                where requirement_id=%s
                  and (%s::uuid is null or tenant_id=%s)
                  and candidate_id = any(%s::text[])
                """,
                (requirement_id, tenant_id, tenant_id, scope_ids),
            )
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
        "location": candidate_current_location(candidate),
        "countries": countries_for_search(candidate),
        "note_signals": _candidate_note_signal_items(candidate),
        "total_years_experience": hr.get("total_years_experience"),
        "seniority": hr.get("seniority_level"),
    }


def _candidate_note_signal_items(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    signals = candidate.get("derived", {}).get("recruiter_note_signals") or {}
    if isinstance(signals.get("signals"), list):
        return [item for item in signals["signals"] if isinstance(item, dict)][:12]
    grouped = signals.get("by_category") if isinstance(signals, dict) else {}
    items: list[dict[str, Any]] = []
    if isinstance(grouped, dict):
        for category, values in grouped.items():
            if not isinstance(values, list):
                continue
            for value in values:
                if isinstance(value, dict):
                    items.append({"category": category, **value})
    return items[:12]


def _candidate_text(candidate: dict[str, Any], raw_text: str = "") -> str:
    location_intelligence = candidate.get("derived", {}).get("location_intelligence", {})
    return _norm(" ".join([
        candidate.get("name") or "",
        candidate.get("summary") or "",
        raw_text or "",
        " ".join(candidate.get("skills") or []),
        " ".join(candidate.get("certifications") or []),
        " ".join(note.get("content", "") for note in candidate.get("notes") or []),
        _flatten_text(candidate.get("derived", {}).get("recruiter_note_signals")),
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
    terms = [
        _norm(item)
        for item in [
            *_field_list(profile.get("must_have_skills")),
            *_field_list(profile.get("nice_to_have_skills")),
            *_field_list(profile.get("work_authorization")),
            *_field_list(profile.get("location_preference")),
            *_field_list(profile.get("required_locations")),
            *_field_list(profile.get("required_countries")),
        ]
        if item
    ]
    hits = []
    for note in candidate.get("notes") or []:
        note_text = _norm(note.get("content", ""))
        if any(term in note_text for term in terms):
            hits.append(note.get("name") or "note")
    signal_text = _norm(_flatten_text(candidate.get("derived", {}).get("recruiter_note_signals")))
    if signal_text and any(term in signal_text for term in terms):
        hits.append("structured recruiter note signal")
    return hits


def _hard_filter_failures(profile: dict[str, Any], gaps: dict[str, Any], candidate_text: str, candidate_years: float, min_years: Any) -> list[str]:
    failures: list[str] = []
    if _strict_profile_flag(profile, "strict_must_haves", "must_haves_required", "must_have_required"):
        failures.extend(f"Missing must-have: {item}" for item in gaps.get("missing_must_haves", []))
    if min_years and gaps.get("years_gap", 0) > 0 and _strict_profile_flag(profile, "strict_min_years", "minimum_years_required"):
        failures.append(f"Below minimum years: has {round(float(candidate_years), 1)}, needs {min_years}")
    failures.extend(f"Missing required location/country: {item}" for item in gaps.get("missing_locations", []))
    for item in _active_dealbreakers(profile):
        if item and _requirement_item_hit(str(item), candidate_text):
            failures.append(f"Dealbreaker present: {item}")
    work_authorization = profile.get("work_authorization")
    if _requires_work_authorization_check(work_authorization) and not _requirement_item_hit(str(work_authorization), candidate_text):
        failures.append(f"Work authorization not confirmed: {work_authorization}")
    return failures


def _strict_profile_flag(profile: dict[str, Any], *keys: str) -> bool:
    for key in keys:
        value = profile.get(key)
        if isinstance(value, bool):
            return value
        if isinstance(value, str) and value.strip().lower() in {"1", "true", "yes", "required", "hard"}:
            return True
    return False


def _dynamic_match_weights(
    profile: dict[str, Any],
    must: list[str],
    nice: list[str],
    min_years: Any,
    required_domains: list[str],
    scored_locations: list[str],
    title_terms: list[str] | None = None,
    seniority: Any = None,
) -> dict[str, float]:
    custom_weights = _custom_match_weights(profile, must, nice)
    if custom_weights:
        return custom_weights
    desired: dict[str, float] = {}
    if must:
        desired["must_have"] = 0.28
    if nice:
        desired["nice_to_have"] = 0.10
    if title_terms or profile.get("role_intent") or profile.get("responsibilities"):
        desired["role"] = 0.18
    if min_years:
        desired["years"] = 0.12
    if required_domains:
        desired["domain"] = 0.14
    if scored_locations:
        desired["location"] = 0.08
    if seniority:
        desired["seniority"] = 0.07
    if profile.get("responsibilities") or profile.get("role_intent") or must:
        desired["recency"] = 0.08
    desired["notes"] = 0.03
    if not desired:
        return {
            "must_have": 0.0,
            "nice_to_have": 0.0,
            "role": 0.42,
            "years": 0.0,
            "domain": 0.0,
            "location": 0.0,
            "seniority": 0.0,
            "recency": 0.35,
            "notes": 0.23,
        }
    total = sum(desired.values()) or 1.0
    normalized = {key: round(value / total, 3) for key, value in desired.items()}
    for key in ("must_have", "nice_to_have", "role", "years", "domain", "location", "seniority", "recency", "notes"):
        normalized.setdefault(key, 0.0)
    return normalized


def _custom_match_weights(profile: dict[str, Any], must: list[str], nice: list[str]) -> dict[str, float]:
    raw = profile.get("score_weights")
    if not isinstance(raw, dict):
        return {}
    skills_weight = _score_value(raw.get("skills") or raw.get("skill_fit"))
    desired = {
        "role": _score_value(raw.get("role") or raw.get("role_relevance")),
        "domain": _score_value(raw.get("domain")),
        "years": _score_value(raw.get("years")),
        "location": _score_value(raw.get("location")),
        "recency": _score_value(raw.get("recency")),
        "seniority": _score_value(raw.get("seniority")),
        "notes": _score_value(raw.get("notes") or raw.get("recruiter_notes")),
    }
    if skills_weight:
        if must and nice:
            desired["must_have"] = skills_weight * 0.7
            desired["nice_to_have"] = skills_weight * 0.3
        elif must:
            desired["must_have"] = skills_weight
            desired["nice_to_have"] = 0.0
        elif nice:
            desired["must_have"] = 0.0
            desired["nice_to_have"] = skills_weight
    else:
        desired["must_have"] = _score_value(raw.get("must_have"))
        desired["nice_to_have"] = _score_value(raw.get("nice_to_have"))
    desired = {key: value for key, value in desired.items() if value > 0}
    if not desired:
        return {}
    total = sum(desired.values()) or 1.0
    normalized = {key: round(value / total, 3) for key, value in desired.items()}
    for key in ("must_have", "nice_to_have", "role", "years", "domain", "location", "seniority", "recency", "notes"):
        normalized.setdefault(key, 0.0)
    return normalized


def _semantic_weight(profile: dict[str, Any]) -> float:
    populated = sum(
        1
        for value in (
            profile.get("must_have_skills"),
            profile.get("nice_to_have_skills"),
            profile.get("min_years_experience"),
            profile.get("domains"),
            profile.get("preferred_locations") or profile.get("location_preference") or profile.get("required_locations"),
        )
        if _profile_value_present(value)
    )
    if populated <= 1:
        return 0.42
    if populated == 2:
        return 0.34
    return 0.26


def _profile_value_present(value: Any) -> bool:
    if isinstance(value, (int, float)):
        return value > 0
    return bool(_field_list(value))


def _score_explanation(
    must_score: float,
    nice_score: float,
    years_score: float,
    domain_score: float,
    location_score: float,
    weights: dict[str, float],
    *,
    role_score: float = 1.0,
    seniority_score: float = 1.0,
    recency_score: float = 1.0,
    notes_score: float = 1.0,
) -> list[str]:
    rows = [
        ("Must-have", must_score, weights.get("must_have", 0)),
        ("Nice-to-have", nice_score, weights.get("nice_to_have", 0)),
        ("Role relevance", role_score, weights.get("role", 0)),
        ("Years", years_score, weights.get("years", 0)),
        ("Domain", domain_score, weights.get("domain", 0)),
        ("Location", location_score, weights.get("location", 0)),
        ("Seniority", seniority_score, weights.get("seniority", 0)),
        ("Recent evidence", recency_score, weights.get("recency", 0)),
        ("Recruiter notes", notes_score, weights.get("notes", 0)),
    ]
    return [
        f"{label}: {round(score * 100)}% match with {round(weight * 100)}% weight"
        for label, score, weight in rows
        if weight > 0
    ]


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


def _score_value(value: Any) -> float:
    try:
        score = float(value or 0)
    except (TypeError, ValueError):
        return 0.0
    if score > 1:
        score = score / 100
    return max(0.0, min(1.0, score))


def _string_list(value: Any) -> list[str]:
    if isinstance(value, str):
        return [item.strip() for item in re.split(r"[\n,;]+", value) if item.strip()]
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _dedupe_text(values: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = re.sub(r"\s+", " ", str(value or "")).strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(text)
    return result


def _dedupe_ids(values: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        item = str(value or "").strip()
        if not item or item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def _norm(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9#+. ]", " ", value.lower())).strip()


def _requirement_text(profile: dict[str, Any], original_text: str) -> str:
    return " ".join(
        [
            original_text,
            str(profile.get("title") or ""),
            str(profile.get("role_intent") or ""),
            " ".join(profile.get("must_have_skills") or []),
            " ".join(profile.get("nice_to_have_skills") or []),
            " ".join(profile.get("domains") or []),
            " ".join(profile.get("industry_preferences") or []),
            " ".join(_field_list(profile.get("preferred_locations"))),
            " ".join(_field_list(profile.get("location_preference"))),
            " ".join(profile.get("responsibilities") or []),
            " ".join(profile.get("soft_preferences") or []),
            " ".join(profile.get("hidden_intent") or []),
            " ".join(profile.get("dealbreakers") or []),
        ]
    )
