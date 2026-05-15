from __future__ import annotations

import json
import logging
import unittest

from resume_intel.logging_config import JsonFormatter


class LoggingConfigTests(unittest.TestCase):
    def test_json_formatter_includes_safe_request_fields(self) -> None:
        logger = logging.getLogger("test")
        record = logger.makeRecord(
            "resume_intel.http",
            logging.INFO,
            __file__,
            10,
            "request_completed",
            args=(),
            exc_info=None,
            extra={
                "request_id": "req-1",
                "method": "GET",
                "path": "/candidates",
                "status_code": 200,
                "latency_ms": 12,
            },
        )

        payload = json.loads(JsonFormatter().format(record))

        self.assertEqual(payload["request_id"], "req-1")
        self.assertEqual(payload["method"], "GET")
        self.assertEqual(payload["path"], "/candidates")
        self.assertEqual(payload["status_code"], 200)
        self.assertEqual(payload["latency_ms"], 12)
        self.assertNotIn("query", payload)


if __name__ == "__main__":
    unittest.main()
