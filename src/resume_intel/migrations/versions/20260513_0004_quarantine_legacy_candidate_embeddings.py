from __future__ import annotations

import psycopg


VERSION = "20260513_0004_quarantine_legacy_candidate_embeddings"
DESCRIPTION = "Quarantine obsolete candidate_embeddings table after candidate_search_chunks became canonical"


def upgrade(conn: psycopg.Connection) -> None:
    """Preserve old rows for rollback/debug without keeping the table active."""

    existing = conn.execute("select to_regclass('public.candidate_embeddings') as table_name").fetchone()
    if not existing or not existing["table_name"]:
        return
    legacy = conn.execute("select to_regclass('public.legacy_candidate_embeddings') as table_name").fetchone()
    if legacy and legacy["table_name"]:
        conn.execute(
            """
            insert into legacy_candidate_embeddings (tenant_id, document_id, chunk_type, chunk_text, embedding, created_at)
            select tenant_id, document_id, chunk_type, chunk_text, embedding, created_at
            from candidate_embeddings
            """
        )
        conn.execute("drop table candidate_embeddings")
        return
    conn.execute("alter table candidate_embeddings rename to legacy_candidate_embeddings")
