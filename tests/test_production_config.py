from __future__ import annotations

import os
import sys
import unittest
from io import StringIO
from pathlib import Path
from tempfile import NamedTemporaryFile
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.check_production_config import main


BASE_ENV = {
    "DATABASE_URL": "postgresql://user:pass@db:5432/resume_intel",
    "BETTER_AUTH_SECRET": "a-real-production-secret-with-more-than-32-chars",
    "BETTER_AUTH_URL": "https://app.example.com",
    "RESUME_INTEL_ENABLE_LEGACY_AUTH": "0",
    "RESUME_INTEL_ALLOW_UNSIGNED_BETTER_AUTH_BEARER": "0",
    "RESUME_INTEL_STORAGE_BACKEND": "local",
}


class ProductionConfigTests(unittest.TestCase):
    def run_checker(self, env: dict[str, str]) -> int:
        with patch.dict(os.environ, env, clear=True), patch("scripts.check_production_config.load_dotenv"), patch("sys.stdout", new_callable=StringIO), patch("sys.stderr", new_callable=StringIO):
            return main()

    def test_rejects_embedding_hash_fallback_in_production_config(self) -> None:
        env = BASE_ENV | {"RESUME_INTEL_ALLOW_HASH_EMBEDDING_FALLBACK": "1"}
        self.assertEqual(self.run_checker(env), 1)

    def test_rejects_weak_better_auth_secret(self) -> None:
        env = BASE_ENV | {"BETTER_AUTH_SECRET": "change-me-in-production"}
        self.assertEqual(self.run_checker(env), 1)

    def test_rejects_legacy_auth_in_production_config(self) -> None:
        env = BASE_ENV | {"RESUME_INTEL_ENABLE_LEGACY_AUTH": "1"}
        self.assertEqual(self.run_checker(env), 1)

    def test_rejects_unsigned_better_auth_bearer_in_production_config(self) -> None:
        env = BASE_ENV | {"RESUME_INTEL_ALLOW_UNSIGNED_BETTER_AUTH_BEARER": "1"}
        self.assertEqual(self.run_checker(env), 1)

    def test_rejects_local_better_auth_url_in_production_config(self) -> None:
        env = BASE_ENV | {"BETTER_AUTH_URL": "http://localhost:3001"}
        self.assertEqual(self.run_checker(env), 1)

    def test_accepts_secret_file_without_plaintext_secret_env(self) -> None:
        with NamedTemporaryFile("w") as secret_file, NamedTemporaryFile("w") as database_file:
            secret_file.write("file-backed-production-secret-with-more-than-32-chars")
            secret_file.flush()
            database_file.write("postgresql://user:pass@db:5432/resume_intel")
            database_file.flush()
            env = {
                key: value
                for key, value in (
                    BASE_ENV
                    | {
                        "DATABASE_URL_FILE": database_file.name,
                        "BETTER_AUTH_SECRET_FILE": secret_file.name,
                        "RESUME_INTEL_LITELLM_API_KEY": "sk-test",
                    }
                ).items()
                if key not in {"DATABASE_URL", "BETTER_AUTH_SECRET"}
            }
            self.assertEqual(self.run_checker(env), 0)

    def test_accepts_alert_webhook_secret_file(self) -> None:
        with NamedTemporaryFile("w") as webhook_file:
            webhook_file.write("https://hooks.example.com/services/redacted")
            webhook_file.flush()
            env = BASE_ENV | {
                "RESUME_INTEL_ALERT_WEBHOOK_URL_FILE": webhook_file.name,
                "RESUME_INTEL_LITELLM_API_KEY": "sk-test",
            }
            self.assertEqual(self.run_checker(env), 0)

    def test_accepts_valid_security_config_without_optional_alert_webhook(self) -> None:
        env = BASE_ENV | {"RESUME_INTEL_ALLOW_HASH_EMBEDDING_FALLBACK": "0", "RESUME_INTEL_LITELLM_API_KEY": "sk-test"}
        self.assertEqual(self.run_checker(env), 0)

    def test_accepts_gcs_storage_with_bucket(self) -> None:
        env = BASE_ENV | {
            "RESUME_INTEL_STORAGE_BACKEND": "gcs",
            "RESUME_INTEL_GCS_BUCKET": "candidatesignal-prod-documents",
            "RESUME_INTEL_LITELLM_API_KEY": "sk-test",
        }
        self.assertEqual(self.run_checker(env), 0)

    def test_rejects_remote_ocr_without_url(self) -> None:
        env = BASE_ENV | {"OCR_MODE": "remote", "RESUME_INTEL_LITELLM_API_KEY": "sk-test"}
        self.assertEqual(self.run_checker(env), 1)


if __name__ == "__main__":
    unittest.main()
