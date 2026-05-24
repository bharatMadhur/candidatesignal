from __future__ import annotations

import json
from pathlib import Path

from .derive import add_derived_fields, normalize_domain_years
from .extractors import IMAGE_EXTENSIONS, extract_document
from .llm import extract_resume_json_with_usage, run_deep_resume_intelligence
from .settings import Settings
from .timeline import build_timeline_profile
from .validate import validate_resume
from .coverage import primary_key_coverage
from .workstreams import nest_same_company_workstreams


TEXT_EXTENSIONS = {".txt", ".md"}
SUPPORTED_EXTENSIONS = {".pdf", ".docx", *TEXT_EXTENSIONS, *IMAGE_EXTENSIONS}


def parse_file(path: Path, output_dir: Path, work_dir: Path, settings: Settings, storage_metadata: dict | None = None) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    work_dir.mkdir(parents=True, exist_ok=True)

    extracted = extract_document(path, settings, work_dir)
    raw_text_path = output_dir / f"{extracted.document_id}.raw.txt"
    model_path = output_dir / f"{extracted.document_id}.model.json"
    hr_model_path = output_dir / f"{extracted.document_id}.deep_intelligence.json"
    parsed_path = output_dir / f"{extracted.document_id}.parsed.json"
    validation_path = output_dir / f"{extracted.document_id}.validation.json"

    raw_text_path.write_text(extracted.text)

    model_json, factual_usage = extract_resume_json_with_usage(
        document_id=extracted.document_id,
        source_file=str(path),
        text=extracted.text,
        settings=settings,
    )
    model_json["document_id"] = extracted.document_id
    model_json["source_file"] = str(path)
    _merge_extracted_links_into_model_json(model_json, extracted.links or [])
    model_json = nest_same_company_workstreams(model_json)
    model_path.write_text(json.dumps(model_json, indent=2, ensure_ascii=False))

    record, validation = validate_resume(model_json, extracted.text)
    record = add_derived_fields(record, extracted.text)
    result = record.model_dump(mode="json")
    timeline_profile = build_timeline_profile(result)
    result["derived"]["timeline"] = timeline_profile
    result["derived"]["hr_profile"]["total_years_experience"] = timeline_profile["experience_accounting"][
        "total_years_unique"
    ]
    result["derived"]["hr_profile"]["total_months_experience"] = timeline_profile["experience_accounting"][
        "total_months_unique"
    ]
    normalize_domain_years(result, extracted.text)
    deep_parse_status = "succeeded"
    deep_parse_error: str | None = None
    try:
        deep_intelligence = run_deep_resume_intelligence(
            document_id=extracted.document_id,
            source_file=str(path),
            text=extracted.text,
            base_resume_json=result,
            timeline_profile=timeline_profile,
            derived_profile=result.get("derived", {}),
            settings=settings,
            initial_usage=[factual_usage],
        )
    except Exception as exc:
        deep_parse_status = "failed"
        deep_parse_error = str(exc)
        deep_intelligence = {
            "error": str(exc),
            "status": "failed",
            "fallback": "factual_extraction_and_deterministic_timeline_only",
            "timeline": timeline_profile,
            "llm_usage": [factual_usage],
            "llm_usage_totals": {
                "input_tokens": int(factual_usage.get("input_tokens") or 0),
                "output_tokens": int(factual_usage.get("output_tokens") or 0),
                "total_tokens": int(factual_usage.get("input_tokens") or 0) + int(factual_usage.get("output_tokens") or 0),
            },
        }
    hr_model_path.write_text(json.dumps(deep_intelligence, indent=2, ensure_ascii=False))
    result["candidate_intelligence"] = deep_intelligence
    result["llm_hr_intelligence"] = deep_intelligence.get("hr_intelligence", deep_intelligence)
    _backfill_skills_from_intelligence(result, deep_intelligence)
    result["llm_usage"] = deep_intelligence.get("llm_usage", [])
    result["llm_usage_totals"] = deep_intelligence.get("llm_usage_totals", {})
    result["primary_key_coverage"] = primary_key_coverage(result)
    parse_quality = {
        "deep_parse_status": deep_parse_status,
        "deep_parse_error": deep_parse_error,
        "coverage_status": result["primary_key_coverage"].get("status"),
        "coverage_score": result["primary_key_coverage"].get("score"),
        "extraction_method": extracted.method,
        "quality_flags": sorted({
            flag
            for page in extracted.pages or []
            for flag in page.get("quality_flags", [])
            if flag
        }),
    }
    result["_metadata"] = {
        "extraction_method": extracted.method,
        "page_count": extracted.page_count,
        "pages": extracted.pages or [],
        "links": extracted.links or [],
        "parse_quality": parse_quality,
        "model_path": str(model_path),
        "hr_model_path": str(hr_model_path),
        "raw_text_path": str(raw_text_path),
        "validation_path": str(validation_path),
    }
    if storage_metadata:
        result["_metadata"]["storage"] = storage_metadata
        result["storage_backend"] = storage_metadata.get("storage_backend")
        result["storage_key"] = storage_metadata.get("storage_key")
        result["original_filename"] = storage_metadata.get("original_filename")
        result["mime_type"] = storage_metadata.get("mime_type")
        result["size_bytes"] = storage_metadata.get("size_bytes")
        result["source_sha256"] = storage_metadata.get("sha256")

    parsed_path.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    validation_path.write_text(json.dumps(validation, indent=2, ensure_ascii=False))
    return result


def _backfill_skills_from_intelligence(record: dict, intelligence: dict) -> None:
    if record.get("skills"):
        return
    taxonomy = ((intelligence.get("hr_intelligence") or {}).get("skill_taxonomy") or {})
    values: list[str] = []
    for items in taxonomy.values():
        if isinstance(items, list):
            values.extend(str(item).strip() for item in items if str(item).strip())
    final_profile = intelligence.get("final_candidate_profile") or {}
    values.extend(str(item).strip() for item in ((final_profile.get("summary_card") or {}).get("top_skills") or []) if str(item).strip())
    seen: set[str] = set()
    skills: list[str] = []
    for value in values:
        key = value.lower()
        if key not in seen:
            seen.add(key)
            skills.append(value)
    record["skills"] = skills[:80]


def _merge_extracted_links_into_model_json(model_json: dict, links: list[dict]) -> None:
    urls = [str(link.get("url") or "").strip() for link in links if str(link.get("url") or "").strip()]
    if not urls:
        return
    contact = model_json.setdefault("contact", {})
    existing = contact.get("links") or []
    merged: list[str] = []
    seen: set[str] = set()
    for value in [*existing, *urls]:
        text = str(value).strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        merged.append(text)
    contact["links"] = merged
    model_json.setdefault("derived", {})["document_links"] = links


def iter_resume_files(input_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in input_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )


def parse_dir(input_dir: Path, output_dir: Path, work_dir: Path, settings: Settings) -> list[dict]:
    records: list[dict] = []
    dataset_path = output_dir / "dataset.jsonl"
    output_dir.mkdir(parents=True, exist_ok=True)

    with dataset_path.open("w") as dataset:
        for path in iter_resume_files(input_dir):
            record = parse_file(path, output_dir, work_dir, settings)
            records.append(record)
            dataset.write(json.dumps(record, ensure_ascii=False) + "\n")
    return records
