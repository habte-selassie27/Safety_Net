"""Finding and rule metadata types shared by the engine and reporters."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Finding:
    rule: str
    severity: str
    message: str
    file: str
    line: int = 1
    col: int = 1
    end_line: int | None = None
    help: str = ""
    category: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "rule": self.rule,
            "severity": self.severity,
            "message": self.message,
            "file": self.file,
            "line": self.line,
            "col": self.col,
            "endLine": self.end_line,
            "help": self.help,
            "category": self.category,
        }


@dataclass(frozen=True)
class RuleMeta:
    id: str
    name: str
    category: str
    severity: str
    summary: str
    rationale: str
    bad: str
    good: str
    references: tuple[str, ...] = ()
    since: str = "0.1.0"
    options: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "severity": self.severity,
            "summary": self.summary,
            "rationale": self.rationale,
            "bad": self.bad,
            "good": self.good,
            "references": list(self.references),
            "since": self.since,
            "options": dict(self.options),
        }


SUPPRESSION_MISSING_REASON = "SI000"
UNUSED_SUPPRESSION = "SI099"
