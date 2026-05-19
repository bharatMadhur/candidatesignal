from __future__ import annotations

import hashlib
import math
import re
from pathlib import Path
from typing import Any

from .db import db
from .geo import countries_for_search, current_job_location
from .settings import load_settings


DIMENSIONS = 384
OPENAI_EMBEDDING_DIMENSIONS = 1536
RAW_CHUNK_SIZE = 3000
RAW_CHUNK_OVERLAP = 250


def embed_text(text: str) -> list[float]:
    vector = [0.0] * DIMENSIONS
    tokens = re.findall(r"[a-z0-9+#.]+", text.lower())
    for token in tokens:
        digest = hashlib.blake2b(token.encode(), digest_size=8).digest()
        index = int.from_bytes(digest[:4], "big") % DIMENSIONS
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[index] += sign
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [round(value / norm, 6) for value in vector]


def vector_literal(vector: list[float]) -> str:
    return "[" + ",".join(str(value) for value in vector) + "]"


def embed_text_real(text: str) -> tuple[list[float], str]:
    settings = load_settings()
    if not settings.llm_api_key:
        if not settings.allow_hash_embedding_fallback:
            raise RuntimeError(
                "Embedding API key is not configured. Set RESUME_INTEL_LITELLM_API_KEY, "
                "OPENAI_API_KEY, or RESUME_INTEL_ALLOW_HASH_EMBEDDING_FALLBACK=1 for local-only development."
            )
        return _hash_embed(text, settings.embedding_dimensions), "local-hash-fallback"
    try:
        from litellm import embedding
    except ImportError as exc:
        raise RuntimeError("litellm is not installed. Run: pip install -r requirements.txt") from exc
    kwargs: dict[str, Any] = {
        "model": settings.embedding_model,
        "input": [text[:12000]],
        "timeout": settings.embedding_timeout_seconds,
        "api_key": settings.llm_api_key,
    }
    if settings.llm_base_url:
        kwargs["api_base"] = settings.llm_base_url
    response = embedding(**kwargs)
    vector = response.data[0]["embedding"] if isinstance(response.data[0], dict) else response.data[0].embedding
    return [float(value) for value in vector], settings.embedding_model


def candidate_chunks(record: dict[str, Any], raw_text: str | None = None) -> list[tuple[str, str, str | None, int | None]]:
    location_intelligence = record.get("derived", {}).get("location_intelligence") or {}
    pii_intelligence = record.get("derived", {}).get("pii_contact_intelligence") or {}
    chunks = [
        ("summary", " ".join(filter(None, [record.get("name"), record.get("summary")])), "Parsed summary", None),
        ("skills", " ".join(record.get("skills") or []), "Parsed skills", None),
        (
            "contact_pii",
            " ".join(
                [
                    record.get("contact", {}).get("email") or "",
                    record.get("contact", {}).get("phone") or "",
                    " ".join(record.get("contact", {}).get("links") or []),
                    " ".join(pii_intelligence.get("emails") or []),
                    " ".join(pii_intelligence.get("phones") or []),
                    " ".join(pii_intelligence.get("linkedin_urls") or []),
                    " ".join(pii_intelligence.get("github_urls") or []),
                    " ".join(pii_intelligence.get("portfolio_websites") or []),
                    " ".join(pii_intelligence.get("all_urls") or []),
                ]
            ),
            "Contact links and PII",
            None,
        ),
        ("derived", " ".join(record.get("derived", {}).get("recruiter_highlights") or []), "Deterministic HR highlights", None),
        ("notes", " ".join(note.get("content", "") for note in record.get("notes") or []), "Recruiter notes", None),
        (
            "ai_intelligence",
            _flatten_text(record.get("candidate_intelligence") or record.get("llm_hr_intelligence") or {}),
            "AI HR intelligence",
            None,
        ),
        (
            "locations",
            " ".join(
                [
                    record.get("contact", {}).get("location") or "",
                    location_intelligence.get("current_job_location") or "",
                    location_intelligence.get("resume_header_location") or "",
                    " ".join(countries_for_search(record)),
                    " ".join(location_intelligence.get("structured_locations") or []),
                    " ".join(location_intelligence.get("raw_location_mentions") or []),
                    " ".join(location_intelligence.get("mobility_signals") or []),
                    _flatten_text(location_intelligence.get("location_signals") or []),
                    _flatten_text(location_intelligence.get("timezone_signals") or []),
                    " ".join(location_intelligence.get("work_authorization_signals") or []),
                    " ".join(location_intelligence.get("remote_work_signals") or []),
                    " ".join(location_intelligence.get("relocation_signals") or []),
                ]
            ),
            "Locations and countries",
            None,
        ),
    ]
    for index, item in enumerate(record.get("experience") or []):
        chunks.append(
            (
                f"experience_{index}",
                " ".join(
                    filter(
                        None,
                        [
                            item.get("company"),
                            item.get("title"),
                            item.get("location"),
                            " ".join(item.get("bullets") or []),
                            _flatten_text(item.get("workstreams") or []),
                        ],
                    )
                ),
                f"Experience #{index + 1}",
                None,
            )
        )
    for index, item in enumerate(record.get("education") or []):
        chunks.append((f"education_{index}", " ".join(filter(None, [item.get("school"), item.get("degree"), item.get("field")])), f"Education #{index + 1}", None))
    for index, page in enumerate((record.get("_metadata") or {}).get("pages") or []):
        text = page.get("text") if isinstance(page, dict) else ""
        page_number = int(page.get("page_number") or index + 1) if isinstance(page, dict) else index + 1
        chunks.append((f"page_text_{page_number}", text or "", f"Original CV page {page_number}", page_number))
    if raw_text:
        for index, chunk in enumerate(_split_raw_text(raw_text)):
            chunks.append((f"raw_text_{index}", chunk, "Raw extracted resume text", None))
    return [(kind, text, label, page) for kind, text, label, page in chunks if text.strip()]


