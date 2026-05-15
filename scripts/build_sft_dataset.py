from __future__ import annotations

import json
import sys
from pathlib import Path


SYSTEM_PROMPT = """You are a precise resume parsing engine.
Return only valid JSON. Do not include markdown.
Extract every detail present in the resume. Do not invent missing facts.
Use null for unknown scalar values and [] for unknown lists.
Preserve all experience bullets and project bullets.
Normalize dates to YYYY-MM where possible, otherwise keep the original text.
"""


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: python scripts/build_sft_dataset.py <parsed-output-dir> <output-jsonl>")
        return 2

    parsed_dir = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    output_path.parent.mkdir(parents=True, exist_ok=True)

    count = 0
    with output_path.open("w") as out:
        for parsed_path in sorted(parsed_dir.glob("*.parsed.json")):
            document_id = parsed_path.name.removesuffix(".parsed.json")
            raw_text_path = parsed_dir / f"{document_id}.raw.txt"
            if not raw_text_path.exists():
                continue

            parsed = json.loads(parsed_path.read_text())
            parsed.pop("_metadata", None)
            example = {
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": raw_text_path.read_text()},
                    {"role": "assistant", "content": json.dumps(parsed, ensure_ascii=False)},
                ]
            }
            out.write(json.dumps(example, ensure_ascii=False) + "\n")
            count += 1

    print(f"wrote {count} examples to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

