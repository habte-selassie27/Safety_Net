"""P8 — Pinned Evidence Window (SafetyNet-specific).

Make validators judge the same bytes even when the web changes. The reporter
pins a content hash per evidence item at filing time; validators fetch and
re-hash. A mismatch marks the evidence tampered, downgrades confidence, and
makes DISMISSED impossible.
"""

from __future__ import annotations

import hashlib
from typing import Any


def _sha256(text: str) -> str:
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()


def pin(text: str) -> str:
    """Compute the pin hash for a piece of evidence text."""
    return _sha256(text)


def verify(pinned: str, observed: str) -> dict[str, Any]:
    """Compare a pinned hash against observed content."""
    observed_hash = _sha256(observed)
    tampered = pinned != observed_hash
    return {
        "pinned": pinned,
        "observed": observed_hash,
        "tampered": tampered,
        "can_dismiss": not tampered,
    }


meta = {
    "id": "P8",
    "name": "Pinned Evidence Window",
    "principle": "strict",
    "tags": ["pinning", "evidence", "ssrf", "safetynet-core"],
    "summary": "Pin evidence by hash so validators judge identical bytes.",
}
