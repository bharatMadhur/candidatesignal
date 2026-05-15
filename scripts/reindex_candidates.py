from __future__ import annotations

import argparse

from resume_intel.db import db, migrate
from resume_intel.db_store import save_candidate_db
from resume_intel.maintenance_jobs import rederive_candidate_record


def main() -> int:
    parser = argparse.ArgumentParser(description="Deterministically rederive candidate JSON/analytics and optionally refresh semantic search chunks.")
    parser.add_argument(
        "--skip-embeddings",
        action="store_true",
        help="Do not refresh semantic search embeddings. This keeps all resume text local.",
    )
    args = parser.parse_args()
    migrate()
    count = 0
    with db() as conn:
        rows = conn.execute("select tenant_id, record_json, raw_text from candidates order by updated_at desc").fetchall()
    for row in rows:
        record = rederive_candidate_record(row["record_json"], row["raw_text"])
        save_candidate_db(
            record,
            row["raw_text"],
            None,
            str(row["tenant_id"]) if row["tenant_id"] else None,
            reindex_search=not args.skip_embeddings,
        )
        count += 1
    mode = "rederived without embedding refresh" if args.skip_embeddings else "reindexed"
    print(f"{mode} {count} candidates")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
