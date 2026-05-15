from __future__ import annotations

import os
import tempfile
from functools import lru_cache
from pathlib import Path

import torch
from fastapi import FastAPI, Header, HTTPException, UploadFile
from transformers import LightOnOcrForConditionalGeneration, LightOnOcrProcessor


MODEL_ID = os.getenv("LIGHTONOCR_MODEL", "lightonai/LightOnOCR-2-1B-base")
CACHE_DIR = Path(os.getenv("HF_HOME", "/tmp/huggingface")).resolve()
MAX_NEW_TOKENS = int(os.getenv("OCR_MAX_NEW_TOKENS", "4096"))
INTERNAL_TOKEN = os.getenv("OCR_INTERNAL_TOKEN", "").strip()

app = FastAPI(title="candidateSignal CPU OCR")


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True, "model": MODEL_ID, "device": "cpu"}


@app.post("/ocr/pages")
async def ocr_pages(
    files: list[UploadFile],
    authorization: str | None = Header(default=None),
    x_ocr_token: str | None = Header(default=None),
) -> dict:
    _require_authorized(authorization, x_ocr_token)
    if not files:
        raise HTTPException(status_code=400, detail="at least one page image is required")

    model, processor = _load_model()
    pages = []
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        for index, file in enumerate(files, start=1):
            page_path = tmp_dir / f"page_{index:03d}.png"
            page_path.write_bytes(await file.read())
            text = _run_page(model, processor, page_path)
            quality_flags = ["ocr_used", "lightonocr_cpu"]
            if not text.strip():
                quality_flags.append("ocr_empty")
            pages.append(
                {
                    "page_number": index,
                    "text": text,
                    "quality_flags": quality_flags,
                }
            )
    return {"method": "lightonocr_cpu_cloud_run", "model": MODEL_ID, "pages": pages}


def _require_authorized(authorization: str | None, x_ocr_token: str | None) -> None:
    if not INTERNAL_TOKEN:
        return
    expected = f"Bearer {INTERNAL_TOKEN}"
    if authorization != expected and x_ocr_token != INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="invalid OCR token")


@lru_cache(maxsize=1)
def _load_model() -> tuple[LightOnOcrForConditionalGeneration, LightOnOcrProcessor]:
    os.environ["HF_HOME"] = str(CACHE_DIR)
    os.environ["HF_HUB_CACHE"] = str(CACHE_DIR / "hub")
    os.environ["TRANSFORMERS_CACHE"] = str(CACHE_DIR / "transformers")
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    local_model_value = os.getenv("LIGHTONOCR_LOCAL_MODEL_DIR", "").strip()
    local_model_dir = Path(local_model_value) if local_model_value else None
    model_path = str(local_model_dir if local_model_dir and local_model_dir.exists() else MODEL_ID)
    processor = LightOnOcrProcessor.from_pretrained(model_path, cache_dir=str(CACHE_DIR))
    model = LightOnOcrForConditionalGeneration.from_pretrained(
        model_path,
        torch_dtype=torch.float32,
        cache_dir=str(CACHE_DIR),
    ).to("cpu")
    model.eval()
    return model, processor


def _run_page(
    model: LightOnOcrForConditionalGeneration,
    processor: LightOnOcrProcessor,
    image_path: Path,
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
    inputs = {key: value.to("cpu") for key, value in inputs.items()}
    with torch.inference_mode():
        output_ids = model.generate(**inputs, max_new_tokens=MAX_NEW_TOKENS, do_sample=False)
    generated_ids = output_ids[0, inputs["input_ids"].shape[1] :]
    return processor.decode(generated_ids, skip_special_tokens=True).strip()
