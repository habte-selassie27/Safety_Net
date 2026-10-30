"""P1 — Enum Verdict.

Reduce a non-deterministic classification to a closed enum so strict equality
is safe. The LLM returns one member of a closed set; invalid output normalizes
to a fallback (never raises). Only the enum value crosses the equivalence
boundary; explanations stay outside.
"""

from __future__ import annotations

from typing import Any

VERDICTS = ("POLICY_VIOLATION", "POLICY_ADEQUATE_BUT_HARM",
            "INSUFFICIENT_EVIDENCE", "OUT_OF_SCOPE", "DISMISSED")
FALLBACK = "INSUFFICIENT_EVIDENCE"


def canonical(raw: Any, allowed: tuple[str, ...] = VERDICTS, fallback: str = FALLBACK) -> str:
    """Normalize raw model output to one allowed enum member."""
    value = ""
    if isinstance(raw, dict):
        value = str(raw.get("verdict", raw.get("finding", "")))
    else:
        value = str(raw)
    value = value.strip().upper()
    if value in allowed:
        return value
    return fallback


meta = {
    "id": "P1",
    "name": "Enum Verdict",
    "principle": "strict",
    "tags": ["classification", "enum", "strict-equality"],
    "summary": "Classify into a closed set; compare only the enum value.",
}
