from __future__ import annotations

import subprocess
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from PIL import Image

from src.resume_intel.extractors import extract_document
from src.resume_intel.pipeline import IMAGE_EXTENSIONS, SUPPORTED_EXTENSIONS
from src.resume_intel.settings import Settings


def _settings(*, ocr_mode: str = "external", ocr_command: str | None = "lighton-ocr") -> Settings:
    return Settings(
        llm_provider="test",
        llm_base_url="",
        llm_api_key="",
        llm_model="test",
        llm_timeout_seconds=1,
        llm_max_tokens=1,
        llm_temperature=0,
        llm_max_retries=0,
        llm_retry_base_delay_ms=0,
        embedding_model="test",
        embedding_dimensions=8,
        embedding_timeout_seconds=1,
        allow_hash_embedding_fallback=True,
        ocr_mode=ocr_mode,
        ocr_command=ocr_command,
        ocr_remote_url=None,
        ocr_remote_token="",
        ocr_remote_auth="bearer",
        ocr_remote_audience=None,
        ocr_remote_timeout_seconds=30,
        pdf_render_dpi=200,
    )


class ImageExtractionTests(unittest.TestCase):
    def test_image_extensions_are_supported_resume_inputs(self) -> None:
        self.assertTrue({".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".bmp"}.issubset(IMAGE_EXTENSIONS))
        self.assertTrue(IMAGE_EXTENSIONS.issubset(SUPPORTED_EXTENSIONS))

    def test_jpeg_resume_uses_external_ocr(self) -> None:
        with TemporaryDirectory() as tmp:
            image_path = Path(tmp) / "resume.jpg"
            Image.new("RGB", (40, 40), "white").save(image_path, "JPEG")

            with patch("src.resume_intel.extractors.subprocess.run") as run:
                run.return_value = subprocess.CompletedProcess(
                    args=["lighton-ocr", str(image_path)],
                    returncode=0,
                    stdout="Jane Candidate\nLinkedIn https://www.linkedin.com/in/jane-candidate\nData Engineer",
                    stderr="",
                )
                extracted = extract_document(image_path, _settings(), Path(tmp) / "work")

        self.assertEqual(extracted.method, "image_external_ocr")
        self.assertEqual(extracted.page_count, 1)
        self.assertIn("Jane Candidate", extracted.text)
        self.assertIn("[EXTRACTED DOCUMENT LINKS]", extracted.text)
        self.assertEqual(extracted.pages[0]["method"], "image_external_ocr")
        self.assertIn("image_ocr", extracted.pages[0]["quality_flags"])
        self.assertIn("normalized_image_for_ocr", extracted.pages[0]["quality_flags"])
        run.assert_called_once()
        self.assertEqual(run.call_args.args[0][0], "lighton-ocr")
        self.assertTrue(str(run.call_args.args[0][1]).endswith("page_001.png"))

    def test_tiff_resume_is_normalized_to_png_for_ocr(self) -> None:
        with TemporaryDirectory() as tmp:
            image_path = Path(tmp) / "resume.tiff"
            Image.new("RGB", (40, 40), "white").save(image_path, "TIFF")

            with patch("src.resume_intel.extractors.subprocess.run") as run:
                run.return_value = subprocess.CompletedProcess(
                    args=["lighton-ocr"],
                    returncode=0,
                    stdout="TIFF Candidate\nCloud Architect",
                    stderr="",
                )
                extracted = extract_document(image_path, _settings(), Path(tmp) / "work")

        self.assertEqual(extracted.method, "image_external_ocr")
        self.assertIn("TIFF Candidate", extracted.text)
        self.assertTrue(str(run.call_args.args[0][1]).endswith("page_001.png"))

    def test_image_resume_requires_ocr_configuration(self) -> None:
        with TemporaryDirectory() as tmp:
            image_path = Path(tmp) / "resume.png"
            Image.new("RGB", (40, 40), "white").save(image_path, "PNG")

            with self.assertRaisesRegex(ValueError, "Image resumes require OCR_MODE=external or OCR_MODE=remote"):
                extract_document(image_path, _settings(ocr_mode="none", ocr_command=None), Path(tmp) / "work")

    def test_image_resume_can_use_remote_ocr(self) -> None:
        with TemporaryDirectory() as tmp:
            image_path = Path(tmp) / "resume.png"
            Image.new("RGB", (40, 40), "white").save(image_path, "PNG")
            settings = _settings(ocr_mode="remote", ocr_command=None)
            settings = Settings(**{**settings.__dict__, "ocr_remote_url": "https://ocr.example.com", "ocr_remote_token": "secret"})

            with patch("src.resume_intel.extractors.httpx.post") as post:
                post.return_value.json.return_value = {"pages": [{"page_number": 1, "text": "Remote Candidate"}]}
                post.return_value.raise_for_status.return_value = None
                extracted = extract_document(image_path, settings, Path(tmp) / "work")

        self.assertEqual(extracted.method, "image_remote_ocr")
        self.assertIn("Remote Candidate", extracted.text)
        post.assert_called_once()
        self.assertEqual(post.call_args.kwargs["headers"]["Authorization"], "Bearer secret")


if __name__ == "__main__":
    unittest.main()
