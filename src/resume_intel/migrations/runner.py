from __future__ import annotations

import importlib
import pkgutil
from types import ModuleType

import psycopg

from . import versions


def run_versioned_migrations(conn: psycopg.Connection) -> None:
    """Apply migration modules in lexical VERSION order.

    The existing project keeps a consolidated baseline for local-dev simplicity.
    New production schema changes should land as modules under
    resume_intel.migrations.versions so they are reviewable, repeatable, and
    independently auditable.
    """

    applied = {
        row["version"]
        for row in conn.execute("select version from schema_migrations").fetchall()
    }
    for module in _migration_modules():
        version = getattr(module, "VERSION")
        if version in applied:
            continue
        upgrade = getattr(module, "upgrade", None)
        if not callable(upgrade):
            raise RuntimeError(f"Migration {module.__name__} does not define upgrade(conn)")
        upgrade(conn)
        conn.execute(
            """
            insert into schema_migrations (version, description)
            values (%s, %s)
            """,
            (version, getattr(module, "DESCRIPTION", module.__name__)),
        )


def _migration_modules() -> list[ModuleType]:
    modules: list[ModuleType] = []
    for item in pkgutil.iter_modules(versions.__path__, f"{versions.__name__}."):
        if item.ispkg:
            continue
        module = importlib.import_module(item.name)
        if not hasattr(module, "VERSION"):
            continue
        modules.append(module)
    return sorted(modules, key=lambda module: getattr(module, "VERSION"))

