from __future__ import annotations

import argparse

from resume_intel.db import db_internal_access, db_tenant_context, migrate
from resume_intel.db_store import rebuild_normalized_candidate_analytics


def main() -> int:
    parser = argparse.ArgumentParser(description="Rebuild normalized candidate analytics tables from canonical JSONB profiles.")
    parser.add_argument("--tenant-id", default=None, help="Optional tenant id. Omit to rebuild all tenants.")
    args = parser.parse_args()
    migrate()
    context = db_tenant_context(args.tenant_id) if args.tenant_id else db_internal_access()
    with context:
        count = rebuild_normalized_candidate_analytics(args.tenant_id)
    print(f"rebuilt normalized analytics for {count} candidate(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
