from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any


EXTRA_LOG_FIELDS = (
    "request_id",
    "method",
    "path",
    "status_code",
    "latency_ms",
    "error_type",
)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
        }
        for field in EXTRA_LOG_FIELDS:
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=True)


def configure_logging() -> None:
    if (os.getenv("RESUME_INTEL_JSON_LOGS") or "1").lower() in {"0", "false", "no"}:
        return
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(os.getenv("RESUME_INTEL_LOG_LEVEL", "INFO").upper())
