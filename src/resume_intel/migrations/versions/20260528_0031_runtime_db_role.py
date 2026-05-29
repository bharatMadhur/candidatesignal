from __future__ import annotations


VERSION = "20260528_0031_runtime_db_role"
DESCRIPTION = "Create limited runtime database role for enforced RLS application access"


RUNTIME_ROLE = "resume_intel_app_runtime"


def upgrade(conn) -> None:
    conn.execute(
        f"""
        do $$
        begin
          if not exists (select 1 from pg_roles where rolname = '{RUNTIME_ROLE}') then
            create role {RUNTIME_ROLE} nologin nosuperuser nocreatedb nocreaterole noinherit;
          end if;
        end $$;
        """
    )
    conn.execute(f"grant {RUNTIME_ROLE} to current_user")
    conn.execute(f"grant usage on schema public to {RUNTIME_ROLE}")
    conn.execute(f"grant select, insert, update, delete on all tables in schema public to {RUNTIME_ROLE}")
    conn.execute(f"grant usage, select, update on all sequences in schema public to {RUNTIME_ROLE}")
    conn.execute(f"alter default privileges in schema public grant select, insert, update, delete on tables to {RUNTIME_ROLE}")
    conn.execute(f"alter default privileges in schema public grant usage, select, update on sequences to {RUNTIME_ROLE}")
