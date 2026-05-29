from __future__ import annotations

import os
import sys

from dotenv import load_dotenv


REQUIRED = ["BETTER_AUTH_URL"]
INSECURE_SECRET_VALUES = {
    "",
    "change-me-in-production",
    "replace-with-a-long-random-secret",
    "resume-intel-local-dev-secret-change-me",
}


def main() -> int:
    load_dotenv()
    errors: list[str] = []
    warnings: list[str] = []
    for name in REQUIRED:
        if not os.getenv(name):
            errors.append(f"{name} is required")
    if not _secret_value("DATABASE_URL", "DATABASE_URL_FILE"):
        errors.append("DATABASE_URL or DATABASE_URL_FILE is required")

    secret = _secret_value("BETTER_AUTH_SECRET", "BETTER_AUTH_SECRET_FILE", "RESUME_INTEL_BETTER_AUTH_SECRET_FILE")
    if secret in INSECURE_SECRET_VALUES or len(secret) < 32:
        errors.append("BETTER_AUTH_SECRET must be a non-default secret with at least 32 characters")

    better_auth_url = os.getenv("BETTER_AUTH_URL", "")
    if better_auth_url and not better_auth_url.startswith("https://"):
        errors.append("BETTER_AUTH_URL must use https in production")
    if any(host in better_auth_url for host in ("localhost", "127.0.0.1", "0.0.0.0")):
        errors.append("BETTER_AUTH_URL must not point at a local development host in production")

    if os.getenv("RESUME_INTEL_ENABLE_LEGACY_AUTH", "0").lower() in {"1", "true", "yes"}:
        errors.append("RESUME_INTEL_ENABLE_LEGACY_AUTH must be disabled in production")
    if os.getenv("RESUME_INTEL_ALLOW_UNSIGNED_BETTER_AUTH_BEARER", "0").lower() in {"1", "true", "yes"}:
        errors.append("RESUME_INTEL_ALLOW_UNSIGNED_BETTER_AUTH_BEARER must be disabled in production")
    if os.getenv("RESUME_INTEL_ALLOW_HASH_EMBEDDING_FALLBACK", "0").lower() in {"1", "true", "yes"}:
        errors.append("RESUME_INTEL_ALLOW_HASH_EMBEDDING_FALLBACK must be disabled in production")

    storage_backend = os.getenv("RESUME_INTEL_STORAGE_BACKEND", "local")
    if storage_backend not in {"local", "database", "gcs"}:
        errors.append("RESUME_INTEL_STORAGE_BACKEND must be local, database, or gcs")
    if storage_backend == "gcs" and not os.getenv("RESUME_INTEL_GCS_BUCKET"):
        errors.append("RESUME_INTEL_GCS_BUCKET is required when RESUME_INTEL_STORAGE_BACKEND=gcs")

    ocr_mode = os.getenv("OCR_MODE", "none").lower()
    if ocr_mode not in {"none", "disabled", "external", "remote"}:
        errors.append("OCR_MODE must be none, disabled, external, or remote")
    if ocr_mode == "remote" and not os.getenv("OCR_REMOTE_URL"):
        errors.append("OCR_REMOTE_URL is required when OCR_MODE=remote")
    ocr_remote_auth = os.getenv("OCR_REMOTE_AUTH", "bearer").lower()
    if ocr_mode == "remote" and ocr_remote_auth not in {"none", "bearer", "google_id_token"}:
        errors.append("OCR_REMOTE_AUTH must be none, bearer, or google_id_token")

    if not _secret_value("RESUME_INTEL_LITELLM_API_KEY", "RESUME_INTEL_LITELLM_API_KEY_FILE", "OPENAI_API_KEY", "OPENAI_API_KEY_FILE"):
        warnings.append("RESUME_INTEL_LITELLM_API_KEY is not set; deep LLM parsing/synthesis will fail unless another provider key is configured")

    if not _secret_value("RESUME_INTEL_ALERT_WEBHOOK_URL", "RESUME_INTEL_ALERT_WEBHOOK_URL_FILE"):
        warnings.append("RESUME_INTEL_ALERT_WEBHOOK_URL is not set; operational alerts will stay in-app only")
    if not os.getenv("RESUME_INTEL_BUILD_SHA"):
        warnings.append("RESUME_INTEL_BUILD_SHA is not set; health checks cannot prove the deployed Git revision")

    mail_enabled = os.getenv("RESUME_INTEL_MAIL_ENABLED", "0").lower() in {"1", "true", "yes"}
    if mail_enabled:
        if os.getenv("RESUME_INTEL_MAIL_PROVIDER", "resend").lower() != "resend":
            errors.append("RESUME_INTEL_MAIL_PROVIDER must be resend until another provider is implemented")
        if not _secret_value("RESEND_API_KEY", "RESEND_API_KEY_FILE", "RESUME_INTEL_RESEND_API_KEY", "RESUME_INTEL_RESEND_API_KEY_FILE"):
            errors.append("RESEND_API_KEY or RESEND_API_KEY_FILE is required when RESUME_INTEL_MAIL_ENABLED=1")
        if not os.getenv("RESUME_INTEL_MAIL_FROM_EMAIL"):
            errors.append("RESUME_INTEL_MAIL_FROM_EMAIL is required when RESUME_INTEL_MAIL_ENABLED=1")
        if os.getenv("RESUME_INTEL_MAIL_DRY_RUN", "1").lower() in {"1", "true", "yes"}:
            warnings.append("RESUME_INTEL_MAIL_DRY_RUN is enabled; product email will be persisted but not sent")

    for item in warnings:
        print(f"warning: {item}")
    for item in errors:
        print(f"error: {item}", file=sys.stderr)
    if errors:
        return 1
    print("production config checks passed")
    return 0


def _secret_value(*names: str) -> str:
    for name in names:
        value = os.getenv(name)
        if not value:
            continue
        if name.endswith("_FILE"):
            try:
                with open(value, "r", encoding="utf-8") as handle:
                    value = handle.read()
            except OSError:
                value = ""
        value = value.strip()
        if value:
            return value
    return ""


if __name__ == "__main__":
    raise SystemExit(main())