def upsert_candidate_search_chunks(record: dict[str, Any], raw_text: str | None = None, tenant_id: str | None = None) -> None:
    tenant_id = tenant_id or record.get("tenant_id")
    chunks = candidate_chunks(record, raw_text)
    with db() as conn:
        conn.execute("delete from candidate_search_chunks where tenant_id=%s and document_id=%s", (tenant_id, record["document_id"]))
        for chunk_type, chunk_text, source_label, page_number in chunks:
            embedding, model = embed_text_real(chunk_text)
            conn.execute(
                """
                insert into candidate_search_chunks (
                  tenant_id, document_id, chunk_type, chunk_text, source_label, page_number, embedding_model, embedding
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s::vector)
                """,
                (tenant_id, record["document_id"], chunk_type, chunk_text, source_label, page_number, model, vector_literal(_normalize_dim(embedding, OPENAI_EMBEDDING_DIMENSIONS))),
            )
        conn.commit()


def _split_raw_text(text: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", text).strip()
    if not normalized:
        return []
    chunks = []
    start = 0
    while start < len(normalized):
        end = min(len(normalized), start + RAW_CHUNK_SIZE)
        chunks.append(normalized[start:end])
        if end == len(normalized):
            break
        start = max(0, end - RAW_CHUNK_OVERLAP)
    return chunks[:20]


def upsert_requirement_embedding(requirement_id: str, text: str, tenant_id: str | None = None) -> None:
    embedding, model = embed_text_real(text)
    with db() as conn:
        if tenant_id:
            conn.execute("delete from requirement_embeddings where tenant_id=%s and requirement_id=%s", (tenant_id, requirement_id))
        else:
            conn.execute("delete from requirement_embeddings where requirement_id=%s", (requirement_id,))
        conn.execute(
            """
            insert into requirement_embeddings (tenant_id, requirement_id, chunk_text, embedding_model, embedding)
            values (%s, %s, %s, %s, %s::vector)
            """,
            (tenant_id, requirement_id, text, model, vector_literal(_normalize_dim(embedding, OPENAI_EMBEDDING_DIMENSIONS))),
        )
        conn.commit()


def semantic_candidate_scores(query_text: str, limit: int = 100, tenant_id: str | None = None) -> dict[str, dict[str, Any]]:
    query_embedding, model = embed_text_real(query_text)
    query_vector = vector_literal(_normalize_dim(query_embedding, OPENAI_EMBEDDING_DIMENSIONS))
    with db() as conn:
        if tenant_id:
            rows = conn.execute(
                """
                select candidate_search_chunks.document_id, max(1 - (embedding <=> %s::vector)) as score,
                       (array_agg(chunk_type order by embedding <=> %s::vector))[1:5] as top_chunks,
                       (array_agg(jsonb_build_object(
                         'chunk_type', chunk_type,
                         'source_label', source_label,
                         'page_number', page_number,
                         'snippet', left(chunk_text, 420),
                         'embedding_model', embedding_model
                       ) order by embedding <=> %s::vector))[1:5] as evidence
                from candidate_search_chunks
                join candidates on candidates.document_id = candidate_search_chunks.document_id
                  and candidates.tenant_id = candidate_search_chunks.tenant_id
                where candidate_search_chunks.tenant_id=%s
                  and candidate_search_chunks.embedding_model=%s
                  and candidates.deleted_at is null
                group by candidate_search_chunks.document_id
                order by score desc
                limit %s
                """,
                (query_vector, query_vector, query_vector, tenant_id, model, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                select candidate_search_chunks.document_id, max(1 - (embedding <=> %s::vector)) as score,
                       (array_agg(chunk_type order by embedding <=> %s::vector))[1:5] as top_chunks,
                       (array_agg(jsonb_build_object(
                         'chunk_type', chunk_type,
                         'source_label', source_label,
                         'page_number', page_number,
                         'snippet', left(chunk_text, 420),
                         'embedding_model', embedding_model
                       ) order by embedding <=> %s::vector))[1:5] as evidence
                from candidate_search_chunks
                join candidates on candidates.document_id = candidate_search_chunks.document_id
                  and candidates.tenant_id = candidate_search_chunks.tenant_id
                where candidate_search_chunks.embedding_model=%s
                  and candidates.deleted_at is null
                group by candidate_search_chunks.document_id
                order by score desc
                limit %s
                """,
                (query_vector, query_vector, query_vector, model, limit),
            ).fetchall()
    return {
        row["document_id"]: {
            "semantic_score": max(0.0, min(1.0, float(row["score"] or 0))),
            "top_chunks": list(row["top_chunks"] or []),
            "evidence": list(row["evidence"] or []),
        }
        for row in rows
    }


def semantic_candidate_scores_for_ids(query_text: str, candidate_ids: list[str], tenant_id: str | None = None) -> dict[str, dict[str, Any]]:
    ids = [str(candidate_id) for candidate_id in candidate_ids if candidate_id]
    if not ids:
        return {}
    query_embedding, model = embed_text_real(query_text)
    query_vector = vector_literal(_normalize_dim(query_embedding, OPENAI_EMBEDDING_DIMENSIONS))
    with db() as conn:
        if tenant_id:
            rows = conn.execute(
                """
                select candidate_search_chunks.document_id, max(1 - (embedding <=> %s::vector)) as score,
                       (array_agg(chunk_type order by embedding <=> %s::vector))[1:5] as top_chunks,
                       (array_agg(jsonb_build_object(
                         'chunk_type', chunk_type,
                         'source_label', source_label,
                         'page_number', page_number,
                         'snippet', left(chunk_text, 420),
                         'embedding_model', embedding_model
                       ) order by embedding <=> %s::vector))[1:5] as evidence
                from candidate_search_chunks
                join candidates on candidates.document_id = candidate_search_chunks.document_id
                  and candidates.tenant_id = candidate_search_chunks.tenant_id
                where candidate_search_chunks.tenant_id=%s
                  and candidate_search_chunks.document_id = any(%s::text[])
                  and candidate_search_chunks.embedding_model=%s
                  and candidates.deleted_at is null
                group by candidate_search_chunks.document_id
                order by score desc
                """,
                (query_vector, query_vector, query_vector, tenant_id, ids, model),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                select candidate_search_chunks.document_id, max(1 - (embedding <=> %s::vector)) as score,
                       (array_agg(chunk_type order by embedding <=> %s::vector))[1:5] as top_chunks,
                       (array_agg(jsonb_build_object(
                         'chunk_type', chunk_type,
                         'source_label', source_label,
                         'page_number', page_number,
                         'snippet', left(chunk_text, 420),
                         'embedding_model', embedding_model
                       ) order by embedding <=> %s::vector))[1:5] as evidence
                from candidate_search_chunks
                join candidates on candidates.document_id = candidate_search_chunks.document_id
                  and candidates.tenant_id = candidate_search_chunks.tenant_id
                where candidate_search_chunks.document_id = any(%s::text[])
                  and candidate_search_chunks.embedding_model=%s
                  and candidates.deleted_at is null
                group by candidate_search_chunks.document_id
                order by score desc
                """,
                (query_vector, query_vector, query_vector, ids, model),
            ).fetchall()
    return {
        row["document_id"]: {
            "semantic_score": max(0.0, min(1.0, float(row["score"] or 0))),
            "top_chunks": list(row["top_chunks"] or []),
            "evidence": list(row["evidence"] or []),
        }
        for row in rows
    }


def semantic_candidate_search(query_text: str, limit: int = 25, tenant_id: str | None = None) -> list[dict[str, Any]]:
    scores = semantic_candidate_scores(query_text, limit, tenant_id)
    if not scores:
        return []
    ids = list(scores.keys())
    with db() as conn:
        rows = conn.execute(
            """
            select document_id, name, email, phone, source_file, record_json, updated_at
            from candidates
            where document_id = any(%s) and (%s::uuid is null or tenant_id=%s) and deleted_at is null
            """,
            (ids, tenant_id, tenant_id),
        ).fetchall()
    by_id = {row["document_id"]: row for row in rows}
    results = []
    for document_id in ids:
        row = by_id.get(document_id)
        if not row:
            continue
        record = row["record_json"]
        final_profile = (record.get("candidate_intelligence") or {}).get("final_candidate_profile") or {}
        summary_card = final_profile.get("summary_card") or {}
        hr_profile = record.get("derived", {}).get("hr_profile", {})
        location_intelligence = record.get("derived", {}).get("location_intelligence") or {}
        experience_by_domain = record.get("derived", {}).get("experience_by_domain") or {}
        top_domains = sorted(experience_by_domain, key=lambda key: _domain_year_value(experience_by_domain.get(key)), reverse=True)[:5]
        result = {
            "document_id": document_id,
            "name": row["name"],
            "email": row["email"],
            "phone": row["phone"],
            "current_title": summary_card.get("current_or_target_title") or hr_profile.get("current_title"),
            "current_company": hr_profile.get("current_company"),
            "total_years_experience": hr_profile.get("total_years_experience"),
            "seniority": hr_profile.get("seniority_level"),
            "top_domains": top_domains,
            "location": location_intelligence.get("current_job_location") or current_job_location(record),
            "countries": countries_for_search(record),
            "coverage": record.get("primary_key_coverage", {}).get("score"),
            "source_file": record.get("original_filename") or Path(row["source_file"] or "Uploaded CV").name,
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            **scores[document_id],
        }
        results.append(result)
    return results


def _domain_year_value(value: Any) -> float:
    if isinstance(value, dict):
        return float(value.get("years") or value.get("adjusted_years") or 0)
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _hash_embed(text: str, dimensions: int) -> list[float]:
    vector = [0.0] * dimensions
    tokens = re.findall(r"[a-z0-9+#.]+", text.lower())
    for token in tokens:
        digest = hashlib.blake2b(token.encode(), digest_size=8).digest()
        index = int.from_bytes(digest[:4], "big") % dimensions
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[index] += sign
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [round(value / norm, 6) for value in vector]


def _normalize_dim(vector: list[float], dimensions: int) -> list[float]:
    if len(vector) == dimensions:
        return vector
    if len(vector) > dimensions:
        return vector[:dimensions]
    return [*vector, *([0.0] * (dimensions - len(vector)))]


def _flatten_text(value: Any, limit: int = 10000) -> str:
    parts: list[str] = []

    def walk(item: Any) -> None:
        if len(" ".join(parts)) > limit:
            return
        if isinstance(item, str):
            parts.append(item)
        elif isinstance(item, dict):
            for child in item.values():
                walk(child)
        elif isinstance(item, list):
            for child in item:
                walk(child)

    walk(value)
    return " ".join(parts)[:limit]
