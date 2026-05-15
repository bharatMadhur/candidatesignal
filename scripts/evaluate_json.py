from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


FIELDS = [
    "name",
    "contact.email",
    "contact.phone",
    "skills",
    "experience",
    "education",
    "projects",
    "certifications",
]


def get_path(obj: dict[str, Any], dotted: str) -> Any:
    current: Any = obj
    for part in dotted.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def normalize(value: Any) -> Any:
    if isinstance(value, str):
        return " ".join(value.lower().split())
    if isinstance(value, list):
        return [normalize(item) for item in value]
    if isinstance(value, dict):
        return {key: normalize(val) for key, val in sorted(value.items()) if key != "_metadata"}
    return value


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: python scripts/evaluate_json.py <parsed-output-dir> <gold-json-dir>")
        return 2

    parsed_dir = Path(sys.argv[1])
    gold_dir = Path(sys.argv[2])
    totals = {field: {"correct": 0, "total": 0} for field in FIELDS}

    for parsed_path in sorted(parsed_dir.glob("*.parsed.json")):
        gold_path = gold_dir / parsed_path.name
        if not gold_path.exists():
            continue
        predicted = json.loads(parsed_path.read_text())
        gold = json.loads(gold_path.read_text())
        for field in FIELDS:
            totals[field]["total"] += 1
            if normalize(get_path(predicted, field)) == normalize(get_path(gold, field)):
                totals[field]["correct"] += 1

    for field, stats in totals.items():
        total = stats["total"]
        score = stats["correct"] / total if total else 0
        print(f"{field}: {stats['correct']}/{total} = {score:.2%}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

