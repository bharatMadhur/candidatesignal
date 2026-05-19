from __future__ import annotations

import re
from typing import Any

from .db_store import list_candidates_db
from .vector_search import semantic_candidate_search


COPILOT_STOPWORDS = {
    "about",
    "candidate",
    "candidates",
    "company",
    "experience",
    "find",
    "for",
    "from",
    "have",
    "need",
    "people",
    "person",
    "profile",
    "profiles",
    "resume",
    "resumes",
    "show",
    "that",
    "the",
    "with",
    "work",
    "worked",
    "working",
}


def build_copilot_answer(message: str, results: list[dict]) -> str:
    if not results:
        return (
            "I did not find a strong candidate match in this company workspace. "
            "Try adding required skills, target years, location, seniority, or a domain phrase from the job requirement."
        )
    top = results[:3]
    lines = [
        f"I found {len(results)} tenant-scoped candidate match{'es' if len(results) != 1 else ''} for: {message}",
        "Strongest matches:",
    ]
    for index, candidate in enumerate(top, start=1):
        name = candidate.get("name") or "Unnamed candidate"
        title = candidate.get("current_title") or "No current title"
        company = candidate.get("current_company") or "No current company"
        score = candidate.get("semantic_score")
        evidence = candidate.get("evidence") or []
        snippet = ""
        if evidence:
            snippet = evidence[0].get("snippet") or evidence[0].get("chunk_text") or ""
        score_text = f"{score:.2f}" if isinstance(score, int | float) else "n/a"
        line = f"{index}. {name} - {title} at {company}. Search score: {score_text}."
        if snippet:
            line += f" Evidence: {snippet[:220]}"
        lines.append(line)
    lines.append(
        "Use these hits as evidence. For a hiring decision, finalize a requirement and run the matching workflow "
        "so hard filters, years fit, gaps, and recruiter notes are scored."
    )
    return "\n".join(lines)


def copilot_candidate_results(message: str, tenant_id: str, limit: int) -> list[dict]:
    pool_limit = max(limit * 4, 25)
    raw_results = semantic_candidate_search(message, pool_limit, tenant_id=tenant_id)
    structured_results = copilot_structured_candidate_results(message, tenant_id, pool_limit)
    raw_results = merge_copilot_candidate_results(raw_results, structured_results)
    terms = significant_query_terms(message)
    promoted = [promote_direct_evidence(candidate, terms) for candidate in raw_results]
    ranked = rank_and_filter_copilot_candidates(message, promoted)
    return apply_copilot_direct_evidence_policy(message, terms, ranked)[:limit]


def significant_query_terms(message: str) -> list[str]:
    terms = []
    for token in re.findall(r"[a-z0-9][a-z0-9+#.-]{2,}", message.lower()):
        cleaned = token.strip(".-")
        if len(cleaned) < 3 or cleaned in COPILOT_STOPWORDS:
            continue
        terms.append(cleaned)
    return list(dict.fromkeys(terms))


def copilot_structured_candidate_results(message: str, tenant_id: str, limit: int) -> list[dict]:
    intent = copilot_query_intent(message)
    candidates = []
    for candidate in list_candidates_db(tenant_id):
        evidence = copilot_structured_evidence(candidate, intent)
        candidate_with_evidence = {**candidate, "evidence": evidence, "top_chunks": ["structured_profile"]}
        if not candidate_matches_any_intent(candidate_with_evidence, intent):
            continue
        candidate_with_evidence["semantic_score"] = max(float(candidate.get("semantic_score") or 0), 0.35)
        candidates.append(candidate_with_evidence)
    return rank_and_filter_copilot_candidates(message, candidates)[:limit]


def merge_copilot_candidate_results(primary: list[dict], secondary: list[dict]) -> list[dict]:
    merged: dict[str, dict] = {}
    ordered_ids: list[str] = []
    for candidate in [*primary, *secondary]:
        document_id = candidate.get("document_id")
        if not document_id:
            continue
        if document_id not in merged:
            merged[document_id] = dict(candidate)
            ordered_ids.append(document_id)
            continue
        existing = merged[document_id]
        for key, value in candidate.items():
            if key == "semantic_score":
                existing[key] = max(float(existing.get(key) or 0), float(value or 0))
            elif key == "evidence":
                existing[key] = dedupe_copilot_evidence([*(existing.get(key) or []), *(value or [])])
            elif key == "top_chunks":
                existing[key] = list(dict.fromkeys([*(existing.get(key) or []), *(value or [])]))[:8]
            elif value and not existing.get(key):
                existing[key] = value
    return [merged[document_id] for document_id in ordered_ids]


