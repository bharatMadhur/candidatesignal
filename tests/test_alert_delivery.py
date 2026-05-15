from __future__ import annotations

import unittest

from resume_intel.alert_delivery import _redacted_destination, _webhook_payload


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

        self.assertEqual(payload["product"], "candidatSignal.ai")
        self.assertEqual(payload["alert_id"], "alert-1")
        self.assertEqual(payload["severity"], "critical")

    def test_redacts_webhook_destination_path_and_secret(self) -> None:
        self.assertEqual(
            _redacted_destination("https://hooks.example.com/services/secret/token"),
            "https://hooks.example.com/...",
        )


if __name__ == "__main__":
    unittest.main()
