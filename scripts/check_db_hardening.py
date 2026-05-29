from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.db import database_runtime_role, db, db_tenant_context


REQUIRED_MIGRATIONS = {
    "20260528_0026_tenant_schema_hardening",
    "20260528_0027_candidate_summary_rls",
    "20260528_0028_retention_and_campaign_summaries",
    "20260528_0029_strict_explicit_rls",
    "20260528_0030_force_tenant_rls",
    "20260528_0031_runtime_db_role",
}

REQUIRED_CONSTRAINTS = {
    "candidates_tenant_id_required",
    "notes_tenant_id_required",
    "requirements_tenant_id_required",
    "notes_document_id_tenant_candidate_fk",
    "candidate_search_chunks_document_id_tenant_candidate_fk",
    "requirement_matches_candidate_id_tenant_candidate_fk",
}

REQUIRED_INDEXES = {
    "candidates_tenant_document_uidx",
    "candidate_profile_summaries_tenant_updated_idx",
    "candidate_profile_summaries_skills_gin",
    "campaign_pipeline_summaries_tenant_updated_idx",
    "data_retention_runs_table_started_idx",
}

VECTOR_INDEXES = {
    "candidate_search_chunks_embedding_hnsw_idx",
    "candidate_search_chunks_embedding_ivfflat_idx",
}

REQUIRED_RLS_TABLES = {
    "candidates",
    "notes",
    "candidate_search_chunks",
    "candidate_profile_summaries",
    "requirements",
    "job_campaigns",
    "campaign_pipeline_summaries",
}


def main() -> int:
    report = collect_report()
    print(json.dumps(report, indent=2, sort_keys=True, default=str))
    return 0 if report["ok"] else 1


def collect_report() -> dict[str, Any]:
    with db(internal=True) as conn:
        migrations = _values(
            conn.execute(
                "select version from schema_migrations where version = any(%s) order by version",
                (list(REQUIRED_MIGRATIONS),),
            ).fetchall(),
            "version",
        )
        constraints = _values(
            conn.execute(
                "select conname from pg_constraint where conname = any(%s) order by conname",
                (list(REQUIRED_CONSTRAINTS),),
            ).fetchall(),
            "conname",
        )
        indexes = _values(
            conn.execute(
                "select indexname from pg_indexes where indexname = any(%s) order by indexname",
                (list(REQUIRED_INDEXES | VECTOR_INDEXES),),
            ).fetchall(),
            "indexname",
        )
        rls_rows = conn.execute(
            """
            select relname, relrowsecurity, relforcerowsecurity
            from pg_class
            join pg_namespace on pg_namespace.oid = pg_class.relnamespace
            where pg_namespace.nspname = 'public'
              and relname = any(%s)
            order by relname
            """,
            (list(REQUIRED_RLS_TABLES),),
        ).fetchall()
        policy_rows = conn.execute(
            """
            select tablename, policyname, qual, with_check
            from pg_policies
            where schemaname = 'public'
              and tablename = any(%s)
            order by tablename
            """,
            (list(REQUIRED_RLS_TABLES),),
        ).fetchall()
        summary_rows = conn.execute(
            """
            select
              count(*) filter (where candidates.deleted_at is null and candidates.tenant_id is not null) as active_candidates,
              count(candidate_profile_summaries.document_id) as candidate_summaries
            from candidates
            left join candidate_profile_summaries
              on candidate_profile_summaries.tenant_id = candidates.tenant_id
             and candidate_profile_summaries.document_id = candidates.document_id
            where candidates.deleted_at is null
            """
        ).fetchone()
        campaign_summary_rows = conn.execute(
            """
            select
              count(*) filter (where job_campaigns.deleted_at is null and job_campaigns.tenant_id is not null) as active_campaigns,
              count(campaign_pipeline_summaries.campaign_id) as campaign_summaries
            from job_campaigns
            left join campaign_pipeline_summaries
              on campaign_pipeline_summaries.tenant_id = job_campaigns.tenant_id
             and campaign_pipeline_summaries.campaign_id = job_campaigns.id
            where job_campaigns.deleted_at is null
            """
        ).fetchone()
        tenant_probe = conn.execute(
            """
            select tenant_id, count(*) as candidate_count
            from candidates
            where deleted_at is null and tenant_id is not null
            group by tenant_id
            order by candidate_count desc
            limit 1
            """
        ).fetchone()
        role_probe = conn.execute(
            """
            select current_user as current_user,
                   session_user as session_user,
                   pg_roles.rolsuper,
                   pg_roles.rolbypassrls
            from pg_roles
            where pg_roles.rolname = current_user
            """
        ).fetchone()

    no_context_candidates = _count_candidates_without_tenant_context()
    tenant_context_candidates = None
    expected_tenant_candidates = 0
    if tenant_probe:
        expected_tenant_candidates = int(tenant_probe["candidate_count"] or 0)
        tenant_context_candidates = _count_candidates_for_tenant_context(str(tenant_probe["tenant_id"]))

    rls_enabled = {row["relname"] for row in rls_rows if row["relrowsecurity"]}
    force_rls_enabled = {row["relname"] for row in rls_rows if row["relforcerowsecurity"]}
    missing = {
        "migrations": sorted(REQUIRED_MIGRATIONS - migrations),
        "constraints": sorted(REQUIRED_CONSTRAINTS - constraints),
        "indexes": sorted(REQUIRED_INDEXES - indexes),
        "vector_indexes": [] if indexes & VECTOR_INDEXES else sorted(VECTOR_INDEXES),
        "rls_tables": sorted(REQUIRED_RLS_TABLES - rls_enabled),
        "forced_rls_tables": sorted(REQUIRED_RLS_TABLES - force_rls_enabled),
        "strict_rls_policies": sorted(_tables_without_strict_rls_policy(policy_rows)),
        "runtime_rls_enforcement": _runtime_rls_errors(
            no_context_candidates,
            tenant_context_candidates,
            expected_tenant_candidates,
        ),
        "runtime_db_role": _runtime_role_errors(role_probe),
    }
    active_candidates = int(summary_rows["active_candidates"] or 0)
    candidate_summaries = int(summary_rows["candidate_summaries"] or 0)
    summary_complete = candidate_summaries >= active_candidates
    active_campaigns = int(campaign_summary_rows["active_campaigns"] or 0)
    campaign_summaries = int(campaign_summary_rows["campaign_summaries"] or 0)
    campaign_summary_complete = campaign_summaries >= active_campaigns
    return {
        "ok": not any(missing.values()) and summary_complete and campaign_summary_complete,
        "missing": missing,
        "candidate_summary_coverage": {
            "active_candidates": active_candidates,
            "candidate_summaries": candidate_summaries,
            "complete": summary_complete,
        },
        "campaign_summary_coverage": {
            "active_campaigns": active_campaigns,
            "campaign_summaries": campaign_summaries,
            "complete": campaign_summary_complete,
        },
        "rls_enabled": sorted(rls_enabled),
        "force_rls_enabled": sorted(force_rls_enabled),
        "runtime_rls_enforcement": {
            "no_context_candidate_count": no_context_candidates,
            "tenant_context_candidate_count": tenant_context_candidates,
            "expected_tenant_candidate_count": expected_tenant_candidates,
        },
        "runtime_db_role": {
            "configured_role": database_runtime_role(),
            "current_user": role_probe["current_user"] if role_probe else None,
            "session_user": role_probe["session_user"] if role_probe else None,
            "is_superuser": bool(role_probe["rolsuper"]) if role_probe else None,
            "bypasses_rls": bool(role_probe["rolbypassrls"]) if role_probe else None,
        },
    }


