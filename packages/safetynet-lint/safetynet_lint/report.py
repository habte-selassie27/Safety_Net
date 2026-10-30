"""Contract profile generation for the ``snet report`` command.

The estimates in this module are static counts, not network measurements.
"""

from __future__ import annotations

import argparse
import ast
import json
import os
import sys
from pathlib import Path
from typing import Any, Sequence

from .engine import LintUsageError, lint_paths
from .model import MethodModel, ModuleModel, build_model, calls_in, dotted_name


def _nondet_blocks(method: MethodModel) -> int:
    """Count equivalence wrappers, falling back to one nondet execution block."""
    principles = [
        call
        for call in calls_in(method.node)
        if "eq_principle" in dotted_name(call.func)
    ]
    if principles:
        return len(principles)
    return 1 if method.nondet else 0


def _principles(method: MethodModel) -> list[str]:
    """Return sorted equivalence helper names used by a method."""
    names = {
        dotted_name(call.func).rsplit(".", 1)[-1]
        for call in calls_in(method.node)
        if "eq_principle" in dotted_name(call.func)
    }
    return sorted(names)


def _kind(method: MethodModel) -> str:
    if method.is_view:
        return "view"
    if method.is_write:
        return "write"
    return "internal"


def _method_report(method: MethodModel, validators: int) -> dict[str, Any]:
    blocks = _nondet_blocks(method)
    llm_calls = sum(call.kind == "llm" for call in method.nondet)
    web_calls = sum(call.kind == "web" for call in method.nondet)
    return {
        "name": method.name,
        "kind": _kind(method),
        "nondetBlocks": blocks,
        "principles": _principles(method),
        "llmCallsPerExecution": llm_calls,
        "webCallsPerExecution": web_calls,
        "estimatedValidatorCalls": blocks * validators,
        "estimatedLlmCalls": llm_calls * validators,
        "estimatedWebCalls": web_calls * validators,
    }


def generate_report(
    contract_path: str, validators: int = 5, network: str | None = None
) -> dict[str, Any]:
    """Profile contract methods and storage using static analysis.

    Example: ``generate_report("contracts/safetynet.py", validators=5)``.
    """
    if validators < 1:
        raise ValueError("validators must be a positive integer")
    source_path = Path(contract_path)
    source = source_path.read_text(encoding="utf-8")
    model: ModuleModel = build_model(source_path, source)
    lint = lint_paths([str(source_path)])
    methods = [
        _method_report(method, validators)
        for contract in model.contracts
        for method in contract.methods
    ]
    findings = lint.counts
    errors = findings.get("error", 0)
    warnings = findings.get("warn", 0)
    risk_level = "high" if errors else "review" if warnings else "no-lint-findings"
    return {
        "schemaVersion": 1,
        "contract": str(source_path),
        "network": network,
        "validators": validators,
        "methods": methods,
        "storage": [
            {
                "class": field.class_name,
                "name": field.name,
                "type": field.annotation,
                "line": field.line,
            }
            for contract in model.contracts
            for field in contract.storage
        ],
        "lint": {
            "files": len(lint.files),
            "errors": errors,
            "warnings": warnings,
            "info": findings.get("info", 0),
            "findings": [finding.as_dict() for finding in lint.findings],
        },
        "risk": {
            "level": risk_level,
            "numericScore": None,
            "scoreStatus": "not-defined",
            "reason": "No approved numeric adjudication-risk scoring method is defined.",
        },
        "latency": {
            "status": "unmeasured",
            "reason": "Static analysis does not submit transactions or read benchmark samples.",
        },
        "estimateNote": (
            "Validator/LLM/web figures are static estimates: per-execution counts "
            "multiplied by the requested validator count. They are not observed network usage."
        ),
    }


def render_markdown(report: dict[str, Any]) -> str:
    """Render a static profile as Markdown.

    Example: ``render_markdown(generate_report("contracts/safetynet.py"))``.
    """
    lines = [
        f"# Contract report — `{report['contract']}`",
        "",
        f"Network: {report['network'] or 'not specified'} · Validators: {report['validators']}",
        "",
        "## Methods",
        "",
        "| Method | Kind | Nondet blocks | Principles | LLM / execution | Web / execution | Estimated validator calls |",
        "|---|---|---:|---|---:|---:|---:|",
    ]
    for method in report["methods"]:
        principles = ", ".join(method["principles"]) or "—"
        lines.append(
            f"| `{method['name']}` | {method['kind']} | {method['nondetBlocks']} | "
            f"{principles} | {method['llmCallsPerExecution']} | "
            f"{method['webCallsPerExecution']} | {method['estimatedValidatorCalls']} |"
        )
    lines.extend(["", "## Storage", "", "| Class | Field | Type | Line |", "|---|---|---|---:|"])
    for field in report["storage"]:
        lines.append(f"| `{field['class']}` | `{field['name']}` | `{field['type']}` | {field['line']} |")
    if not report["storage"]:
        lines.append("| — | — | — | — |")
    lint = report["lint"]
    risk = report["risk"]
    lines.extend(
        [
            "",
            "## Lint and risk",
            "",
            f"Lint: {lint['errors']} errors, {lint['warnings']} warnings, {lint['info']} info.",
            f"Risk level: {risk['level']}; numeric score: not defined ({risk['reason']})",
            "",
            "## Measurements",
            "",
            f"Latency: {report['latency']['status']}. {report['latency']['reason']}",
            "",
            report["estimateNote"],
            "",
        ]
    )
    return "\n".join(lines)


def _write_output(path: str, text: str) -> None:
    """Atomically write a report beneath the current project directory."""
    root = Path.cwd().resolve()
    target = Path(path)
    if not target.is_absolute():
        target = root / target
    target = target.resolve()
    if not target.is_relative_to(root):
        raise ValueError("--out must stay inside the current project directory")
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f".{target.name}.tmp")
    temporary.write_text(text, encoding="utf-8")
    os.replace(temporary, target)


def main(argv: Sequence[str] | None = None) -> int:
    """Run the report CLI; returns 0 on success and 1 on input errors.

    Example: ``main(["contracts/safetynet.py", "--format", "json"])``.
    """
    parser = argparse.ArgumentParser(prog="snet report", description="Profile a GenLayer contract.")
    parser.add_argument("contract", nargs="?", default="contracts/safetynet.py")
    parser.add_argument("--network")
    parser.add_argument("--validators", type=int, default=5)
    parser.add_argument("--format", choices=("md", "json"), default="md")
    parser.add_argument("--out")
    args = parser.parse_args(argv)
    try:
        report = generate_report(args.contract, args.validators, args.network)
        rendered = (
            json.dumps(report, indent=2, sort_keys=True) + "\n"
            if args.format == "json"
            else render_markdown(report)
        )
        if args.out:
            _write_output(args.out, rendered)
            print(f"wrote {args.out}")
        else:
            sys.stdout.write(rendered)
        return 0
    except (OSError, ValueError, SyntaxError, LintUsageError) as error:
        print(f"E2003 report failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
