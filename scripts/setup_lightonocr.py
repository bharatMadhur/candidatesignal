from __future__ import annotations

import os
import sys
from pathlib import Path

from huggingface_hub import snapshot_download


ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / ".cache" / "huggingface"
MODEL_ID = os.getenv("LIGHTONOCR_MODEL", "lightonai/LightOnOCR-2-1B-base")


def configure_local_cache() -> None:
    os.environ["HF_HOME"] = str(CACHE_DIR)
    os.environ["HF_HUB_CACHE"] = str(CACHE_DIR / "hub")
    os.environ["TRANSFORMERS_CACHE"] = str(CACHE_DIR / "transformers")
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def main() -> int:
    configure_local_cache()
    target_dir = ROOT / "models" / MODEL_ID.replace("/", "__")
    target_dir.parent.mkdir(parents=True, exist_ok=True)

    print(f"downloading {MODEL_ID}")
    print(f"cache: {CACHE_DIR}")
    print(f"target: {target_dir}")
    snapshot_download(
        repo_id=MODEL_ID,
        local_dir=target_dir,
        local_dir_use_symlinks=False,
        resume_download=True,
    )
    print("download complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

