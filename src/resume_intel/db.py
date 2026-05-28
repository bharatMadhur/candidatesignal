from __future__ import annotations

import base64
import hashlib
import os
import secrets
from contextlib import contextmanager
from typing import Iterator

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

SCHEMA_BASELINE_VERSION = "20260512_0001_consolidated_baseline"
LOCAL_DEV_PASSWORD = "resume-intel"
LOCAL_DEV_ADMIN_EMAIL = "admin@example.com"
LOCAL_DEV_RECRUITER_EMAIL = "recruiter@example.com"
LOCAL_DEV_CANDIDATE_EMAIL = "candidate@example.com"


def database_url() -> str:
    load_dotenv()
    value = os.getenv("DATABASE_URL") or _secret_file("DATABASE_URL_FILE")
    if not value:
        raise RuntimeError("DATABASE_URL is not set")
    return value


def _secret_file(name: str) -> str | None:
    path = os.getenv(name)
    if not path:
        return None
    try:
        with open(path, "r", encoding="utf-8") as handle:
            value = handle.read().strip()
    except OSError:
        return None
    return value or None


def _hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return "pbkdf2_sha256$310000$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(digest).decode()


def _seed_local_dev_users_enabled() -> bool:
    explicit = os.getenv("RESUME_INTEL_SEED_LOCAL_USERS", "").strip().lower()
    if explicit in {"0", "false", "no", "off"}:
        return False
    env = (os.getenv("RESUME_INTEL_ENV") or os.getenv("APP_ENV") or "").strip().lower()
    if env in {"production", "prod"}:
        return False
    auth_url = (os.getenv("BETTER_AUTH_URL") or "").strip().lower()
    if auth_url and "localhost" not in auth_url and "127.0.0.1" not in auth_url:
        return explicit in {"1", "true", "yes", "on"}
    return True


@contextmanager
def db() -> Iterator[psycopg.Connection]:
    with psycopg.connect(database_url(), row_factory=dict_row) as conn:
        yield conn


