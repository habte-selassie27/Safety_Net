"""Command-line entry point for the SafetyNet domain linter."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import __version__
from .engine import LintUsageError, lint_paths, resolve_rules
from .measure import measure_fp, render_fp_markdown
from .reporters import (
    REPORTERS,
    explain,
    list_rules_json,
    list_rules_text,
)
from .rules import METADATA


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="snet-lint",
        description="Run the SafetyNet SI domain rules against Intelligent Contracts.",
    )
    parser.add_argument("paths", nargs="*", help="Files or directories (default: contracts)")
    parser.add_argument(
        "--format",
        choices=sorted(REPORTERS),
        default="text",
        help="Reporter format (default: text)",
    )
    parser.add_argument(
        "--preset",
        default="recommended",
        choices=("recommended", "strict", "predeploy", "minimal"),
        help="Rule preset (default: recommended)",
    )
    parser.add_argument(
        "--rule",
        action="append",
        default=[],
        metavar="ID=LEVEL",
        help="Override a rule severity (error, warn, info, off). Repeatable.",
    )
    parser.add_argument(
        "--max-warnings",
        type=int,
        default=None,
        metavar="N",
        help="Fail when warnings exceed N",
    )
    parser.add_argument("--quiet", action="store_true", help="Only print errors")
    parser.add_argument("--json", action="store_true", help="Alias for --format json")
    parser.add_argument("--explain", metavar="ID", help="Explain one rule and exit")
    parser.add_argument(
        "--list-rules", action="store_true", help="List rules and exit"
    )
    parser.add_argument(
        "--write-docs",
        metavar="DIR",
        help="Write one markdown page per active rule and exit",
    )
    parser.add_argument(
        "--fp-report",
        action="store_true",
        help="Measure false positives against contracts/ and the good corpus",
    )
    parser.add_argument("--version", action="version", version=__version__)
    return parser


def write_rule_docs(rules, directory: str) -> int:
    target = Path(directory)
    target.mkdir(parents=True, exist_ok=True)
    for meta in rules:
        body = [
            "---",
            f"id: {meta.id}",
            f"title: {meta.id} — {meta.name}",
            f"category: {meta.category}",
            f"severity: {meta.severity}",
            "---",
            "",
            "<!-- AUTO-GENERATED from safetynet_lint.rules meta. Do not edit. -->",
            "",
            f"# {meta.id} — {meta.name}",
            "",
            meta.summary,
            "",
            "## Why",
            "",
            meta.rationale,
            "",
            "## Bad",
            "",
            "```python",
            meta.bad,
            "```",
            "",
            "## Good",
            "",
            "```python",
            meta.good,
            "```",
            "",
            "## Suppression",
            "",
            "```python",
            f"# safetynet-disable-next-line {meta.id} -- reason",
            "```",
            "",
        ]
        if meta.references:
            body.extend(["## References", ""])
            body.extend(f"- {reference}" for reference in meta.references)
            body.append("")
        (target / f"{meta.id}.md").write_text("\n".join(body), encoding="utf-8")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.explain:
        meta = METADATA.get(args.explain.upper())
        if meta is None:
            print(f"unknown rule: {args.explain}", file=sys.stderr)
            return 2
        print(explain(meta), end="")
        return 0

    try:
        rules = resolve_rules(args.preset, args.rule)
    except LintUsageError as error:
        print(f"snet-lint: {error}", file=sys.stderr)
        return 2

    if args.list_rules:
        if args.json or args.format == "json":
            print(list_rules_json(rules))
        else:
            print(list_rules_text(rules), end="")
        return 0

    if args.write_docs:
        return write_rule_docs(rules, args.write_docs)

    if args.fp_report:
        contracts = args.paths[0] if args.paths else "contracts"
        corpus = Path(__file__).resolve().parent.parent / "tests" / "corpus"
        rows, failures = measure_fp(contracts, corpus)
        print(render_fp_markdown(rows), end="")
        return 1 if failures else 0

    try:
        result = lint_paths(args.paths, preset=args.preset, overrides=args.rule)
    except LintUsageError as error:
        print(f"snet-lint: {error}", file=sys.stderr)
        return 2

    output_format = "json" if args.json else args.format
    renderer = REPORTERS[output_format]
    if output_format == "text":
        print(renderer(result, quiet=args.quiet), end="")
    else:
        print(renderer(result), end="")
        if output_format != "sarif":
            print()

    counts = result.counts
    over_warning_budget = (
        args.max_warnings is not None
        and counts.get("warn", 0) > args.max_warnings
    )
    if counts.get("error", 0) or over_warning_budget:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
