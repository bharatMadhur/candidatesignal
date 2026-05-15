from __future__ import annotations

import argparse

from resume_intel.db import migrate
from resume_intel.parse_jobs import reconcile_parse_jobs


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize and clean stale candidatSignal.ai parse-job state.")
    parser.add_argument("--tenant-id", default=None, help="Optional tenant id to restrict reconciliation.")
    parser.add_argument("--stale-after-hours", type=int, default=24, help="Cancel queued/running jobs older than this many hours.")
    args = parser.parse_args()

    migrate()
    result = reconcile_parse_jobs(stale_after_hours=args.stale_after_hours, tenant_id=args.tenant_id)
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