def migrate() -> None:
    with db() as conn:
        conn.execute(
            """
            create table if not exists schema_migrations (
              version text primary key,
              description text not null,
              applied_at timestamptz not null default now()
            )
            """
        )
        conn.execute(
            """
            create extension if not exists pgcrypto;
            create extension if not exists vector;

            create table if not exists users (
              id uuid primary key default gen_random_uuid(),
              name text,
              email text not null unique,
              password_hash text not null,
              role text not null default 'recruiter',
              email_verified boolean not null default false,
              image text,
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now()
            );

            create table if not exists sessions (
              id uuid primary key default gen_random_uuid(),
              token text not null unique,
              user_id uuid not null references users(id) on delete cascade,
              expires_at timestamptz not null,
              ip_address text,
              user_agent text,
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now()
            );

            create table if not exists accounts (
              id uuid primary key default gen_random_uuid(),
              user_id uuid not null references users(id) on delete cascade,
              account_id text not null,
              provider_id text not null,
              access_token text,
              refresh_token text,
              id_token text,
              access_token_expires_at timestamptz,
              refresh_token_expires_at timestamptz,
              scope text,
              password text,
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now(),
              unique (provider_id, account_id)
            );

            create table if not exists verifications (
              id uuid primary key default gen_random_uuid(),
              identifier text not null,
              value text not null,
              expires_at timestamptz not null,
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now()
            );

            create table if not exists tenants (
              id uuid primary key default gen_random_uuid(),
              name text not null,
              slug text not null unique,
              status text not null default 'pending',
              plan text not null default 'manual',
              seat_limit integer not null default 5,
              created_by_user_id uuid references users(id) on delete set null,
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now()
            );

            create table if not exists tenant_memberships (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              user_id uuid not null references users(id) on delete cascade,
              role text not null default 'recruiter',
              status text not null default 'active',
              invited_by_user_id uuid references users(id) on delete set null,
              joined_at timestamptz,
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now(),
              unique (tenant_id, user_id)
            );

            create table if not exists tenant_invitations (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              email text not null,
              role text not null default 'recruiter',
              token_hash text not null unique,
              status text not null default 'pending',
              expires_at timestamptz not null,
              accepted_at timestamptz,
              invited_by_user_id uuid references users(id) on delete set null,
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now()
            );

            create table if not exists tenant_governance_policies (
              tenant_id uuid primary key references tenants(id) on delete cascade,
              external_llm_synthesis_enabled boolean not null default false,
              redact_pii_before_external_llm boolean not null default true,
              contact_pii_visible_to_roles jsonb not null default '["tenant_owner", "tenant_admin", "recruiter"]'::jsonb,
              updated_by_user_id uuid references users(id) on delete set null,
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now()
            );

            create table if not exists candidates (
              document_id text primary key,
              tenant_id uuid references tenants(id) on delete cascade,
              owner_user_id uuid references users(id) on delete set null,
              created_by_user_id uuid references users(id) on delete set null,
              source_file text not null,
              storage_backend text,
              storage_key text,
              original_filename text,
              mime_type text,
              size_bytes bigint,
              source_sha256 text,
              name text,
              email text,
              phone text,
              record_json jsonb not null,
              raw_text text,
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now()
            );

            create table if not exists notes (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid references tenants(id) on delete cascade,
              document_id text not null references candidates(document_id) on delete cascade,
              user_id uuid references users(id) on delete set null,
              name text not null,
              content text not null,
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now(),
              deleted_at timestamptz
            );

            create table if not exists candidate_documents (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              document_id text references candidates(document_id) on delete cascade,
              storage_backend text not null,
              storage_key text not null,
              original_filename text not null,
              mime_type text,
              size_bytes bigint,
              sha256 text not null,
              uploaded_by_user_id uuid references users(id) on delete set null,
              extraction_method text,
              page_count integer,
              created_at timestamptz not null default now(),
              unique (tenant_id, storage_backend, storage_key)
            );

            create table if not exists document_blobs (
              storage_key text primary key,
              tenant_id uuid not null references tenants(id) on delete cascade,
              namespace text not null,
              original_filename text not null,
              content_type text,
              size_bytes bigint not null,
              sha256 text not null,
              data bytea not null,
              created_at timestamptz not null default now()
            );

            create table if not exists document_pages (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              document_id text references candidates(document_id) on delete cascade,
              candidate_document_id uuid references candidate_documents(id) on delete cascade,
              page_number integer not null,
              extraction_method text not null,
              raw_text text not null,
              quality_flags jsonb not null default '[]'::jsonb,
              created_at timestamptz not null default now(),
              unique (candidate_document_id, page_number)
            );

            create table if not exists candidate_version_matches (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid references tenants(id) on delete cascade,
              left_document_id text not null references candidates(document_id) on delete cascade,
              right_document_id text not null references candidates(document_id) on delete cascade,
              score numeric not null,
              reasons jsonb not null,
              status text not null default 'suggested',
              decided_by uuid references users(id) on delete set null,
              decided_at timestamptz,
              created_at timestamptz not null default now(),
              unique (left_document_id, right_document_id)
            );

            create table if not exists candidate_version_events (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              canonical_document_id text not null,
              merged_document_id text not null,
              match_id uuid references candidate_version_matches(id) on delete set null,
              decided_by uuid references users(id) on delete set null,
              metadata jsonb not null default '{}'::jsonb,
              created_at timestamptz not null default now()
            );

            create table if not exists requirements (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid references tenants(id) on delete cascade,
              owner_user_id uuid references users(id) on delete set null,
              created_by_user_id uuid references users(id) on delete set null,
              title text,
              source_type text not null,
              original_text text not null,
              extracted_json jsonb not null,
              clarification_questions jsonb not null default '[]'::jsonb,
              recruiter_answers jsonb not null default '{}'::jsonb,
              final_profile jsonb,
              status text not null default 'draft',
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now()
            );

            create table if not exists requirement_matches (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid references tenants(id) on delete cascade,
              requirement_id uuid not null references requirements(id) on delete cascade,
              candidate_id text not null references candidates(document_id) on delete cascade,
              total_score numeric not null,
              must_have_score numeric not null,
              nice_to_have_score numeric not null,
              years_score numeric not null,
              domain_score numeric not null,
              location_score numeric not null,
              evidence jsonb not null,
              gaps jsonb not null,
              recommendation text not null,
              status text not null default 'ranked',
              created_at timestamptz not null default now(),
              unique (requirement_id, candidate_id)
            );

            create table if not exists requirement_match_runs (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid references tenants(id) on delete cascade,
              requirement_id uuid not null references requirements(id) on delete cascade,
              run_number integer not null,
              candidate_count integer not null default 0,
              eligible_count integer not null default 0,
              blocked_count integer not null default 0,
              top_score numeric not null default 0,
              average_score numeric not null default 0,
              profile_snapshot jsonb not null,
              matches_snapshot jsonb not null,
              created_at timestamptz not null default now(),
              unique (requirement_id, run_number)
            );

            create table if not exists job_campaigns (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              created_by_user_id uuid references users(id) on delete set null,
              requirement_id uuid references requirements(id) on delete set null,
              name text not null,
              description text not null default '',
              status text not null default 'active',
              deleted_at timestamptz,
              deleted_by_user_id uuid references users(id) on delete set null,
              deleted_reason text,
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now()
            );

            create table if not exists campaign_match_jobs (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              campaign_id uuid not null references job_campaigns(id) on delete cascade,
              requirement_id uuid references requirements(id) on delete set null,
              created_by_user_id uuid references users(id) on delete set null,
              mode text not null default 'full',
              candidate_ids jsonb not null default '[]'::jsonb,
              status text not null default 'queued',
              stage text not null default 'queued',
              attempt_count integer not null default 0,
              max_attempts integer not null default 2,
              result jsonb not null default '{}'::jsonb,
              error_message text,
              started_at timestamptz,
              completed_at timestamptz,
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now()
            );

            create table if not exists campaign_candidates (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              campaign_id uuid not null references job_campaigns(id) on delete cascade,
              candidate_id text not null references candidates(document_id) on delete cascade,
              source text not null default 'matched',
              status text not null default 'recommended',
              score numeric not null default 0,
              evidence jsonb not null default '{}'::jsonb,
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now(),
              unique (campaign_id, candidate_id)
            );

            create table if not exists requirement_embeddings (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid references tenants(id) on delete cascade,
              requirement_id uuid not null references requirements(id) on delete cascade,
              chunk_text text not null,
              embedding_model text not null default 'unknown',
              embedding vector(1536) not null,
              created_at timestamptz not null default now()
            );

            create table if not exists parse_batches (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              campaign_id uuid references job_campaigns(id) on delete set null,
              created_by_user_id uuid references users(id) on delete set null,
              name text not null,
              source_type text not null default 'bulk_upload',
              total_files integer not null default 0,
              queued_count integer not null default 0,
              processing_count integer not null default 0,
              completed_count integer not null default 0,
              failed_count integer not null default 0,
              status text not null default 'created',
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now(),
              completed_at timestamptz
            );

            create table if not exists parse_jobs (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              batch_id uuid references parse_batches(id) on delete cascade,
              campaign_id uuid references job_campaigns(id) on delete set null,
              created_by_user_id uuid references users(id) on delete set null,
              source_file text not null,
              storage_backend text,
              storage_key text,
              source_hash text not null,
              original_filename text not null,
              mime_type text,
              size_bytes bigint,
              warning_message text,
              initial_note_name text,
              initial_note_content text,
              document_id text,
              status text not null default 'queued',
              stage text not null default 'queued',
              attempt_count integer not null default 0,
              max_attempts integer not null default 2,
              error_message text,
              ocr_used boolean,
              input_tokens integer not null default 0,
              output_tokens integer not null default 0,
              total_tokens integer not null default 0,
              estimated_cost numeric not null default 0,
              started_at timestamptz,
              completed_at timestamptz,
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now()
            );

            create table if not exists parse_worker_heartbeats (
              worker_id text primary key,
              tenant_id uuid references tenants(id) on delete set null,
              status text not null default 'idle',
              current_job_id uuid references parse_jobs(id) on delete set null,
              processed_jobs integer not null default 0,
              last_error text,
              metadata jsonb not null default '{}'::jsonb,
              started_at timestamptz not null default now(),
              last_seen_at timestamptz not null default now()
            );

            create table if not exists parse_job_events (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              batch_id uuid references parse_batches(id) on delete cascade,
              job_id uuid not null references parse_jobs(id) on delete cascade,
              event_type text not null,
              status text not null,
              stage text not null,
              message text,
              metadata jsonb not null default '{}'::jsonb,
              created_at timestamptz not null default now()
            );

            create table if not exists parse_job_dead_letters (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              batch_id uuid references parse_batches(id) on delete cascade,
              job_id uuid not null references parse_jobs(id) on delete cascade,
              error_message text not null,
              attempt_count integer not null default 0,
              status text not null default 'open',
              resolved_by uuid references users(id) on delete set null,
              resolved_at timestamptz,
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now(),
              unique (job_id)
            );

            create table if not exists copilot_threads (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              created_by_user_id uuid references users(id) on delete set null,
              title text not null default 'New Copilot Thread',
              status text not null default 'active',
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now()
            );

            create table if not exists copilot_messages (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              thread_id uuid not null references copilot_threads(id) on delete cascade,
              user_id uuid references users(id) on delete set null,
              role text not null,
              content text not null,
              query text,
              candidates_snapshot jsonb not null default '[]'::jsonb,
              clarifying_questions jsonb not null default '[]'::jsonb,
              suggested_actions jsonb not null default '[]'::jsonb,
              metadata jsonb not null default '{}'::jsonb,
              created_at timestamptz not null default now()
            );

            create table if not exists audit_logs (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid references tenants(id) on delete cascade,
              user_id uuid references users(id) on delete set null,
              action text not null,
              entity_type text not null,
              entity_id text,
              metadata jsonb not null default '{}'::jsonb,
              created_at timestamptz not null default now()
            );

            create table if not exists candidate_search_chunks (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              document_id text not null references candidates(document_id) on delete cascade,
              chunk_type text not null,
              chunk_text text not null,
              source_label text,
              page_number integer,
              embedding_model text not null,
              embedding vector(1536) not null,
              created_at timestamptz not null default now()
            );

            create table if not exists llm_usage_events (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid references tenants(id) on delete cascade,
              document_id text references candidates(document_id) on delete cascade,
              requirement_id uuid references requirements(id) on delete cascade,
              parse_job_id uuid references parse_jobs(id) on delete set null,
              pass_name text not null,
              provider text not null,
              model text not null,
              input_tokens integer not null default 0,
              output_tokens integer not null default 0,
              total_tokens integer not null default 0,
              estimated_cost numeric not null default 0,
              latency_ms integer,
              status text not null default 'succeeded',
              error_message text,
              created_at timestamptz not null default now()
            );

            create table if not exists candidate_skills (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              document_id text not null references candidates(document_id) on delete cascade,
              skill text not null,
              category text,
              source text not null default 'parsed',
              created_at timestamptz not null default now(),
              unique (tenant_id, document_id, skill)
            );

            create table if not exists candidate_experience (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              document_id text not null references candidates(document_id) on delete cascade,
              company text,
              title text,
              location text,
              start_date text,
              end_date text,
              duration_years numeric,
              bullets jsonb not null default '[]'::jsonb,
              workstreams jsonb not null default '[]'::jsonb,
              sort_index integer not null default 0,
              created_at timestamptz not null default now()
            );

            create table if not exists candidate_education (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              document_id text not null references candidates(document_id) on delete cascade,
              school text,
              degree text,
              field text,
              sort_index integer not null default 0,
              created_at timestamptz not null default now()
            );

            create table if not exists candidate_certifications (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              document_id text not null references candidates(document_id) on delete cascade,
              certification text not null,
              created_at timestamptz not null default now(),
              unique (tenant_id, document_id, certification)
            );

            create table if not exists candidate_domain_years (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              document_id text not null references candidates(document_id) on delete cascade,
              domain text not null,
              years numeric not null default 0,
              evidence jsonb not null default '{}'::jsonb,
              created_at timestamptz not null default now(),
              unique (tenant_id, document_id, domain)
            );

            create table if not exists candidate_locations (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              document_id text not null references candidates(document_id) on delete cascade,
              location text not null,
              country text,
              signal_type text not null default 'unknown',
              source text,
              created_at timestamptz not null default now()
            );

            create table if not exists pii_access_events (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid not null references tenants(id) on delete cascade,
              user_id uuid references users(id) on delete set null,
              document_id text references candidates(document_id) on delete cascade,
              fields jsonb not null default '[]'::jsonb,
              action text not null default 'view',
              created_at timestamptz not null default now()
            );

            create table if not exists operational_alerts (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid references tenants(id) on delete cascade,
              alert_type text not null,
              severity text not null default 'warning',
              title text not null,
              body text not null,
              entity_type text,
              entity_id text,
              status text not null default 'open',
              metadata jsonb not null default '{}'::jsonb,
              created_at timestamptz not null default now(),
              acknowledged_by uuid references users(id) on delete set null,
              acknowledged_at timestamptz,
              resolved_at timestamptz
            );

            create table if not exists operational_alert_deliveries (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid references tenants(id) on delete cascade,
              alert_id uuid not null references operational_alerts(id) on delete cascade,
              channel text not null,
              destination text not null,
              status text not null,
              status_code integer,
              latency_ms integer,
              error_message text,
              payload jsonb not null default '{}'::jsonb,
              created_at timestamptz not null default now()
            );

            create table if not exists mail_messages (
              id uuid primary key default gen_random_uuid(),
              tenant_id uuid references tenants(id) on delete cascade,
              user_id uuid references users(id) on delete set null,
              provider text not null,
              message_type text not null,
              status text not null default 'queued',
              to_email text not null,
              from_email text not null,
              from_name text,
              subject text not null,
              text_body text,
              html_body text,
              reply_to text,
              provider_message_id text,
              provider_response jsonb not null default '{}'::jsonb,
              error_message text,
              metadata jsonb not null default '{}'::jsonb,
              sent_at timestamptz,
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now()
            );

            create table if not exists mail_events (
              id uuid primary key default gen_random_uuid(),
              mail_message_id uuid not null references mail_messages(id) on delete cascade,
              tenant_id uuid references tenants(id) on delete cascade,
              provider text not null,
              event_type text not null,
              payload jsonb not null default '{}'::jsonb,
              created_at timestamptz not null default now()
            );

            create table if not exists model_prices (
              model text primary key,
              input_per_million numeric not null default 0,
              output_per_million numeric not null default 0,
              updated_at timestamptz not null default now()
            );
            """
        )
        conn.execute("alter table users alter column password_hash drop not null;")
        conn.execute("alter table users add column if not exists name text;")
        conn.execute("alter table users add column if not exists email_verified boolean not null default false;")
        conn.execute("alter table users add column if not exists image text;")
        conn.execute("alter table users add column if not exists updated_at timestamptz not null default now();")
        conn.execute("alter table sessions add column if not exists id uuid default gen_random_uuid();")
        conn.execute("alter table sessions alter column id type text using id::text;")
        conn.execute("alter table sessions add column if not exists active_tenant_id uuid references tenants(id) on delete set null;")
        conn.execute("alter table sessions add column if not exists ip_address text;")
        conn.execute("alter table sessions add column if not exists user_agent text;")
        conn.execute("alter table sessions add column if not exists updated_at timestamptz not null default now();")
        conn.execute("alter table sessions add column if not exists revoked_at timestamptz;")
        conn.execute("alter table candidates add column if not exists tenant_id uuid references tenants(id) on delete cascade;")
        conn.execute("alter table candidates add column if not exists created_by_user_id uuid references users(id) on delete set null;")
        conn.execute("alter table candidates add column if not exists storage_backend text;")
        conn.execute("alter table candidates add column if not exists storage_key text;")
        conn.execute("alter table candidates add column if not exists original_filename text;")
        conn.execute("alter table candidates add column if not exists mime_type text;")
        conn.execute("alter table candidates add column if not exists size_bytes bigint;")
        conn.execute("alter table candidates add column if not exists source_sha256 text;")
        conn.execute("alter table notes add column if not exists tenant_id uuid references tenants(id) on delete cascade;")
        conn.execute("alter table notes add column if not exists updated_at timestamptz not null default now();")
        conn.execute("alter table notes add column if not exists deleted_at timestamptz;")
        conn.execute("alter table candidate_version_matches add column if not exists tenant_id uuid references tenants(id) on delete cascade;")
        conn.execute("alter table requirements add column if not exists tenant_id uuid references tenants(id) on delete cascade;")
        conn.execute("alter table requirements add column if not exists created_by_user_id uuid references users(id) on delete set null;")
        conn.execute("alter table requirement_matches add column if not exists tenant_id uuid references tenants(id) on delete cascade;")
        conn.execute("alter table requirement_match_runs add column if not exists tenant_id uuid references tenants(id) on delete cascade;")
        conn.execute("alter table requirement_embeddings add column if not exists tenant_id uuid references tenants(id) on delete cascade;")
        conn.execute("alter table parse_jobs add column if not exists storage_backend text;")
        conn.execute("alter table parse_jobs add column if not exists storage_key text;")
        conn.execute("alter table parse_jobs add column if not exists mime_type text;")
        conn.execute("alter table parse_jobs add column if not exists size_bytes bigint;")
        conn.execute("alter table parse_jobs add column if not exists warning_message text;")
        conn.execute("alter table parse_jobs add column if not exists initial_note_name text;")
        conn.execute("alter table parse_jobs add column if not exists initial_note_content text;")
        conn.execute("alter table parse_jobs add column if not exists campaign_id uuid references job_campaigns(id) on delete set null;")
        conn.execute("alter table parse_batches add column if not exists campaign_id uuid references job_campaigns(id) on delete set null;")
        conn.execute("alter table parse_worker_heartbeats add column if not exists tenant_id uuid references tenants(id) on delete set null;")
        conn.execute("alter table parse_worker_heartbeats add column if not exists processed_jobs integer not null default 0;")
        conn.execute("alter table parse_worker_heartbeats add column if not exists last_error text;")
        conn.execute("alter table parse_worker_heartbeats add column if not exists metadata jsonb not null default '{}'::jsonb;")
        conn.execute("alter table parse_job_events add column if not exists batch_id uuid references parse_batches(id) on delete cascade;")
        conn.execute("alter table parse_job_events add column if not exists message text;")
        conn.execute("alter table parse_job_events add column if not exists metadata jsonb not null default '{}'::jsonb;")
        conn.execute("alter table parse_job_dead_letters add column if not exists status text not null default 'open';")
        conn.execute("alter table parse_job_dead_letters add column if not exists resolved_by uuid references users(id) on delete set null;")
        conn.execute("alter table parse_job_dead_letters add column if not exists resolved_at timestamptz;")
        conn.execute("alter table parse_job_dead_letters add column if not exists updated_at timestamptz not null default now();")
        conn.execute("alter table copilot_threads add column if not exists status text not null default 'active';")
        conn.execute("alter table copilot_threads add column if not exists updated_at timestamptz not null default now();")
        conn.execute("alter table copilot_messages add column if not exists metadata jsonb not null default '{}'::jsonb;")
        conn.execute("alter table operational_alerts add column if not exists acknowledged_by uuid references users(id) on delete set null;")
        conn.execute("alter table operational_alerts add column if not exists acknowledged_at timestamptz;")
        conn.execute("alter table operational_alerts add column if not exists resolved_at timestamptz;")
        conn.execute("alter table pii_access_events add column if not exists metadata jsonb not null default '{}'::jsonb;")
        conn.execute("alter table accounts alter column id type text using id::text;")
        conn.execute("alter table verifications alter column id type text using id::text;")
        conn.execute(
            """
            insert into tenants (name, slug, status, plan, seat_limit)
            values ('Local Development Tenant', 'local-dev', 'active', 'manual', 25)
            on conflict (slug) do nothing
            """
        )
        if _seed_local_dev_users_enabled():
            conn.execute(
                """
                insert into users (email, password_hash, role, name, email_verified, updated_at)
                values (%s, %s, 'platform_admin', 'Local Platform Admin', true, now())
                on conflict (email) do update set
                  name = coalesce(users.name, excluded.name),
                  role = 'platform_admin',
                  email_verified = true,
                  updated_at = now()
                """,
                (LOCAL_DEV_ADMIN_EMAIL, _hash_password(LOCAL_DEV_PASSWORD)),
            )
            conn.execute(
                """
                insert into users (email, password_hash, role, name, email_verified, updated_at)
                values (%s, %s, 'recruiter', 'Local Recruiter', true, now())
                on conflict (email) do update set
                  name = coalesce(users.name, excluded.name),
                  role = case
                    when users.role in ('admin', 'platform_admin') then users.role
                    else users.role
                  end,
                  email_verified = true,
                  updated_at = now()
                """,
                (LOCAL_DEV_RECRUITER_EMAIL, _hash_password(LOCAL_DEV_PASSWORD)),
            )
        conn.execute(
            """
            update candidates set tenant_id = (select id from tenants where slug='local-dev') where tenant_id is null;
            update notes set tenant_id = (select id from tenants where slug='local-dev') where tenant_id is null;
            update candidate_version_matches set tenant_id = (select id from tenants where slug='local-dev') where tenant_id is null;
            update requirements set tenant_id = (select id from tenants where slug='local-dev') where tenant_id is null;
            update requirement_matches set tenant_id = (select id from tenants where slug='local-dev') where tenant_id is null;
            update requirement_embeddings set tenant_id = (select id from tenants where slug='local-dev') where tenant_id is null;
            insert into tenant_memberships (tenant_id, user_id, role, status, joined_at)
            select (select id from tenants where slug='local-dev'), users.id,
                   case when users.role in ('admin', 'platform_admin') then 'tenant_owner' else users.role end,
                   'active', now()
            from users
            where users.role not in ('admin', 'platform_admin', 'candidate')
              and not exists (
                select 1 from tenant_memberships
                where tenant_memberships.user_id = users.id
                  and tenant_memberships.status='active'
              )
              and not exists (
              select 1 from tenant_memberships
              where tenant_memberships.tenant_id = (select id from tenants where slug='local-dev')
                and tenant_memberships.user_id = users.id
            );
            insert into accounts (user_id, account_id, provider_id, password)
            select users.id, users.id::text, 'credential', users.password_hash
            from users
            where users.password_hash is not null
            on conflict (provider_id, account_id) do update set
              password=excluded.password,
              updated_at=now();
            """
        )
        if _seed_local_dev_users_enabled():
            conn.execute(
                """
                update tenant_memberships
                set role='tenant_owner', updated_at=now()
                from users
                where tenant_memberships.user_id = users.id
                  and tenant_memberships.tenant_id = (select id from tenants where slug='local-dev')
                  and lower(users.email) = lower(%s)
                  and tenant_memberships.status='active'
                """,
                (LOCAL_DEV_RECRUITER_EMAIL,),
            )
        conn.execute(
            """
            update tenant_memberships
            set status='disabled', updated_at=now()
            from users
            where tenant_memberships.user_id = users.id
              and users.role in ('admin', 'platform_admin', 'candidate')
              and tenant_memberships.status='active'
            """
        )
        conn.execute(
            """
            update tenant_memberships local_membership
            set status='disabled', updated_at=now()
            from tenants local_tenant
            where local_membership.tenant_id = local_tenant.id
              and local_tenant.slug='local-dev'
              and local_membership.status='active'
              and exists (
                select 1
                from tenant_memberships other_membership
                where other_membership.user_id = local_membership.user_id
                  and other_membership.id <> local_membership.id
                  and other_membership.status='active'
              )
            """
        )
        conn.execute("create index if not exists candidates_email_idx on candidates (lower(email));")
        conn.execute("create index if not exists candidates_phone_idx on candidates (phone);")
        conn.execute("create index if not exists candidates_tenant_idx on candidates (tenant_id, updated_at desc);")
        conn.execute("create index if not exists candidates_record_json_gin on candidates using gin (record_json);")
        conn.execute("create index if not exists requirements_status_idx on requirements (tenant_id, status);")
        conn.execute("create index if not exists requirement_matches_req_idx on requirement_matches (tenant_id, requirement_id, total_score desc);")
        conn.execute("create index if not exists requirement_match_runs_req_idx on requirement_match_runs (tenant_id, requirement_id, created_at desc);")
        conn.execute("create index if not exists campaign_match_jobs_tenant_status_idx on campaign_match_jobs (tenant_id, status, created_at);")
        conn.execute("create index if not exists campaign_match_jobs_campaign_idx on campaign_match_jobs (tenant_id, campaign_id, created_at desc);")
        conn.execute("create index if not exists requirement_embeddings_req_idx on requirement_embeddings (tenant_id, requirement_id);")
        conn.execute("create index if not exists parse_jobs_status_idx on parse_jobs (tenant_id, status, created_at);")
        conn.execute("create index if not exists parse_job_events_job_idx on parse_job_events (tenant_id, job_id, created_at);")
        conn.execute("create index if not exists parse_job_events_batch_idx on parse_job_events (tenant_id, batch_id, created_at);")
        conn.execute("create index if not exists parse_job_dead_letters_tenant_idx on parse_job_dead_letters (tenant_id, status, created_at desc);")
        conn.execute("create index if not exists parse_batches_tenant_idx on parse_batches (tenant_id, updated_at desc);")
        conn.execute("create index if not exists copilot_threads_tenant_idx on copilot_threads (tenant_id, status, updated_at desc);")
        conn.execute("create index if not exists copilot_messages_thread_idx on copilot_messages (tenant_id, thread_id, created_at);")
        conn.execute("alter table job_campaigns add column if not exists deleted_at timestamptz;")
        conn.execute("alter table job_campaigns add column if not exists deleted_by_user_id uuid references users(id) on delete set null;")
        conn.execute("alter table job_campaigns add column if not exists deleted_reason text;")
        conn.execute("create index if not exists job_campaigns_tenant_idx on job_campaigns (tenant_id, updated_at desc);")
        conn.execute("create index if not exists job_campaigns_active_tenant_idx on job_campaigns (tenant_id, updated_at desc) where deleted_at is null;")
        conn.execute("create index if not exists campaign_candidates_campaign_idx on campaign_candidates (tenant_id, campaign_id, score desc);")
        conn.execute("create index if not exists parse_worker_seen_idx on parse_worker_heartbeats (tenant_id, last_seen_at desc);")
        conn.execute("create index if not exists memberships_user_idx on tenant_memberships (user_id, status);")
        conn.execute("create unique index if not exists tenant_memberships_one_active_company_idx on tenant_memberships (user_id) where status='active';")
        conn.execute("create index if not exists tenant_governance_updated_idx on tenant_governance_policies (updated_at desc);")
        conn.execute("create index if not exists candidate_documents_doc_idx on candidate_documents (tenant_id, document_id);")
        conn.execute("create index if not exists document_blobs_tenant_idx on document_blobs (tenant_id, namespace, created_at desc);")
        conn.execute("create index if not exists document_pages_doc_idx on document_pages (tenant_id, document_id, page_number);")
        conn.execute("create index if not exists candidate_search_chunks_doc_idx on candidate_search_chunks (tenant_id, document_id);")
        conn.execute("create index if not exists llm_usage_doc_idx on llm_usage_events (tenant_id, document_id, created_at desc);")
        conn.execute("create index if not exists candidate_skills_tenant_skill_idx on candidate_skills (tenant_id, lower(skill));")
        conn.execute("create index if not exists candidate_experience_tenant_company_idx on candidate_experience (tenant_id, lower(company));")
        conn.execute("create index if not exists candidate_education_tenant_school_idx on candidate_education (tenant_id, lower(school));")
        conn.execute("create index if not exists candidate_domain_years_tenant_domain_idx on candidate_domain_years (tenant_id, domain, years desc);")
        conn.execute("create index if not exists candidate_locations_tenant_country_idx on candidate_locations (tenant_id, country);")
        conn.execute("create index if not exists pii_access_events_tenant_doc_idx on pii_access_events (tenant_id, document_id, created_at desc);")
        conn.execute("create index if not exists operational_alerts_tenant_status_idx on operational_alerts (tenant_id, status, severity, created_at desc);")
        conn.execute("create index if not exists operational_alert_deliveries_alert_idx on operational_alert_deliveries (tenant_id, alert_id, created_at desc);")
        conn.execute("create index if not exists mail_messages_tenant_status_idx on mail_messages (tenant_id, status, created_at desc);")
        conn.execute("create index if not exists mail_messages_provider_message_idx on mail_messages (provider, provider_message_id);")
        conn.execute("create index if not exists mail_events_message_idx on mail_events (mail_message_id, created_at desc);")
        conn.execute("create index if not exists mail_events_tenant_idx on mail_events (tenant_id, event_type, created_at desc);")
        conn.execute("create index if not exists candidate_version_events_tenant_idx on candidate_version_events (tenant_id, canonical_document_id, created_at desc);")
        conn.execute(
            """
            insert into model_prices (model, input_per_million, output_per_million)
            values
              ('openai/gpt-5-nano', 0, 0),
              ('openai/text-embedding-3-small', 0.02, 0)
            on conflict (model) do nothing
            """
        )
        conn.execute(
            """
            insert into schema_migrations (version, description)
            values (%s, 'Consolidated legacy migrate baseline')
            on conflict (version) do nothing
            """,
            (SCHEMA_BASELINE_VERSION,),
        )
        from .migrations.runner import run_versioned_migrations

        run_versioned_migrations(conn)
        if _seed_local_dev_users_enabled():
            conn.execute(
                """
                insert into users (email, password_hash, role, name, email_verified, updated_at)
                values (%s, %s, 'candidate', 'Local Candidate', true, now())
                on conflict (email) do update set
                  name = coalesce(users.name, excluded.name),
                  role = case
                    when users.role in ('admin', 'platform_admin', 'recruiter') then users.role
                    else 'candidate'
                  end,
                  email_verified = true,
                  updated_at = now()
                """,
                (LOCAL_DEV_CANDIDATE_EMAIL, _hash_password(LOCAL_DEV_PASSWORD)),
            )
            conn.execute(
                """
                insert into candidate_profiles (user_id, display_name, headline, profile_json)
                select users.id, coalesce(users.name, 'Local Candidate'), 'Candidate profile workspace',
                       jsonb_build_object(
                         'display_name', coalesce(users.name, 'Local Candidate'),
                         'email', users.email,
                         'headline', 'Candidate profile workspace',
                         'skills', '[]'::jsonb,
                         'experience', '[]'::jsonb,
                         'education', '[]'::jsonb,
                         'certifications', '[]'::jsonb,
                         'projects', '[]'::jsonb,
                         'links', '[]'::jsonb
                       )
                from users
                where lower(users.email)=lower(%s)
                on conflict (user_id) do nothing
                """,
                (LOCAL_DEV_CANDIDATE_EMAIL,),
            )
            conn.execute(
                """
                insert into accounts (user_id, account_id, provider_id, password)
                select users.id, users.id::text, 'credential', users.password_hash
                from users
                where lower(users.email)=lower(%s)
                  and users.password_hash is not null
                on conflict (provider_id, account_id) do update set
                  password=excluded.password,
                  updated_at=now()
                """,
                (LOCAL_DEV_CANDIDATE_EMAIL,),
            )
        conn.execute(
            """
            update tenant_memberships
            set status='disabled', updated_at=now()
            from users
            where tenant_memberships.user_id = users.id
              and users.role='candidate'
              and tenant_memberships.status='active'
            """
        )
        conn.commit()


def applied_migrations() -> list[dict[str, str]]:
    with db() as conn:
        conn.execute(
            """
            create table if not exists schema_migrations (
              version text primary key,
              description text not null,
              applied_at timestamptz not null default now()
            )
            """
        )
        rows = conn.execute("select version, description, applied_at from schema_migrations order by version").fetchall()
    return [
        {
            "version": row["version"],
            "description": row["description"],
            "applied_at": row["applied_at"].isoformat() if row["applied_at"] else "",
        }
        for row in rows
    ]
