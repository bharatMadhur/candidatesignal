from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .coverage import primary_key_coverage


def load_candidate(output_dir: Path, document_id: str) -> dict[str, Any]:
    path = output_dir / f"{document_id}.parsed.json"
    if not path.exists():
        raise FileNotFoundError(document_id)
    return json.loads(path.read_text())


def save_candidate(output_dir: Path, record: dict[str, Any]) -> Path:
    document_id = record["document_id"]
    record["primary_key_coverage"] = primary_key_coverage(record)
    path = output_dir / f"{document_id}.parsed.json"
    path.write_text(json.dumps(record, indent=2, ensure_ascii=False))
    _rewrite_dataset(output_dir)
    return path


def add_note(output_dir: Path, document_id: str, name: str, content: str) -> dict[str, Any]:
    record = load_candidate(output_dir, document_id)
    notes = record.setdefault("notes", [])
    notes.append(
        {
            "name": name.strip() or "HR Note",
            "content": content.strip(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    save_candidate(output_dir, record)
    return record


def list_candidates(output_dir: Path) -> list[dict[str, Any]]:
    candidates = []
    for path in sorted(output_dir.glob("*.parsed.json")):
        record = json.loads(path.read_text())
        candidates.append(
            {
                "document_id": record.get("document_id"),
                "name": record.get("name"),
                "current_title": record.get("derived", {}).get("hr_profile", {}).get("current_title"),
                "current_company": record.get("derived", {}).get("hr_profile", {}).get("current_company"),
                "coverage": record.get("primary_key_coverage", {}).get("score"),
                "source_file": record.get("source_file"),
            }
        )
    return candidates


def _rewrite_dataset(output_dir: Path) -> None:
    dataset_path = output_dir / "dataset.jsonl"
    with dataset_path.open("w") as dataset:
        for path in sorted(output_dir.glob("*.parsed.json")):
            dataset.write(json.dumps(json.loads(path.read_text()), ensure_ascii=False) + "\n")

