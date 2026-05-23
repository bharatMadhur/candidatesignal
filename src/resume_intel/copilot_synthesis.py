from __future__ import annotations

import json
import time
from typing import Any

from psycopg.types.json import Jsonb

from .db import db
from .governance import get_tenant_governance_policy
from .llm import _load_json_object
from .llm_provider import Message, NormalizedProvider
from .pii import redact_contact_pii_text
from .settings import Settings


COPILOT_SYNTHESIS_PROMPT = """You are candidateSignal.ai's recruiter copilot synthesis engine.
Use only the provided tenant-scoped search results and evidence snippets.
Do not invent candidate facts, employers, dates, countries, or skills.
Never reveal hidden IDs unless needed for technical support.
Separate facts from recommendation language.
If evidence is weak, say what needs clarification.
Return only valid JSON.
"""

COPILOT_SYNTHESIS_CANDIDATE_LIMIT = 10


def copilot_synthesis_candidates(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep external LLM synthesis bounded while retrieval can return more rows."""
    return results[:COPILOT_SYNTHESIS_CANDIDATE_LIMIT]


def synthesize_copilot_answer(
    *,
    tenant_id: str,
    user_id: str,
    message: str,
    results: list[dict[str, Any]],
    fallback_answer: str,
    settings: Settings,
) -> dict[str, Any]:
    policy = get_tenant_governance_policy(tenant_id)
    if not policy["external_llm_synthesis_enabled"]:
        return {
            "answer": fallback_answer,
            "status": "disabled_by_tenant_policy",
            "usage": None,
            "suggested_actions": [],
        }
    if not settings.llm_api_key:
        return {
            "answer": fallback_answer,
            "status": "disabled_missing_llm_api_key",
            "usage": None,
            "suggested_actions": [],
        }

    safe_results = [
        _candidate_for_synthesis(
            item,
            redact_pii=policy["redact_pii_before_external_llm"],
            candidate_label=f"Candidate {index}",
        )
        for index, item in enumerate(copilot_synthesis_candidates(results), start=1)
    ]
    user_prompt = f"""Return this JSON shape:
{{
  "answer": string,
  "top_recommendations": [
    {{
      "candidate_name": string,
      "why": [string],
      "evidence": [string],
      "gaps": [string],
      "next_action": string
    }}
  ],
  "clarifying_questions": [string],
  "suggested_actions": [string]
}}

Recruiter request:
{message}

Tenant-scoped candidate search results:
{json.dumps(safe_results, ensure_ascii=False)}
"""
    provider = NormalizedProvider(
        model=settings.llm_model,
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        timeout_seconds=settings.llm_timeout_seconds,
        temperature=settings.llm_temperature,
        max_tokens=settings.llm_max_tokens,
        max_retries=settings.llm_max_retries,
        retry_base_delay_ms=settings.llm_retry_base_delay_ms,
    )
    started = time.perf_counter()
    try:
        result = provider.generate(
            system_prompt=COPILOT_SYNTHESIS_PROMPT,
            messages=[Message(role="user", content=user_prompt)],
            response_format={"type": "json_object"},
            max_tokens=4096,
        )
        payload = _load_json_object(result.content)
        usage = {
            "pass_name": "copilot_synthesis",
            "provider": "litellm",
            "model": result.model or settings.llm_model,
            "input_tokens": result.input_tokens,
            "output_tokens": result.output_tokens,
            "total_tokens": result.input_tokens + result.output_tokens,
            "latency_ms": int((time.perf_counter() - started) * 1000),
            "status": "succeeded",
        }
        _record_copilot_usage(tenant_id, user_id, usage)
        return {
            "answer": str(payload.get("answer") or fallback_answer),
            "status": "succeeded",
            "usage": usage,
            "suggested_actions": [str(item) for item in payload.get("suggested_actions") or [] if str(item).strip()],
            "clarifying_questions": [str(item) for item in payload.get("clarifying_questions") or [] if str(item).strip()],
            "top_recommendations": payload.get("top_recommendations") or [],
        }
    except Exception as exc:
        usage = {
            "pass_name": "copilot_synthesis",
            "provider": "litellm",
            "model": settings.llm_model,
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "latency_ms": int((time.perf_counter() - started) * 1000),
            "status": "failed",
            "error_message": str(exc)[:1000],
        }
        _record_copilot_usage(tenant_id, user_id, usage)
        return {
            "answer": fallback_answer,
            "status": "failed",
            "usage": usage,
            "suggested_actions": ["External synthesis failed; using deterministic evidence-ranked search output."],
            "error": str(exc),
        }


def _candidate_for_synthesis(candidate: dict[str, Any], *, redact_pii: bool, candidate_label: str | None = None) -> dict[str, Any]:
    candidate_name = str(candidate.get("name") or "").strip()
    label = candidate_label or "Candidate"
    evidence = []
    for item in candidate.get("evidence") or []:
        if not isinstance(item, dict):
            continue
        if redact_pii and item.get("chunk_type") == "contact_pii":
            continue
        snippet = item.get("snippet")
        if redact_pii:
            snippet = redact_contact_pii_text(snippet, names=[candidate_name])
        evidence.append(
            {
                "chunk_type": item.get("chunk_type"),
                "source_label": item.get("source_label"),
                "page_number": item.get("page_number"),
                "snippet": snippet,
            }
        )
    safe = {
        "name": label if redact_pii else candidate.get("name"),
        "current_title": candidate.get("current_title"),
        "current_company": candidate.get("current_company"),
        "total_years_experience": candidate.get("total_years_experience"),
        "seniority": candidate.get("seniority"),
        "top_domains": candidate.get("top_domains") or [],
        "countries": candidate.get("countries") or [],
        "semantic_score": candidate.get("semantic_score"),
        "evidence": evidence[:5],
    }
    if not redact_pii:
        safe["document_id"] = candidate.get("document_id")
        safe["location"] = candidate.get("location")
    if not redact_pii:
        safe["email"] = candidate.get("email")
        safe["phone"] = candidate.get("phone")
    return safe


def _record_copilot_usage(tenant_id: str, user_id: str, usage: dict[str, Any]) -> None:
    with db() as conn:
        conn.execute(
            """
            insert into llm_usage_events (
              tenant_id, pass_name, provider, model, input_tokens, output_tokens,
              total_tokens, estimated_cost, latency_ms, status, error_message
            )
            values (%s, %s, %s, %s, %s, %s, %s, 0, %s, %s, %s)
            """,
            (
                tenant_id,
                usage["pass_name"],
                usage["provider"],
                usage["model"],
                usage["input_tokens"],
                usage["output_tokens"],
                usage["total_tokens"],
                usage.get("latency_ms"),
                usage["status"],
                usage.get("error_message"),
            ),
        )
        conn.execute(
            """
            insert into audit_logs (tenant_id, user_id, action, entity_type, metadata)
            values (%s, %s, 'copilot.synthesis_usage', 'copilot', %s)
            """,
            (tenant_id, user_id, Jsonb(usage)),
        )
        conn.commit()
