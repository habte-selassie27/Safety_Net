"""Consensus trace rendering helpers."""

from __future__ import annotations

from typing import Any, cast


def format_trace(tx: Any) -> str:
    result = tx.tx if hasattr(tx, "tx") else tx
    if result is None or result.trace is None:
        return "  no consensus trace recorded"
    return cast(str, result.trace.pretty())


def print_trace(tx: Any) -> None:
    print(format_trace(tx))
