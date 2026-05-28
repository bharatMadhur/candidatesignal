from __future__ import annotations

from unittest.mock import patch

from resume_intel import matching_service


def test_match_requirement_facade_calls_requirement_engine():
    with patch("resume_intel.requirements.match_requirement", return_value=[{"candidate_id": "doc-1"}]) as match:
        result = matching_service.match_requirement_against_candidates("req-1", "tenant-1", deep_judge=True, minimum_score=0.65)

    assert result == [{"candidate_id": "doc-1"}]
    match.assert_called_once_with(
        "req-1",
        "tenant-1",
        deep_judge=True,
        extra_candidate_ids=None,
        minimum_score=0.65,
        candidate_ids_only=False,
    )


def test_run_campaign_matching_facade_calls_campaign_engine():
    with patch("resume_intel.campaigns.run_campaign_match", return_value={"id": "campaign-1", "matches": []}) as run:
        result = matching_service.run_campaign_matching("campaign-1", "tenant-1", "user-1", mode="incremental", candidate_ids=["doc-1"], batch_id="batch-1")

    assert result["id"] == "campaign-1"
    run.assert_called_once_with(
        "campaign-1",
        "tenant-1",
        "user-1",
        mode="incremental",
        candidate_ids=["doc-1"],
        batch_id="batch-1",
    )
