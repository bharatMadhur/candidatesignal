from __future__ import annotations

from psycopg import Connection


VERSION = "20260519_0007_requirement_embeddings_real_vectors"
DESCRIPTION = "Move requirement embeddings to real OpenAI-compatible vectors"


def upgrade(conn: Connection) -> None:
    # Requirement embeddings are derived search indexes, not canonical requirement data.
    # Keep the legacy hash table for audit/debug instead of dropping it.
    conn.execute(
        """
        do $$
        declare
          embedding_type text;
        begin
          if to_regclass('public.requirement_embeddings') is not null then
            select format_type(a.atttypid, a.atttypmod)
            into embedding_type
            from pg_attribute a
            where a.attrelid='public.requirement_embeddings'::regclass
              and a.attname='embedding'
              and not a.attisdropped;

            if coalesce(embedding_type, '') <> 'vector(1536)' then
              if to_regclass('public.requirement_embeddings_legacy_hash') is null then
                alter table requirement_embeddings rename to requirement_embeddings_legacy_hash;
              else
                raise exception 'requirement_embeddings is not vector(1536), and requirement_embeddings_legacy_hash already exists';
              end if;
            end if;
          end if;
        end $$;
        """
    )
    conn.execute(
        """
        create table if not exists requirement_embeddings (
          id uuid primary key default gen_random_uuid(),
          tenant_id uuid references tenants(id) on delete cascade,
          requirement_id uuid not null references requirements(id) on delete cascade,
          chunk_text text not null,
          embedding_model text not null default 'unknown',
          embedding vector(1536) not null,
          created_at timestamptz not null default now()
        )
        """
    )
    conn.execute("create index if not exists requirement_embeddings_req_idx on requirement_embeddings (tenant_id, requirement_id);")
