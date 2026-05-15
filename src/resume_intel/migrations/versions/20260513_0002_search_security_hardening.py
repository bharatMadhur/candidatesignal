from __future__ import annotations

import psycopg


VERSION = "20260513_0002_search_security_hardening"
DESCRIPTION = "Tenant-scoped search, PII audit, and operational hardening indexes"


def upgrade(conn: psycopg.Connection) -> None:
    """Keep post-baseline production hardening changes versioned and auditable."""

    conn.execute("create index if not exists candidate_search_chunks_doc_idx on candidate_search_chunks (tenant_id, document_id);")
    conn.execute("create index if not exists candidate_search_chunks_model_idx on candidate_search_chunks (tenant_id, embedding_model);")
    conn.execute("create index if not exists pii_access_events_tenant_doc_idx on pii_access_events (tenant_id, document_id, created_at desc);")
    conn.execute("create index if not exists operational_alerts_tenant_status_idx on operational_alerts (tenant_id, status, severity, created_at desc);")
    conn.execute("create index if not exists operational_alert_deliveries_alert_idx on operational_alert_deliveries (tenant_id, alert_id, created_at desc);")
    conn.execute(
        """
        insert into model_prices (model, input_per_million, output_per_million)
        values ('openai/text-embedding-3-small', 0.02, 0)
        on conflict (model) do update set
          input_per_million = excluded.input_per_million,
          output_per_million = excluded.output_per_million
        """
    )
