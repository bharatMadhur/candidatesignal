from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.db_hardening import RetentionRunOptions, run_retention_policies


def main() -> int:
    parser = argparse.ArgumentParser(description="Run configured database retention policies.")
    parser.add_argument("--apply", action="store_true", help="Archive and delete rows for enabled policies. Default is dry-run.")
    parser.add_argument("--table", help="Limit execution to one retention policy table.")
    parser.add_argument("--limit", type=int, default=5000, help="Maximum rows per table per run.")
    args = parser.parse_args()

    report = run_retention_policies(
        RetentionRunOptions(
            dry_run=not args.apply,
            table_name=args.table,
            limit=args.limit,
        )
    )
    print(json.dumps(report, indent=2, sort_keys=True, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