def dedupe_copilot_evidence(evidence: list[dict]) -> list[dict]:
    seen = set()
    deduped = []
    for item in evidence:
        if not isinstance(item, dict):
            continue
        key = (
            item.get("chunk_type"),
            item.get("source_label"),
            item.get("page_number"),
            str(item.get("snippet") or "")[:160],
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped[:10]


def copilot_query_intent(message: str) -> dict[str, Any]:
    return {
        "terms": significant_query_terms(message),
        "location_groups": copilot_location_alias_groups(message),
        "role_groups": copilot_role_alias_groups(message),
        "location_requirement": copilot_location_requirement(message),
    }


def public_copilot_query_intent(message: str) -> dict[str, Any]:
    intent = copilot_query_intent(message)
    role_groups = intent.get("role_groups") or []
    location_groups = intent.get("location_groups") or []
    roles = list(dict.fromkeys(copilot_label(group[0]) for group in role_groups))
    locations = list(dict.fromkeys(copilot_label(group[0]) for group in location_groups))
    return {
        "role_intent": copilot_label(role_groups[0][0]) if role_groups else "Open candidate search",
        "roles": roles,
        "locations": locations,
        "location_requirement": intent.get("location_requirement") or "preferred",
        "terms": intent.get("terms") or [],
    }


def copilot_label(value: str) -> str:
    return str(value or "").replace("_", " ").strip().title()


def copilot_location_alias_groups(message: str) -> list[list[str]]:
    normalized = normalize_copilot_text(message)
    known_locations = [
        ("new york", ["new york", "new york city", "nyc", "ny"]),
        ("san francisco", ["san francisco", "sf", "bay area"]),
        ("los angeles", ["los angeles", "la"]),
        ("worcester", ["worcester"]),
        ("columbus", ["columbus"]),
        ("seattle", ["seattle"]),
        ("boston", ["boston"]),
        ("chicago", ["chicago"]),
        ("bangalore", ["bangalore", "bengaluru"]),
        ("mumbai", ["mumbai"]),
        ("india", ["india"]),
        ("canada", ["canada"]),
        ("united states", ["united states", "usa", "us"]),
    ]
    groups = [
        aliases
        for phrase, aliases in known_locations
        if contains_search_phrase(normalized, phrase) or any(contains_search_phrase(normalized, alias) for alias in aliases)
    ]
    for match in re.finditer(r"\b(?:from|in|near|around|based in|located in)\s+([a-z]+(?:\s+[a-z]+){0,3})", normalized):
        phrase = match.group(1).strip()
        phrase = re.split(r"\b(?:with|who|that|and|or|for|having|has|have|but)\b", phrase)[0].strip()
        if phrase and phrase not in COPILOT_STOPWORDS:
            groups.append([phrase])
    return dedupe_alias_groups(groups)


def copilot_location_requirement(message: str) -> str:
    normalized = normalize_copilot_text(message)
    if re.search(r"\b(ignore|any|anywhere|no preference|flexible)\b.{0,24}\b(location|city|country|timezone)\b", normalized):
        return "ignored"
    required_patterns = [
        r"\b(must|required|require|only|strict|mandatory)\b.{0,32}\b(in|from|near|around|based|located|location|city|country)\b",
        r"\b(in|from|near|around|based in|located in)\b.{0,32}\b(only|required|must)\b",
        r"\b(onsite|on site|on-site|in office|local candidates only|local only)\b",
    ]
    if any(re.search(pattern, normalized) for pattern in required_patterns):
        return "required"
    return "preferred"


def copilot_role_alias_groups(message: str) -> list[list[str]]:
    normalized = normalize_copilot_text(message)
    role_aliases = [
        ("data engineer", ["data engineer", "data engineering", "big data engineer", "etl", "data pipeline", "spark", "pyspark", "databricks"]),
        ("ai engineer", ["ai engineer", "ml engineer", "machine learning engineer", "generative ai", "genai", "llm", "rag"]),
        ("cloud architect", ["cloud architect", "cloud architecture", "solutions architect", "azure architect", "aws architect"]),
        ("analytics", ["analytics", "bi", "business intelligence", "tableau", "power bi"]),
    ]
    return dedupe_alias_groups([aliases for phrase, aliases in role_aliases if contains_search_phrase(normalized, phrase)])


def dedupe_alias_groups(groups: list[list[str]]) -> list[list[str]]:
    deduped: list[list[str]] = []
    seen = set()
    for group in groups:
        normalized_group = tuple(dict.fromkeys(normalize_copilot_text(item) for item in group if item).keys())
        normalized_group = tuple(item for item in normalized_group if item)
        if not normalized_group or normalized_group in seen:
            continue
        seen.add(normalized_group)
        deduped.append(list(normalized_group))
    return deduped


def rank_and_filter_copilot_candidates(message: str, candidates: list[dict]) -> list[dict]:
    intent = copilot_query_intent(message)
    scored = []
    for candidate in candidates:
        breakdown = copilot_score_breakdown(candidate, intent)
        scored.append({
            **candidate,
            "semantic_score": breakdown["total_score"],
            "copilot_score_breakdown": breakdown,
        })
    ranked = sorted(scored, key=lambda candidate: candidate["copilot_score_breakdown"]["total_score"], reverse=True)
    location_groups = intent.get("location_groups") or []
    if location_groups and intent.get("location_requirement") == "required":
        required_matches = [candidate for candidate in ranked if candidate_matches_all_groups(candidate, location_groups)]
        if required_matches:
            return required_matches
    return ranked


def copilot_candidate_intent_score(candidate: dict, intent: dict[str, Any]) -> float:
    return float(copilot_score_breakdown(candidate, intent)["total_score"])


def copilot_score_breakdown(candidate: dict, intent: dict[str, Any]) -> dict[str, Any]:
    original_semantic = max(0.0, min(1.0, float(candidate.get("semantic_score") or 0)))
    terms = intent.get("terms") or []
    text = copilot_candidate_text(candidate)
    role_groups = intent.get("role_groups") or []
    location_groups = intent.get("location_groups") or []
    role_score = 0.65 if not role_groups else (1.0 if any(candidate_matches_group(candidate, group) for group in role_groups) else 0.15)
    term_hits = sum(1 for term in terms if contains_search_phrase(text, str(term)))
    evidence_score = min(1.0, term_hits / max(1, len(terms))) if terms else 0.6
    years = float(candidate.get("total_years_experience") or 0)
    years_score = 0.55 if not years else min(1.0, years / 6)
    location_score, location_reason = copilot_location_score(candidate, location_groups, str(intent.get("location_requirement") or "preferred"))
    semantic_score = original_semantic
    total = (
        role_score * 0.35
        + evidence_score * 0.25
        + years_score * 0.15
        + location_score * 0.15
        + semantic_score * 0.10
    )
    return {
        "total_score": round(max(0.0, min(1.0, total)), 4),
        "role_score": round(role_score, 4),
        "evidence_score": round(evidence_score, 4),
        "years_score": round(years_score, 4),
        "location_score": round(location_score, 4),
        "semantic_score": round(semantic_score, 4),
        "location_requirement": intent.get("location_requirement") or "preferred",
        "location_reason": location_reason,
    }


def copilot_location_score(candidate: dict, location_groups: list[list[str]], requirement: str) -> tuple[float, str]:
    if requirement == "ignored" or not location_groups:
        return 0.6, "Location not used"
    latest_location = normalize_copilot_text(candidate.get("location") or "")
    associated_text = copilot_candidate_text(candidate)
    if any(any(contains_search_phrase(latest_location, alias) for alias in group) for group in location_groups):
        return 1.0, "Latest/current role location matches"
    if any(any(contains_search_phrase(associated_text, alias) for alias in group) for group in location_groups):
        return 0.65, "Associated location signal matches"
    return (0.0 if requirement == "required" else 0.35), "No matching location signal"


def candidate_matches_any_intent(candidate: dict, intent: dict[str, Any]) -> bool:
    groups = [*(intent.get("location_groups") or []), *(intent.get("role_groups") or [])]
    terms = intent.get("terms") or []
    if groups and any(candidate_matches_group(candidate, group) for group in groups):
        return True
    return bool(terms and candidate_has_direct_evidence(candidate, [str(term) for term in terms]))


def candidate_matches_all_groups(candidate: dict, groups: list[list[str]]) -> bool:
    return all(candidate_matches_group(candidate, group) for group in groups)


def candidate_matches_group(candidate: dict, aliases: list[str]) -> bool:
    text = copilot_candidate_text(candidate)
    return any(contains_search_phrase(text, alias) for alias in aliases)


def copilot_candidate_text(candidate: dict) -> str:
    haystacks = [
        candidate.get("name"),
        candidate.get("current_title"),
        candidate.get("current_company"),
        candidate.get("location"),
        candidate.get("source_file"),
        " ".join(candidate.get("countries") or []),
        " ".join(candidate.get("top_domains") or []),
    ]
    haystacks.extend((item.get("snippet") or "") for item in candidate.get("evidence") or [] if isinstance(item, dict))
    return normalize_copilot_text("\n".join(str(item or "") for item in haystacks))


def copilot_structured_evidence(candidate: dict, intent: dict[str, Any]) -> list[dict]:
    evidence_sources = [
        ("profile", "Structured profile", " ".join(filter(None, [candidate.get("name"), candidate.get("current_title"), candidate.get("current_company")]))),
        ("locations", "Current location and countries", " ".join(filter(None, [candidate.get("location"), " ".join(candidate.get("countries") or [])]))),
        ("domains", "Parsed domain experience", " ".join(domain.replace("_", " ") for domain in candidate.get("top_domains") or [])),
    ]
    aliases = [
        *(intent.get("terms") or []),
        *[alias for group in intent.get("location_groups") or [] for alias in group],
        *[alias for group in intent.get("role_groups") or [] for alias in group],
    ]
    evidence = []
    for chunk_type, source_label, text in evidence_sources:
        if not text.strip():
            continue
        if aliases and not any(contains_search_phrase(text, str(alias)) for alias in aliases):
            continue
        evidence.append({"chunk_type": chunk_type, "source_label": source_label, "page_number": None, "snippet": text[:420]})
    if not evidence:
        for chunk_type, source_label, text in evidence_sources:
            if text.strip():
                evidence.append({"chunk_type": chunk_type, "source_label": source_label, "page_number": None, "snippet": text[:420]})
    return evidence[:5]


def normalize_copilot_text(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9+#.]+", " ", str(value or "").lower())).strip()


def contains_search_phrase(text: str, phrase: str) -> bool:
    normalized_text = normalize_copilot_text(text)
    normalized_phrase = normalize_copilot_text(phrase)
    if not normalized_text or not normalized_phrase:
        return False
    if len(normalized_phrase) <= 3:
        return re.search(rf"(^|\s){re.escape(normalized_phrase)}($|\s)", normalized_text) is not None
    return normalized_phrase in normalized_text


def should_require_direct_evidence(message: str, terms: list[str]) -> bool:
    if not terms:
        return False
    word_count = len(re.findall(r"[a-z0-9+#.-]+", message.lower()))
    return len(terms) <= 3 or word_count <= 5


def apply_copilot_direct_evidence_policy(message: str, terms: list[str], candidates: list[dict]) -> list[dict]:
    direct_results = [candidate for candidate in candidates if candidate_has_direct_evidence(candidate, terms)]
    if should_require_direct_evidence(message, terms):
        return direct_results
    return direct_results or candidates


def candidate_has_direct_evidence(candidate: dict, terms: list[str]) -> bool:
    if not terms:
        return False
    haystacks = [
        candidate.get("name"),
        candidate.get("current_title"),
        candidate.get("current_company"),
        candidate.get("location"),
        candidate.get("source_file"),
        " ".join(candidate.get("countries") or []),
    ]
    haystacks.extend((item.get("snippet") or "") for item in candidate.get("evidence") or [] if isinstance(item, dict))
    text = "\n".join(str(item or "").lower() for item in haystacks)
    return any(term in text for term in terms)


def promote_direct_evidence(candidate: dict, terms: list[str]) -> dict:
    if not terms or not candidate.get("evidence"):
        return candidate
    evidence = list(candidate.get("evidence") or [])
    evidence.sort(key=lambda item: 0 if evidence_contains_term(item, terms) else 1)
    return {**candidate, "evidence": evidence}


def evidence_contains_term(item: dict, terms: list[str]) -> bool:
    snippet = str((item or {}).get("snippet") or "").lower()
    return any(term in snippet for term in terms)


def copilot_clarifying_questions(message: str) -> list[str]:
    lower = message.lower()
    questions: list[str] = []
    if not any(term in lower for term in ("year", "yrs", "experience", "senior", "lead", "principal", "junior")):
        questions.append("What minimum years of experience or seniority level should I enforce?")
    has_location_intent = bool(copilot_location_alias_groups(message))
    if not has_location_intent and not any(term in lower for term in ("remote", "onsite", "hybrid", "country", "location", "timezone", "visa", "work authorization")):
        questions.append("Are there required countries, locations, time zones, or work authorization constraints?")
    if not any(term in lower for term in ("must", "required", "need", "dealbreaker")):
        questions.append("Which skills are true must-haves versus nice-to-haves?")
    if len(message.split()) < 8:
        questions.append("Can you add domain context, target role title, or tools/platforms to improve ranking quality?")
    return questions[:4]
