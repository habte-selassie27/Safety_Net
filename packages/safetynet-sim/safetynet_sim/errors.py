"""Simulator error types.

Codes follow AGENTS.md §28.3. The simulator only ever raises loud,
actionable errors — never a silent no-op for an unsupported SDK feature.
"""

from __future__ import annotations

from typing import Any


class SimError(Exception):
    """Base class for simulator errors."""

    code = "E9000"

    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code

    def as_dict(self) -> dict[str, Any]:
        return {"code": self.code, "message": self.message}


class SimUnsupportedFeature(SimError):
    """E3001: contract used an SDK feature the simulator does not model.

    Never silently no-op. The caller is told to use `--mode direct` or
    `--mode network`, per AGENTS.md §17.6 rule 3.
    """

    code = "E3001"

    def __init__(self, feature: str) -> None:
        super().__init__(
            f"Unsupported SDK feature in sim: {feature}. "
            "Run `--mode direct` or `--mode network`.",
            code=self.code,
        )
        self.feature = feature


class UnmockedLLMCall(SimError):
    """A prompt was executed with no matching mock rule."""

    code = "E3002"

    def __init__(self, prompt: str, suggestion: str) -> None:
        preview = prompt[:500]
        super().__init__(
            "Unmocked LLM call. Prompt preview:\n"
            f"{preview}\n"
            f"Add a rule: {suggestion}",
            code=self.code,
        )
        self.prompt = prompt
        self.suggestion = suggestion


class UnmockedWebCall(SimError):
    """A web fetch was executed with no matching mock rule."""

    code = "E3002"

    def __init__(self, url: str, suggestion: str) -> None:
        super().__init__(
            "Unmocked web call.\n"
            f"url: {url}\n"
            f"Add a rule: {suggestion}",
            code=self.code,
        )
        self.url = url
        self.suggestion = suggestion


class ContractRevert(SimError):
    """The contract raised `gl.vm.UserError` (or another exception)."""

    code = "E5002"

    def __init__(self, reason: str) -> None:
        super().__init__(f"transaction reverted: {reason}", code=self.code)
        self.reason = reason
