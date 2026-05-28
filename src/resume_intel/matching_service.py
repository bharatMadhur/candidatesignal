from __future__ import annotations

from typing import Any


def match_requirement_against_candidates(
    requirement_id: str,
    tenant_id: str | None = None,
    *,
    deep_judge: bool = False,
    extra_candidate_ids: list[str] | None = None,
    minimum_score: float | None = None,
    candidate_ids_only: bool = False,
) -> list[dict[str, Any]]:
    """Public orchestration boundary for requirement-to-candidate matching.

    Internals still live in `requirements.py` while the product stabilizes, but
    callers should use this façade so campaign, Copilot, and requirement flows
    can be consolidated behind one service without circular imports.
    """

    from .requirements import MATCH_VISIBILITY_THRESHOLD, match_requirement

    return match_requirement(
        requirement_id,
        tenant_id,
        deep_judge=deep_judge,
        extra_candidate_ids=extra_candidate_ids,
        minimum_score=MATCH_VISIBILITY_THRESHOLD if minimum_score is None else minimum_score,
        candidate_ids_only=candidate_ids_only,
    )


def run_campaign_matching(
    campaign_id: str,
    tenant_id: str,
    user_id: str,
    *,
    mode: str = "full",
    candidate_ids: list[str] | None = None,
    batch_id: str | None = None,
) -> dict[str, Any]:
    """Public orchestration boundary for campaign matching."""

    from .campaigns import run_campaign_match

    return run_campaign_match(
        campaign_id,
        tenant_id,
        user_id,
        mode=mode,
        candidate_ids=candidate_ids,
        batch_id=batch_id,
    )


def semantic_scores_for_query(query: str, *, limit: int, tenant_id: str | None = None) -> dict[str, dict[str, Any]]:
    """Shared semantic-recall boundary used by direct search and matching flows."""

    from .vector_search import semantic_candidate_scores

    return semantic_candidate_scores(query, limit, tenant_id=tenant_id)
