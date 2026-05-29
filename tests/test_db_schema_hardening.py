from __future__ import annotations

import sys
import unittest
from importlib import import_module
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

schema_hardening = import_module(
    "resume_intel.migrations.versions.20260528_0026_tenant_schema_hardening"
)


class _RecordingConnection:
    def __init__(self) -> None:
        self.sql: list[str] = []

    def execute(self, sql: str, *args: object) -> None:
        self.sql.append(" ".join(sql.lower().split()))


class DbSchemaHardeningMigrationTests(unittest.TestCase):
    def test_migration_adds_tenant_required_write_guards(self) -> None:
        conn = _RecordingConnection()

        schema_hardening.upgrade(conn)
        joined_sql = "\n".join(conn.sql)

        self.assertIn("candidates_tenant_id_required", joined_sql)
        self.assertIn("notes_tenant_id_required", joined_sql)
        self.assertIn("requirements_tenant_id_required", joined_sql)
        self.assertIn("check (tenant_id is not null) not valid", joined_sql)

    def test_migration_adds_tenant_scoped_candidate_references(self) -> None:
        conn = _RecordingConnection()

        schema_hardening.upgrade(conn)
        joined_sql = "\n".join(conn.sql)

        self.assertIn("create unique index if not exists candidates_tenant_document_uidx", joined_sql)
        self.assertIn("foreign key (tenant_id, document_id) references candidates (tenant_id, document_id)", joined_sql)
        self.assertIn("foreign key (tenant_id, candidate_id) references candidates (tenant_id, document_id)", joined_sql)
        self.assertIn("not valid", joined_sql)

    def test_migration_adds_candidate_summary_read_model(self) -> None:
        conn = _RecordingConnection()

        schema_hardening.upgrade(conn)
        joined_sql = "\n".join(conn.sql)

        self.assertIn("create table if not exists candidate_profile_summaries", joined_sql)
        self.assertIn("refresh_candidate_profile_summary", joined_sql)
        self.assertIn("jsonb_typeof", joined_sql)
        self.assertIn("candidate_profile_summaries_skills_gin", joined_sql)

    def test_migration_adds_rls_groundwork_without_forcing_app_breakage(self) -> None:
        conn = _RecordingConnection()

        schema_hardening.upgrade(conn)
        joined_sql = "\n".join(conn.sql)

        self.assertIn("create or replace function app_current_tenant_id()", joined_sql)
        self.assertIn("alter table candidates enable row level security", joined_sql)
        self.assertIn("create policy candidates_tenant_isolation_policy", joined_sql)
        self.assertNotIn("force row level security", joined_sql)

    def test_migration_adds_retention_policy_table_for_high_growth_data(self) -> None:
        conn = _RecordingConnection()

        schema_hardening.upgrade(conn)
        joined_sql = "\n".join(conn.sql)

        self.assertIn("create table if not exists data_retention_policies", joined_sql)
        self.assertIn("parse_job_events", joined_sql)
        self.assertIn("llm_usage_events", joined_sql)
        self.assertIn("candidate_search_chunks", joined_sql)

    def test_latest_migration_adds_campaign_and_retention_read_models(self) -> None:
        retention_migration = import_module(
            "resume_intel.migrations.versions.20260528_0028_retention_and_campaign_summaries"
        )
        conn = _RecordingConnection()

        retention_migration.upgrade(conn)
        joined_sql = "\n".join(conn.sql)

        self.assertIn("create table if not exists data_retention_runs", joined_sql)
        self.assertIn("create table if not exists data_retention_archives", joined_sql)
        self.assertIn("create table if not exists campaign_pipeline_summaries", joined_sql)
        self.assertIn("refresh_campaign_pipeline_summary", joined_sql)
        self.assertIn("campaign_pipeline_summaries_tenant_isolation_policy", joined_sql)

    def test_latest_migration_replaces_null_bypass_with_explicit_internal_access(self) -> None:
        strict_rls_migration = import_module(
            "resume_intel.migrations.versions.20260528_0029_strict_explicit_rls"
        )
        conn = _RecordingConnection()

        strict_rls_migration.upgrade(conn)
        joined_sql = "\n".join(conn.sql)

        self.assertIn("create or replace function app_internal_access()", joined_sql)
        self.assertIn("app_internal_access()", joined_sql)
        self.assertIn("tenant_id = app_current_tenant_id()", joined_sql)
        self.assertNotIn("app_current_tenant_id() is null", joined_sql)
        self.assertNotIn("tenant_id is null", joined_sql)

    def test_latest_migration_forces_tenant_rls_for_table_owners(self) -> None:
        force_rls_migration = import_module(
            "resume_intel.migrations.versions.20260528_0030_force_tenant_rls"
        )
        conn = _RecordingConnection()

        force_rls_migration.upgrade(conn)
        joined_sql = "\n".join(conn.sql)

        self.assertIn("alter table candidates force row level security", joined_sql)
        self.assertIn("alter table job_campaigns force row level security", joined_sql)
        self.assertIn("alter table candidate_search_chunks force row level security", joined_sql)

    def test_latest_migration_adds_limited_runtime_db_role(self) -> None:
        runtime_role_migration = import_module(
            "resume_intel.migrations.versions.20260528_0031_runtime_db_role"
        )
        conn = _RecordingConnection()

        runtime_role_migration.upgrade(conn)
        joined_sql = "\n".join(conn.sql)

        self.assertIn("create role resume_intel_app_runtime nologin nosuperuser nocreatedb nocreaterole noinherit", joined_sql)
        self.assertIn("grant resume_intel_app_runtime to current_user", joined_sql)
        self.assertIn("grant select, insert, update, delete on all tables in schema public", joined_sql)


if __name__ == "__main__":
    unittest.main()
