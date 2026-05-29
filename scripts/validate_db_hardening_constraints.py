from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from resume_intel.db_hardening import validate_hardening_constraints


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate tenant hardening constraints after data audit.")
    parser.add_argument("--apply", action="store_true", help="Actually validate constraints. Default is dry-run.")
    args = parser.parse_args()

    report = validate_hardening_constraints(dry_run=not args.apply)
    print(json.dumps(report, indent=2, sort_keys=True, default=str))
    return 0 if not report.get("remaining_invalid") or not args.apply else 1


if __name__ == "__main__":
    raise SystemExit(main())
