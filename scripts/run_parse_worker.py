from __future__ import annotations

import argparse
import socket
import time
import uuid

from resume_intel.db import migrate
from resume_intel.parse_jobs import record_worker_heartbeat, run_next_job


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the candidatSignal.ai durable parse-job worker.")
    parser.add_argument("--tenant-id", default=None, help="Optional tenant id to restrict the worker.")
    parser.add_argument("--once", action="store_true", help="Process one queued job and exit.")
    parser.add_argument("--sleep", type=float, default=2.0, help="Seconds to sleep when no job is queued.")
    parser.add_argument("--worker-id", default=None, help="Stable worker id for heartbeat/status reporting.")
    args = parser.parse_args()

    migrate()
    worker_id = args.worker_id or f"{socket.gethostname()}-{uuid.uuid4().hex[:8]}"
    record_worker_heartbeat(worker_id, status="starting", tenant_id=args.tenant_id)
    print(f"worker {worker_id} started")
    while True:
        job = run_next_job(args.tenant_id, worker_id=worker_id)
        if job:
            print(f"processed {job['id']} status={job['status']} stage={job['stage']}")
        elif args.once:
            print("no queued jobs")
            record_worker_heartbeat(worker_id, status="stopped", tenant_id=args.tenant_id)
            return 0
        else:
            time.sleep(args.sleep)
        if args.once:
            return 0


if __name__ == "__main__":
    raise SystemExit(main())
