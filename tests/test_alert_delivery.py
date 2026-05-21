from __future__ import annotations

import unittest
from tempfile import NamedTemporaryFile
from unittest.mock import Mock, patch

from resume_intel.alert_delivery import _redacted_destination, _webhook_payload, deliver_operational_alert


class AlertDeliveryTests(unittest.TestCase):
    def test_webhook_payload_is_structured(self) -> None:
        payload = _webhook_payload(
            {
                "id": "alert-1",
                "tenant_id": "tenant-1",
                "severity": "critical",
                "alert_type": "parse_dead_letter",
                "title": "Parse failed",
                "body": "OCR failed",
                "status": "open",
            }
        )

        self.assertEqual(payload["product"], "candidateSignal.ai")
        self.assertEqual(payload["alert_id"], "alert-1")
        self.assertEqual(payload["severity"], "critical")

    def test_redacts_webhook_destination_path_and_secret(self) -> None:
        self.assertEqual(
            _redacted_destination("https://hooks.example.com/services/secret/token"),
            "https://hooks.example.com/...",
        )

    def test_deliver_operational_alert_reads_webhook_from_secret_file(self) -> None:
        response = Mock()
        response.status_code = 200
        response.raise_for_status.return_value = None
        with NamedTemporaryFile("w") as webhook_file:
            webhook_file.write("https://hooks.example.com/services/redacted")
            webhook_file.flush()
            with (
                patch.dict("os.environ", {"RESUME_INTEL_ALERT_WEBHOOK_URL_FILE": webhook_file.name}, clear=True),
                patch("resume_intel.alert_delivery.httpx.post", return_value=response) as post,
                patch("resume_intel.alert_delivery._record_delivery"),
            ):
                deliver_operational_alert(
                    {
                        "id": "alert-1",
                        "tenant_id": "tenant-1",
                        "severity": "warning",
                        "alert_type": "ocr_quality_warning",
                        "title": "OCR warning",
                        "body": "Low text density",
                        "status": "open",
                    }
                )

        self.assertEqual(post.call_args.args[0], "https://hooks.example.com/services/redacted")


if __name__ == "__main__":
    unittest.main()
