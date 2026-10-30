"""Reusable GenLayer equivalence patterns for SafetyNet.

Each pattern lives in its own submodule and exposes a small helper API plus a
meta dict. Patterns describe how to reduce a non-deterministic LLM/web task to
a comparable value; they never change the verdict enum.
"""

from __future__ import annotations

from .p1_enum_verdict import meta as p1_meta, canonical as p1_canonical
from .p7_deterministic_aggregation import meta as p7_meta, aggregate as p7_aggregate
from .p8_pinned_evidence import meta as p8_meta, pin as p8_pin, verify as p8_verify

PATTERNS = {
    "P1": p1_meta,
    "P7": p7_meta,
    "P8": p8_meta,
}


def get(pattern_id: str) -> dict:
    if pattern_id not in PATTERNS:
        raise KeyError(f"unknown pattern: {pattern_id}")
    return PATTERNS[pattern_id]


__all__ = ["PATTERNS", "get", "p1_meta", "p1_canonical", "p7_meta", "p7_aggregate", "p8_meta", "p8_pin", "p8_verify"]
