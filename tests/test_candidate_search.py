from __future__ import annotations

from resume_intel import vector_search


class _Result:
    def __init__(self, rows):
        self.rows = rows

    def fetchall(self):
        return self.rows


class _SearchConnection:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def execute(self, *args, **_kwargs):
        self.calls.append(args)
        return _Result(self.responses.pop(0))


class _SearchDb:
    def __init__(self, connection):
        self.connection = connection

    def __enter__(self):
        return self.connection

    def __exit__(self, *_args):
        return None


def test_candidate_search_merges_exact_and_semantic_results(monkeypatch):
    exact = [{"document_id": "shubh-1", "name": "Shubh Almal", "search_match_type": "exact"}]
    semantic = [{"document_id": "spark-1", "name": "Spark Engineer", "semantic_score": 0.82}]

    def fake_exact_candidate_search(query_text, limit=25, tenant_id=None):
        assert query_text == "shubh"
        assert tenant_id == "tenant-1"
        return exact

    def fake_semantic_candidate_search(query_text, limit=25, tenant_id=None):
        return semantic

    monkeypatch.setattr(vector_search, "exact_candidate_search", fake_exact_candidate_search)
    monkeypatch.setattr(vector_search, "semantic_candidate_search", fake_semantic_candidate_search)

    result = vector_search.candidate_search("shubh", tenant_id="tenant-1")

    assert [item["document_id"] for item in result] == ["shubh-1", "spark-1"]


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


def test_semantic_scores_collapse_confirmed_resume_versions(monkeypatch):
    monkeypatch.setattr(vector_search, "canonical_candidate_map", lambda tenant_id: {"old-doc": "new-doc"})

    result = vector_search._collapse_scores_to_canonical_versions(
        {
            "old-doc": {
                "semantic_score": 0.91,
                "top_chunks": ["raw_text_0"],
                "evidence": [{"snippet": "older resume mentions Spark"}],
            },
            "new-doc": {
                "semantic_score": 0.84,
                "top_chunks": ["summary"],
                "evidence": [{"snippet": "new resume summary"}],
            },
        },
        "tenant-1",
        10,
    )

    assert list(result) == ["new-doc"]
    assert result["new-doc"]["semantic_score"] == 0.91
    assert result["new-doc"]["version_source_document_id"] == "old-doc"


def test_exact_search_returns_canonical_candidate_when_old_version_matches(monkeypatch):
    old_row = {
        "document_id": "old-doc",
        "name": "Candidate Old",
        "email": "old@example.com",
        "phone": None,
        "source_file": "legacy-spark-resume.pdf",
        "record_json": {"original_filename": "legacy-spark-resume.pdf", "derived": {"hr_profile": {}}},
        "updated_at": None,
    }
    new_row = {
        "document_id": "new-doc",
        "name": "Candidate New",
        "email": "new@example.com",
        "phone": None,
        "source_file": "current-resume.pdf",
        "record_json": {"original_filename": "current-resume.pdf", "derived": {"hr_profile": {}}},
        "updated_at": None,
    }
    connection = _SearchConnection([[old_row], [new_row]])
    monkeypatch.setattr(vector_search, "db", lambda: _SearchDb(connection))
    monkeypatch.setattr(vector_search, "canonical_candidate_map", lambda tenant_id: {"old-doc": "new-doc"})

    result = vector_search.exact_candidate_search("legacy-spark", tenant_id="tenant-1")

    assert len(result) == 1
    assert result[0]["document_id"] == "new-doc"
    assert result[0]["version_source_document_id"] == "old-doc"
    assert result[0]["evidence"][0]["source_label"] == "Exact candidate identity/version match"


def test_semantic_search_uses_nearest_chunk_recall_before_grouping(monkeypatch):
    connection = _SearchConnection([[]])
    monkeypatch.setattr(vector_search, "db", lambda: _SearchDb(connection))
    monkeypatch.setattr(vector_search, "embed_text_real", lambda _text: ([0.1] * vector_search.OPENAI_EMBEDDING_DIMENSIONS, "openai/text-embedding-3-small"))
    monkeypatch.setattr(vector_search, "canonical_candidate_map", lambda tenant_id: {})

    vector_search.semantic_candidate_scores("data engineer", tenant_id="tenant-1", limit=25)

    sql = connection.calls[0][0]
    assert "with nearest_chunks as" in sql.lower()
    assert "order by candidate_search_chunks.embedding <=>" in sql.lower()
