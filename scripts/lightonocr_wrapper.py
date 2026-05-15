from __future__ import annotations

import os
import sys
from pathlib import Path

import torch
from transformers import LightOnOcrForConditionalGeneration, LightOnOcrProcessor


ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / ".cache" / "huggingface"
MODEL_ID = os.getenv("LIGHTONOCR_MODEL", "lightonai/LightOnOCR-2-1B-base")
LOCAL_MODEL_DIR = ROOT / "models" / MODEL_ID.replace("/", "__")


def configure_local_cache() -> None:
    os.environ["HF_HOME"] = str(CACHE_DIR)
    os.environ["HF_HUB_CACHE"] = str(CACHE_DIR / "hub")
    os.environ["TRANSFORMERS_CACHE"] = str(CACHE_DIR / "transformers")


def device_and_dtype() -> tuple[str, torch.dtype]:
    if torch.backends.mps.is_available():
        return "mps", torch.float32
    if torch.cuda.is_available():
        return "cuda", torch.bfloat16
    return "cpu", torch.float32


def run_page(
    model: LightOnOcrForConditionalGeneration,
    processor: LightOnOcrProcessor,
    image_path: Path,
    device: str,
    dtype: torch.dtype,
) -> str:
    conversation = [
        {
            "role": "user",
            "content": [{"type": "image", "url": str(image_path)}],
        }
    ]
    inputs = processor.apply_chat_template(
        conversation,
        add_generation_prompt=True,
        tokenize=True,
        return_dict=True,
        return_tensors="pt",
    )
    inputs = {
        key: value.to(device=device, dtype=dtype) if value.is_floating_point() else value.to(device)
        for key, value in inputs.items()
    }
    with torch.inference_mode():
        output_ids = model.generate(**inputs, max_new_tokens=4096, do_sample=False)

    generated_ids = output_ids[0, inputs["input_ids"].shape[1] :]
    return processor.decode(generated_ids, skip_special_tokens=True).strip()


def main() -> int:
    configure_local_cache()
    image_paths = [Path(arg) for arg in sys.argv[1:]]
    if not image_paths:
        print("usage: lightonocr_wrapper.py <page-image> [<page-image> ...]", file=sys.stderr)
        return 2

    model_path = str(LOCAL_MODEL_DIR if LOCAL_MODEL_DIR.exists() else MODEL_ID)
    device, dtype = device_and_dtype()
    processor = LightOnOcrProcessor.from_pretrained(model_path)
    model = LightOnOcrForConditionalGeneration.from_pretrained(
        model_path,
        torch_dtype=dtype,
        cache_dir=str(CACHE_DIR),
    ).to(device)
    model.eval()

    for page_number, image_path in enumerate(image_paths, start=1):
        print(f"[PAGE {page_number}]")
        print(run_page(model, processor, image_path, device, dtype))
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

