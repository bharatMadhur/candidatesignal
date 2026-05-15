from __future__ import annotations

from pathlib import Path
from typing import Any

from psycopg.types.json import Jsonb

from resume_intel.db import db, migrate
from resume_intel.storage import document_storage


def main() -> int:
    migrate()
    count = 0
    with db() as conn:
        rows = conn.execute(
            """
            select candidates.document_id, candidates.tenant_id, candidates.created_by_user_id,
                   candidates.source_file, candidates.raw_text, candidates.record_json
            from candidates
            left join candidate_documents
              on candidate_documents.tenant_id=candidates.tenant_id
             and candidate_documents.document_id=candidates.document_id
            where candidate_documents.id is null
            order by candidates.updated_at desc
            """
        ).fetchall()

    for row in rows:
        if _backfill_candidate(row):
            count += 1
    print(f"backfilled {count} candidate documents")
    return 0


def _backfill_candidate(row: dict[str, Any]) -> bool:
    source_file = row.get("source_file")
    if not source_file:
        return False
    source_path = Path(source_file)
    if not source_path.exists() or not source_path.is_file():
        return False

    tenant_id = str(row["tenant_id"])
    record = dict(row["record_json"] or {})
    with source_path.open("rb") as handle:
        stored = document_storage().save_upload(
            tenant_id=tenant_id,
            namespace=f"resumes/backfill/{row['document_id']}",
            filename=record.get("original_filename") or source_path.name,
            file_obj=handle,
            content_type=record.get("mime_type"),
        )

    metadata = record.setdefault("_metadata", {})
    extraction_method = metadata.get("extraction_method") or "legacy_backfill"
    page_count = int(metadata.get("page_count") or 1)
    record.update(
        {
            "storage_backend": stored.backend,
            "storage_key": stored.key,
            "original_filename": stored.original_filename,
            "mime_type": stored.content_type,
            "size_bytes": stored.size_bytes,
            "source_sha256": stored.sha256,
        }
    )
    metadata["storage"] = {
        "storage_backend": stored.backend,
        "storage_key": stored.key,
        "original_filename": stored.original_filename,
        "mime_type": stored.content_type,
        "size_bytes": stored.size_bytes,
        "sha256": stored.sha256,
    }
    pages = _pages_from_record(record, row.get("raw_text"), extraction_method)

    with db() as conn:
        conn.execute(
            """
            update candidates
            set storage_backend=%s, storage_key=%s, original_filename=%s, mime_type=%s,
                size_bytes=%s, source_sha256=%s, record_json=%s, updated_at=now()
            where document_id=%s and tenant_id=%s
            """,
            (
                stored.backend,
                stored.key,
                stored.original_filename,
                stored.content_type,
                stored.size_bytes,
                stored.sha256,
                Jsonb(record),
                row["document_id"],
                tenant_id,
            ),
        )
        document = conn.execute(
            """
            insert into candidate_documents (
              tenant_id, document_id, storage_backend, storage_key, original_filename,
              mime_type, size_bytes, sha256, uploaded_by_user_id, extraction_method, page_count
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            on conflict (tenant_id, storage_backend, storage_key) do update set
              document_id=excluded.document_id,
              original_filename=excluded.original_filename,
              mime_type=excluded.mime_type,
              size_bytes=excluded.size_bytes,
              sha256=excluded.sha256,
              extraction_method=excluded.extraction_method,
              page_count=excluded.page_count
            returning id
            """,
            (
                tenant_id,
                row["document_id"],
                stored.backend,
                stored.key,
                stored.original_filename,
                stored.content_type,
                stored.size_bytes,
                stored.sha256,
                row.get("created_by_user_id"),
                extraction_method,
                page_count,
            ),
        ).fetchone()
        conn.execute("delete from document_pages where candidate_document_id=%s", (document["id"],))
        for page in pages:
            conn.execute(
                """
                insert into document_pages (
                  tenant_id, document_id, candidate_document_id, page_number,
                  extraction_method, raw_text, quality_flags
                )
                values (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    tenant_id,
                    row["document_id"],
                    document["id"],
                    page["page_number"],
                    page["extraction_method"],
                    page["raw_text"],
                    Jsonb(page["quality_flags"]),
                ),
            )
        conn.commit()
    return True


def _pages_from_record(record: dict[str, Any], raw_text: str | None, extraction_method: str) -> list[dict[str, Any]]:
    metadata_pages = (record.get("_metadata") or {}).get("pages") or []
    pages: list[dict[str, Any]] = []
    for index, page in enumerate(metadata_pages):
        if not isinstance(page, dict):
            continue
        pages.append(
            {
                "page_number": int(page.get("page_number") or index + 1),
                "extraction_method": page.get("method") or extraction_method,
                "raw_text": page.get("text") or "",
                "quality_flags": page.get("quality_flags") or [],
            }
        )
    if pages:
        return pages
    return [
        {
            "page_number": 1,
            "extraction_method": extraction_method,
            "raw_text": raw_text or "",
            "quality_flags": ["legacy_single_page_backfill"],
        }
    ]


if __name__ == "__main__":
    raise SystemExit(main())
