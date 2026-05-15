from __future__ import annotations

import argparse

from resume_intel.db import migrate
from resume_intel.db_store import rebuild_normalized_candidate_analytics


def main() -> int:
    parser = argparse.ArgumentParser(description="Rebuild normalized candidate analytics tables from canonical JSONB profiles.")
    parser.add_argument("--tenant-id", default=None, help="Optional tenant id. Omit to rebuild all tenants.")
    args = parser.parse_args()
    migrate()
    count = rebuild_normalized_candidate_analytics(args.tenant_id)
    print(f"rebuilt normalized analytics for {count} candidate(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

