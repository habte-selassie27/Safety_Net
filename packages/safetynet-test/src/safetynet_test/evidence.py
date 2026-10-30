"""Evidence manifest fixtures and canonical hashing."""

from __future__ import annotations

import hashlib
import json
from typing import Any


def canonical_json(value: Any) -> str:
    """Canonical JSON used by the CLI and contract."""
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def sha256_text(text: str) -> str:
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()


class Evidence:
    """Builder for canonical evidence manifests.

    Examples:
        ev = evidence.inline("Take 4000mg hourly.")
        sn.write.file_incident(..., ev.hash(), ev.manifest_json())
    """

    def __init__(self) -> None:
        self.items: list[dict[str, Any]] = []

    @property
    def next_id(self) -> str:
        return f"e{len(self.items) + 1}"

    def inline(
        self,
        text: str,
        *,
        max_chars: int = 2000,
        note: str | None = None,
    ) -> Evidence:
        item: dict[str, Any] = {
            "id": self.next_id,
            "kind": "inline",
            "text": text,
            "contentSha256": sha256_text(text),
            "maxChars": max(200, min(8000, max_chars)),
        }
        if note:
            item["note"] = note
        self.items.append(item)
        return self

    def url(
        self,
        url: str,
        *,
        text: str | None = None,
        content_sha256: str | None = None,
        retrieved_at: str = "2026-01-01T00:00:00Z",
        max_chars: int = 4000,
        note: str | None = None,
    ) -> Evidence:
        content = text if text is not None else url
        item: dict[str, Any] = {
            "id": self.next_id,
            "kind": "url",
            "url": url,
            "retrievedAt": retrieved_at,
            "contentSha256": content_sha256 or sha256_text(content),
            "maxChars": max(200, min(8000, max_chars)),
        }
        if note:
            item["note"] = note
        self.items.append(item)
        return self

    def manifest(self) -> dict[str, Any]:
        return {"schemaVersion": 1, "items": self.items}

    def manifest_json(self) -> str:
        return canonical_json(self.manifest())

    def hash(self) -> str:
        return sha256_text(self.manifest_json())
