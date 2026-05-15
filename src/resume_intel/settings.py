from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    llm_provider: str
    llm_base_url: str
    llm_api_key: str
    llm_model: str
    llm_timeout_seconds: int
    llm_max_tokens: int
    llm_temperature: float
    llm_max_retries: int
    llm_retry_base_delay_ms: int
    embedding_model: str
    embedding_dimensions: int
    embedding_timeout_seconds: int
    allow_hash_embedding_fallback: bool
    ocr_mode: str
    ocr_command: str | None
    ocr_remote_url: str | None
    ocr_remote_token: str
    ocr_remote_auth: str
    ocr_remote_audience: str | None
    ocr_remote_timeout_seconds: int
    pdf_render_dpi: int


def _env_first(*names: str, default: str | None = None) -> str | None:
    for name in names:
        value = os.getenv(name)
        if value is not None and value.strip():
            return value.strip()
    return default


def _secret_file_first(*names: str) -> str | None:
    for name in names:
        path = os.getenv(name)
        if not path:
            continue
        try:
            with open(path, "r", encoding="utf-8") as handle:
                value = handle.read().strip()
        except OSError:
            continue
        if value:
            return value
    return None


def _usable_secret(value: str | None) -> str:
    if value is None:
        return ""
    normalized = value.strip()
    if not normalized:
        return ""
    lowered = normalized.lower()
    placeholders = {
        "not-needed",
        "changeme",
        "change-me",
        "replace-me",
        "your-api-key",
        "your_api_key",
    }
    if lowered in placeholders or lowered.startswith("<"):
        return ""
    return normalized


def _resolve_base_url(value: str | None) -> str:
    if value is None:
        return "https://api.openai.com/v1"
    normalized = value.strip().rstrip("/")
    if normalized.lower() in {"", "none", "null", "direct", "openai"}:
        return "https://api.openai.com/v1"
    return normalized


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def load_settings() -> Settings:
    load_dotenv()
    model = _env_first(
        "RESUME_INTEL_LITELLM_MODEL",
        "MINION_LITELLM_MODEL",
        "LITELLM_MODEL",
        "LLM_MODEL",
        default="openai/gpt-5-nano",
    )
    base_url = _resolve_base_url(
        _env_first(
            "RESUME_INTEL_LITELLM_BASE_URL",
            "MINION_LITELLM_BASE_URL",
            "LITELLM_BASE_URL",
            "LITELLM_API_BASE",
            "LLM_BASE_URL",
        )
    )
    api_key = _usable_secret(
        _env_first(
            "RESUME_INTEL_LITELLM_API_KEY",
            "MINION_LITELLM_API_KEY",
            "LITELLM_API_KEY",
            "OPENAI_API_KEY",
            "LLM_API_KEY",
        )
        or _secret_file_first(
            "RESUME_INTEL_LITELLM_API_KEY_FILE",
            "MINION_LITELLM_API_KEY_FILE",
            "LITELLM_API_KEY_FILE",
            "OPENAI_API_KEY_FILE",
            "LLM_API_KEY_FILE",
        )
    )
    return Settings(
        llm_provider=os.getenv("LLM_PROVIDER", "litellm").lower(),
        llm_base_url=base_url,
        llm_api_key=api_key,
        llm_model=model or "openai/gpt-5-nano",
        llm_timeout_seconds=int(os.getenv("LLM_TIMEOUT_SECONDS", "180")),
        llm_max_tokens=int(os.getenv("LLM_MAX_TOKENS", "4096")),
        llm_temperature=float(os.getenv("LLM_TEMPERATURE", "0")),
        llm_max_retries=int(os.getenv("LLM_MAX_RETRIES", "3")),
        llm_retry_base_delay_ms=int(os.getenv("LLM_RETRY_BASE_DELAY_MS", "1000")),
        embedding_model=_env_first(
            "RESUME_INTEL_EMBEDDING_MODEL",
            "MINION_EMBEDDING_MODEL",
            "EMBEDDING_MODEL",
            default="openai/text-embedding-3-small",
        )
        or "openai/text-embedding-3-small",
        embedding_dimensions=int(os.getenv("RESUME_INTEL_EMBEDDING_DIMENSIONS", "1536")),
        embedding_timeout_seconds=int(os.getenv("RESUME_INTEL_EMBEDDING_TIMEOUT_SECONDS", "90")),
        allow_hash_embedding_fallback=_env_bool("RESUME_INTEL_ALLOW_HASH_EMBEDDING_FALLBACK", False),
        ocr_mode=os.getenv("OCR_MODE", "none").lower(),
        ocr_command=os.getenv("OCR_COMMAND") or None,
        ocr_remote_url=_env_first("OCR_REMOTE_URL", "RESUME_INTEL_OCR_REMOTE_URL"),
        ocr_remote_token=_usable_secret(
            _env_first("OCR_REMOTE_TOKEN", "RESUME_INTEL_OCR_REMOTE_TOKEN")
            or _secret_file_first("OCR_REMOTE_TOKEN_FILE", "RESUME_INTEL_OCR_REMOTE_TOKEN_FILE")
        ),
        ocr_remote_auth=os.getenv("OCR_REMOTE_AUTH", "bearer").strip().lower(),
        ocr_remote_audience=_env_first("OCR_REMOTE_AUDIENCE", "RESUME_INTEL_OCR_REMOTE_AUDIENCE"),
        ocr_remote_timeout_seconds=int(os.getenv("OCR_REMOTE_TIMEOUT_SECONDS", "1800")),
        pdf_render_dpi=int(os.getenv("PDF_RENDER_DPI", "200")),
    )
