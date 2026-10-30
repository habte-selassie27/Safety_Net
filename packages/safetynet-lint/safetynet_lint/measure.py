"""False-positive measurement for the SI rule catalog.

A rule is measured against two reference sets:

1. The shipped contract(s) in ``contracts/`` — none of the rules may fire.
2. The rule's own ``good.py`` corpus file — that rule may not fire.

This is deliberately narrower than "lint every good file with every rule":
the per-rule good fixtures are minimal contracts and can legitimately be
incomplete for unrelated rules (for example, a file about SI030 need not
declare a verdict enum). The measurement answers the question that matters:
does a rule fire on code that is known to be correct for that rule?
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .engine import lint_paths, resolve_rules


@dataclass
class FpRow:
    rule: str
    contracts: int
    corpus: int | None

    @property
    def ok(self) -> bool:
        if self.contracts:
            return False
        return self.corpus in (None, 0)


def measure_fp(
    contracts: str | Path, corpus: str | Path
) -> tuple[list[FpRow], int]:
    contracts_path = Path(contracts)
    corpus_path = Path(corpus)
    contract_result = lint_paths([str(contracts_path)])
    contract_counts: dict[str, int] = {}
    for finding in contract_result.findings:
        contract_counts[finding.rule] = contract_counts.get(finding.rule, 0) + 1

    rows: list[FpRow] = []
    for meta in resolve_rules():
        good = corpus_path / meta.id / "good.py"
        corpus_count: int | None = None
        if good.exists():
            result = lint_paths([str(good)])
            corpus_count = sum(
                1 for finding in result.findings if finding.rule == meta.id
            )
        rows.append(
            FpRow(
                rule=meta.id,
                contracts=contract_counts.get(meta.id, 0),
                corpus=corpus_count,
            )
        )
    failures = sum(1 for row in rows if not row.ok)
    return rows, failures


def render_fp_markdown(rows: list[FpRow]) -> str:
    lines = [
        "# SI false-positive measurement",
        "",
        "Reference sets:",
        "",
        "- `contracts/` — shipped Intelligent Contract(s)",
        "- `packages/safetynet-lint/tests/corpus/<rule>/good.py` — known-good fixture per rule",
        "",
        "| Rule | Findings in contracts/ | Findings in own good.py | Status |",
        "|---|---:|---:|---|",
    ]
    for row in rows:
        status = "ok" if row.ok else "FAIL"
        corpus = "n/a" if row.corpus is None else str(row.corpus)
        lines.append(f"| `{row.rule}` | {row.contracts} | {corpus} | {status} |")
    failures = sum(1 for row in rows if not row.ok)
    lines.extend(
        [
            "",
            f"**Result:** {len(rows) - failures}/{len(rows)} rules clean.",
            "",
        ]
    )
    return "\n".join(lines)
