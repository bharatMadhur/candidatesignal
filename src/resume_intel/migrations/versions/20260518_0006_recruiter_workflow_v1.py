from __future__ import annotations

from psycopg import Connection


VERSION = "20260518_0006_recruiter_workflow_v1"
DESCRIPTION = "Recruiter workflow safety, cost tracking, training data, and campaign pipeline"


def upgrade(conn: Connection) -> None:
    conn.execute("alter table candidates add column if not exists deleted_at timestamptz;")
    conn.execute("alter table candidates add column if not exists deleted_by_user_id uuid references users(id) on delete set null;")
    conn.execute("alter table candidates add column if not exists deletion_reason text;")
    conn.execute("alter table candidates add column if not exists record_kind text not null default 'candidate';")

    conn.execute("alter table parse_batches add column if not exists context_note text;")
    conn.execute("alter table parse_batches add column if not exists estimated_cost numeric not null default 0;")
    conn.execute("alter table notes add column if not exists note_type text not null default 'general';")
    conn.execute("alter table notes add column if not exists visibility text not null default 'team';")
    conn.execute("alter table notes add column if not exists campaign_id uuid references job_campaigns(id) on delete set null;")

    conn.execute("alter table campaign_candidates add column if not exists owner_user_id uuid references users(id) on delete set null;")
    conn.execute("alter table campaign_candidates add column if not exists stage_note text;")
    conn.execute("alter table campaign_candidates add column if not exists last_stage_changed_at timestamptz;")

    conn.execute(
        """
        create table if not exists candidate_activity_events (
          id uuid primary key default gen_random_uuid(),
          tenant_id uuid not null references tenants(id) on delete cascade,
          document_id text references candidates(document_id) on delete cascade,
          campaign_id uuid references job_campaigns(id) on delete set null,
          user_id uuid references users(id) on delete set null,
          event_type text not null,
          title text not null,
          body text,
          metadata jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now()
        )
        """
    )
    conn.execute(
        """
        create table if not exists training_data_examples (
          id uuid primary key default gen_random_uuid(),
          tenant_id uuid not null references tenants(id) on delete cascade,
          document_id text references candidates(document_id) on delete set null,
          source_type text not null,
          input_text text,
          expected_output jsonb not null default '{}'::jsonb,
          metadata jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
        """
    )

    conn.execute("create index if not exists candidates_tenant_not_deleted_idx on candidates (tenant_id, updated_at desc) where deleted_at is null;")
    conn.execute("create index if not exists candidate_activity_doc_idx on candidate_activity_events (tenant_id, document_id, created_at desc);")
    conn.execute("create index if not exists candidate_activity_campaign_idx on candidate_activity_events (tenant_id, campaign_id, created_at desc);")
    conn.execute("create index if not exists training_data_examples_doc_idx on training_data_examples (tenant_id, document_id, source_type);")
    conn.execute("create index if not exists parse_batches_cost_idx on parse_batches (tenant_id, updated_at desc, estimated_cost);")

    conn.execute(
        """
        insert into model_prices (model, input_per_million, output_per_million)
        values
          ('gpt-5-nano', 0.05, 0.40),
          ('gpt-5-nano-2025-08-07', 0.05, 0.40),
          ('openai/gpt-5-nano', 0.05, 0.40),
          ('openai/gpt-5-nano-2025-08-07', 0.05, 0.40),
          ('text-embedding-3-small', 0.02, 0),
          ('openai/text-embedding-3-small', 0.02, 0)
        on conflict (model) do update set
          input_per_million=excluded.input_per_million,
          output_per_million=excluded.output_per_million,
          updated_at=now()
        """
    )
    conn.execute(
        """
        update llm_usage_events usage
        set estimated_cost = round(
          ((usage.input_tokens::numeric / 1000000) * prices.input_per_million)
          + ((usage.output_tokens::numeric / 1000000) * prices.output_per_million),
          6
        )
        from model_prices prices
        where prices.model = usage.model
        """
    )
    conn.execute(
        """
        update parse_jobs jobs
        set estimated_cost = coalesce(costs.estimated_cost, 0)
        from (
          select tenant_id, document_id, sum(estimated_cost) as estimated_cost
          from llm_usage_events
          group by tenant_id, document_id
        ) costs
        where jobs.tenant_id = costs.tenant_id
          and jobs.document_id = costs.document_id
        """
    )
    conn.execute(
        """
        update parse_batches batches
        set estimated_cost = coalesce(costs.estimated_cost, 0)
        from (
          select tenant_id, batch_id, sum(estimated_cost) as estimated_cost
          from parse_jobs
          where batch_id is not null
          group by tenant_id, batch_id
        ) costs
        where batches.tenant_id = costs.tenant_id
          and batches.id = costs.batch_id
        """
    )
