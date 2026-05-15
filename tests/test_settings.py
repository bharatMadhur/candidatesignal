from __future__ import annotations

import os
import unittest
from tempfile import NamedTemporaryFile
from unittest.mock import patch

from resume_intel.settings import load_settings


class SettingsTests(unittest.TestCase):
    def test_litellm_api_key_can_be_loaded_from_secret_file(self) -> None:
        with NamedTemporaryFile("w") as secret_file:
            secret_file.write("sk-file-backed")
            secret_file.flush()
            with patch.dict(os.environ, {"RESUME_INTEL_LITELLM_API_KEY_FILE": secret_file.name}, clear=True), patch("resume_intel.settings.load_dotenv"):
                settings = load_settings()

        self.assertEqual(settings.llm_api_key, "sk-file-backed")


if __name__ == "__main__":
    unittest.main()
