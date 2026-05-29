from __future__ import annotations


VERSION = "20260528_0027_candidate_summary_rls"
DESCRIPTION = "Apply tenant RLS policy to candidate profile summaries"


def upgrade(conn) -> None:
    conn.execute("alter table candidate_profile_summaries enable row level security")
    conn.execute("drop policy if exists candidate_profile_summaries_tenant_isolation_policy on candidate_profile_summaries")
    conn.execute(
        """
        create policy candidate_profile_summaries_tenant_isolation_policy on candidate_profile_summaries
        using (
          app_current_tenant_id() is null
          or tenant_id is null
          or tenant_id = app_current_tenant_id()
        )
        with check (
          app_current_tenant_id() is null
          or tenant_id is null
          or tenant_id = app_current_tenant_id()
        )
        """
    )
