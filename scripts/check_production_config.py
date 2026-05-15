from __future__ import annotations

import os
import sys

from dotenv import load_dotenv


REQUIRED = ["DATABASE_URL", "BETTER_AUTH_URL"]
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
    if storage_backend not in {"local", "database"}:
        errors.append("RESUME_INTEL_STORAGE_BACKEND must be local or database")

    if not _secret_value("RESUME_INTEL_LITELLM_API_KEY", "RESUME_INTEL_LITELLM_API_KEY_FILE", "OPENAI_API_KEY", "OPENAI_API_KEY_FILE"):
        warnings.append("RESUME_INTEL_LITELLM_API_KEY is not set; deep LLM parsing/synthesis will fail unless another provider key is configured")

    if not os.getenv("RESUME_INTEL_ALERT_WEBHOOK_URL"):
        warnings.append("RESUME_INTEL_ALERT_WEBHOOK_URL is not set; operational alerts will stay in-app only")

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
