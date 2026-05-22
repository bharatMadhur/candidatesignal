from __future__ import annotations

from resume_intel import vector_search


def test_candidate_search_returns_exact_name_matches_without_semantic_noise(monkeypatch):
    exact = [{"document_id": "shubh-1", "name": "Shubh Almal", "search_match_type": "exact"}]
    semantic_called = False

    def fake_exact_candidate_search(query_text, limit=25, tenant_id=None):
        assert query_text == "shubh"
        assert tenant_id == "tenant-1"
        return exact

    def fake_semantic_candidate_search(query_text, limit=25, tenant_id=None):
        nonlocal semantic_called
        semantic_called = True
        return [{"document_id": "noise-1", "name": "Unrelated Candidate"}]

    monkeypatch.setattr(vector_search, "exact_candidate_search", fake_exact_candidate_search)
    monkeypatch.setattr(vector_search, "semantic_candidate_search", fake_semantic_candidate_search)

    assert vector_search.candidate_search("shubh", tenant_id="tenant-1") == exact
    assert semantic_called is False


def test_candidate_search_falls_back_to_semantic_when_no_exact_match(monkeypatch):
    semantic = [{"document_id": "skill-1", "name": "Data Engineer", "search_match_type": "semantic"}]

    monkeypatch.setattr(vector_search, "exact_candidate_search", lambda *args, **kwargs: [])
    monkeypatch.setattr(vector_search, "semantic_candidate_search", lambda *args, **kwargs: semantic)

    assert vector_search.candidate_search("spark data engineer", tenant_id="tenant-1") == semantic


def test_exact_match_rank_prefers_name_over_source_file():
    row = {
        "name": "Shubh Almal",
        "email": "shubh@example.com",
        "phone": None,
        "source_file": "shubh-resume.pdf",
        "record_json": {},
    }

    assert vector_search._exact_match_rank(row, "shubh")[1] == "name"

