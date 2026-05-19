from __future__ import annotations

# Backward-compatible imports for older tests/scripts. New code should import
# from resume_intel.candidate_versions.
from .candidate_versions import (  # noqa: F401
    build_version_diffs,
    candidate_version_requirements,
    decide_match,
    find_matches_for_record,
    list_clusters,
    match_score,
    merge_match,
    persist_matches,
)

entity_resolution_requirements = candidate_version_requirements
