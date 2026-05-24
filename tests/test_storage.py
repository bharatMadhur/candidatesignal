from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from resume_intel.storage import SUPPORTED_STORAGE_BACKENDS, document_storage, validate_tenant_storage_key


class StorageTests(unittest.TestCase):
    def test_gcs_is_a_supported_document_storage_backend(self) -> None:
        self.assertIn("gcs", SUPPORTED_STORAGE_BACKENDS)

    def test_gcs_requires_bucket_name(self) -> None:
        with patch.dict(os.environ, {"RESUME_INTEL_STORAGE_BACKEND": "gcs"}, clear=True):
            with self.assertRaisesRegex(ValueError, "RESUME_INTEL_GCS_BUCKET"):
                document_storage()

    def test_storage_key_must_be_tenant_scoped(self) -> None:
        validate_tenant_storage_key("tenant-1/resumes/file.pdf", "tenant-1")
        with self.assertRaises(PermissionError):
            validate_tenant_storage_key("tenant-2/resumes/file.pdf", "tenant-1")


if __name__ == "__main__":
    unittest.main()
