from __future__ import annotations

import os
import unittest
from tempfile import NamedTemporaryFile
from unittest.mock import patch

from resume_intel.db import database_url
from resume_intel.settings import load_settings


class SettingsTests(unittest.TestCase):
    def test_litellm_api_key_can_be_loaded_from_secret_file(self) -> None:
        with NamedTemporaryFile("w") as secret_file:
            secret_file.write("sk-file-backed")
            secret_file.flush()
            with patch.dict(os.environ, {"RESUME_INTEL_LITELLM_API_KEY_FILE": secret_file.name}, clear=True), patch("resume_intel.settings.load_dotenv"):
                settings = load_settings()

        self.assertEqual(settings.llm_api_key, "sk-file-backed")

    def test_remote_ocr_token_can_be_loaded_from_secret_file(self) -> None:
        with NamedTemporaryFile("w") as secret_file:
            secret_file.write("ocr-token")
            secret_file.flush()
            with patch.dict(os.environ, {"OCR_MODE": "remote", "OCR_REMOTE_URL": "https://ocr.example.com", "OCR_REMOTE_TOKEN_FILE": secret_file.name}, clear=True), patch("resume_intel.settings.load_dotenv"):
                settings = load_settings()

        self.assertEqual(settings.ocr_mode, "remote")
        self.assertEqual(settings.ocr_remote_url, "https://ocr.example.com")
        self.assertEqual(settings.ocr_remote_token, "ocr-token")

    def test_database_url_can_be_loaded_from_secret_file(self) -> None:
        with NamedTemporaryFile("w") as secret_file:
            secret_file.write("postgresql://user:pass@db:5432/resume_intel")
            secret_file.flush()
            with patch.dict(os.environ, {"DATABASE_URL_FILE": secret_file.name}, clear=True), patch("resume_intel.db.load_dotenv"):
                value = database_url()

        self.assertEqual(value, "postgresql://user:pass@db:5432/resume_intel")


if __name__ == "__main__":
    unittest.main()