def _values(rows: list[dict[str, Any]], key: str) -> set[str]:
    return {str(row[key]) for row in rows}


def _tables_without_strict_rls_policy(rows: list[dict[str, Any]]) -> set[str]:
    strict_tables: set[str] = set()
    for row in rows:
        policy_text = f"{row.get('qual') or ''} {row.get('with_check') or ''}".lower()
        if "app_internal_access()" in policy_text and "tenant_id = app_current_tenant_id()" in policy_text:
            if "app_current_tenant_id() is null" not in policy_text and "tenant_id is null" not in policy_text:
                strict_tables.add(str(row["tablename"]))
    return REQUIRED_RLS_TABLES - strict_tables


def _count_candidates_without_tenant_context() -> int:
    with db() as conn:
        row = conn.execute("select count(*) as count from candidates where deleted_at is null").fetchone()
    return int(row["count"] or 0)


def _count_candidates_for_tenant_context(tenant_id: str) -> int:
    with db_tenant_context(tenant_id):
        with db() as conn:
            row = conn.execute("select count(*) as count from candidates where deleted_at is null").fetchone()
    return int(row["count"] or 0)


def _runtime_rls_errors(
    no_context_candidates: int,
    tenant_context_candidates: int | None,
    expected_tenant_candidates: int,
) -> list[str]:
    errors: list[str] = []
    if no_context_candidates != 0:
        errors.append("candidate rows are visible without tenant or internal DB context")
    if tenant_context_candidates is not None and tenant_context_candidates != expected_tenant_candidates:
        errors.append("tenant DB context does not expose exactly that tenant's candidate rows")
    return errors


def _runtime_role_errors(row: dict[str, Any] | None) -> list[str]:
    expected_role = database_runtime_role()
    if not expected_role:
        return ["RESUME_INTEL_DB_RUNTIME_ROLE is disabled"]
    if not row:
        return ["runtime DB role probe failed"]
    errors: list[str] = []
    if row["current_user"] != expected_role:
        errors.append("application DB connection did not switch to the configured runtime role")
    if bool(row["rolsuper"]):
        errors.append("runtime DB role is superuser")
    if bool(row["rolbypassrls"]):
        errors.append("runtime DB role has BYPASSRLS")
    return errors


if __name__ == "__main__":
    raise SystemExit(main())
