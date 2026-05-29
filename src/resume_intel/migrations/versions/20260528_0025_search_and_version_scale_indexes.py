from __future__ import annotations


VERSION = "20260528_0025_search_and_version_scale_indexes"
DESCRIPTION = "Add semantic search and candidate versioning scale indexes"


def upgrade(conn) -> None:
    # HNSW gives pgvector an approximate nearest-neighbor path for the broad
    # recall phase. The btree indexes keep tenant/model filters cheap before
    # grouping evidence by candidate.
    conn.execute(
        """
        do $$
        begin
          begin
            execute 'create index if not exists candidate_search_chunks_embedding_hnsw_idx
                     on candidate_search_chunks
                     using hnsw (embedding vector_cosine_ops)';
          exception when undefined_object or feature_not_supported then
            execute 'create index if not exists candidate_search_chunks_embedding_ivfflat_idx
                     on candidate_search_chunks
                     using ivfflat (embedding vector_cosine_ops)
                     with (lists = 100)';
          end;
        end $$;
        """
    )
    conn.execute(
        """
        create index if not exists candidate_search_chunks_tenant_model_idx
        on candidate_search_chunks (tenant_id, embedding_model)
        """
    )
    conn.execute(
        """
        create index if not exists candidates_tenant_email_idx
        on candidates (tenant_id, lower(email))
        where deleted_at is null and email is not null and email <> ''
        """
    )
    conn.execute(
        """
        create index if not exists candidates_tenant_phone_idx
        on candidates (tenant_id, phone)
        where deleted_at is null and phone is not null and phone <> ''
        """
    )
    conn.execute(
        """
        create index if not exists candidates_tenant_phone_digits_idx
        on candidates (tenant_id, right(regexp_replace(phone, '\\D', '', 'g'), 10))
        where deleted_at is null and phone is not null and phone <> ''
        """
    )
    conn.execute(
        """
        create index if not exists candidates_tenant_name_idx
        on candidates (tenant_id, lower(name))
        where deleted_at is null and name is not null and name <> ''
        """
    )
    conn.execute(
        """
        create index if not exists candidates_tenant_name_prefix_idx
        on candidates (tenant_id, lower(name) text_pattern_ops)
        where deleted_at is null and name is not null and name <> ''
        """
    )
    conn.execute(
        """
        create index if not exists candidate_version_matches_candidate_idx
        on candidate_version_matches (tenant_id, left_document_id, right_document_id, status)
        """
    )
