from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Message:
    role: str
    content: str


@dataclass(frozen=True)
class GenerateResult:
    content: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    model: str = ""
    finish_reason: str = ""
    raw: Any = field(default=None, compare=False)


class NormalizedProvider:
    """Small LiteLLM bridge for all candidateSignal.ai LLM calls."""

    def __init__(
        self,
        *,
        model: str,
        api_key: str = "",
        base_url: str = "",
        timeout_seconds: int = 180,
        temperature: float = 0.0,
        max_tokens: int = 4096,
        max_retries: int = 3,
        retry_base_delay_ms: int = 1000,
    ) -> None:
        if not model:
            raise ValueError("LLM model is required")
        if base_url and "/" not in model:
            model = f"openai/{model}"
        self.model = model
        self.api_key = api_key
        self.base_url = base_url.rstrip("/") if base_url else ""
        self.timeout_seconds = timeout_seconds
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.max_retries = max(1, max_retries)
        self.retry_base_delay_ms = max(0, retry_base_delay_ms)

    def generate(
        self,
        *,
        system_prompt: str,
        messages: list[Message],
        response_format: dict[str, Any] | None = None,
        max_tokens: int | None = None,
    ) -> GenerateResult:
        try:
            from litellm import completion
        except ImportError as exc:
            raise RuntimeError("litellm is not installed. Run: pip install -r requirements.txt") from exc

        kwargs = self._build_kwargs(
            system_prompt=system_prompt,
            messages=messages,
            response_format=response_format,
            max_tokens=max_tokens,
        )
        last_error: Exception | None = None
        for attempt in range(1, self.max_retries + 1):
            try:
                response = completion(**kwargs)
                return self._parse_response(response)
            except Exception as exc:
                last_error = exc
                if attempt >= self.max_retries:
                    break
                delay = (self.retry_base_delay_ms / 1000.0) * attempt
                time.sleep(delay)
        assert last_error is not None
        raise last_error

    def _build_kwargs(
        self,
        *,
        system_prompt: str,
        messages: list[Message],
        response_format: dict[str, Any] | None,
        max_tokens: int | None,
    ) -> dict[str, Any]:
        litellm_messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
        litellm_messages.extend({"role": msg.role, "content": msg.content} for msg in messages)

        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": litellm_messages,
            "max_tokens": max_tokens or self.max_tokens,
            "timeout": self.timeout_seconds,
        }
        if self._supports_temperature_param():
            kwargs["temperature"] = self.temperature
        if response_format:
            kwargs["response_format"] = response_format
        if self.api_key:
            kwargs["api_key"] = self.api_key
        if self.base_url:
            kwargs["api_base"] = self.base_url

        model_name = self.model.split("/", 1)[-1].lower()
        if model_name.startswith("gpt-5"):
            kwargs["max_tokens"] = max(
                int(kwargs["max_tokens"]),
                int(os.getenv("RESUME_INTEL_GPT5_MAX_TOKENS", os.getenv("MINION_GPT5_MAX_TOKENS", "12000"))),
            )
            kwargs["reasoning_effort"] = os.getenv(
                "RESUME_INTEL_GPT5_REASONING_EFFORT",
                os.getenv("MINION_GPT5_REASONING_EFFORT", "minimal"),
            )
            kwargs["verbosity"] = os.getenv(
                "RESUME_INTEL_GPT5_VERBOSITY",
                os.getenv("MINION_GPT5_VERBOSITY", "low"),
            )
        return kwargs

    def _supports_temperature_param(self) -> bool:
        model_name = self.model.split("/", 1)[-1].lower()
        return not model_name.startswith("gpt-5")

    def _parse_response(self, response: Any) -> GenerateResult:
        choice = response.choices[0] if getattr(response, "choices", None) else None
        message = getattr(choice, "message", None) if choice else None
        content = getattr(message, "content", "") if message else ""
        usage = getattr(response, "usage", None)
        return GenerateResult(
            content=content or "",
            input_tokens=int(getattr(usage, "prompt_tokens", 0) or 0),
            output_tokens=int(getattr(usage, "completion_tokens", 0) or 0),
            model=str(getattr(response, "model", self.model) or self.model),
            finish_reason=str(getattr(choice, "finish_reason", "") or "") if choice else "",
            raw=response,
        )
