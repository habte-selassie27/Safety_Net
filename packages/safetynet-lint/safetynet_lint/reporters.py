"""Reporters for the SI rule engine."""

from __future__ import annotations

import json
from collections import defaultdict

from .engine import LintResult
from .findings import Finding, RuleMeta


def _plural(count: int, noun: str) -> str:
    return f"{count} {noun}{'' if count == 1 else 's'}"


def _summary_line(result: LintResult) -> str:
    counts = result.counts
    parts = []
    if counts.get("error"):
        parts.append(_plural(counts["error"], "error"))
    if counts.get("warn"):
        parts.append(_plural(counts["warn"], "warning"))
    if counts.get("info"):
        parts.append(_plural(counts["info"], "info"))
    if not parts:
        return f"0 problems in {_plural(len(result.files), 'file')}"
    return f"{', '.join(parts)} in {_plural(len(result.files), 'file')}"


def render_text(result: LintResult, *, quiet: bool = False) -> str:
    lines: list[str] = []
    grouped: dict[str, list[Finding]] = defaultdict(list)
    for finding in result.findings:
        if quiet and finding.severity != "error":
            continue
        grouped[finding.file].append(finding)
    for file in sorted(grouped):
        lines.append(file)
        for finding in grouped[file]:
            lines.append(
                f"  {finding.line:>4}:{finding.col:<3} {finding.severity:<5} "
                f"{finding.rule}  {finding.message}"
            )
            if finding.help:
                lines.append(f"        Try: {finding.help}")
        lines.append("")
    counts = result.counts
    marker = "✖" if counts.get("error") else ("⚠" if counts.get("warn") else "✔")
    line = f"{marker} {_summary_line(result)}"
    if result.suppressed:
        line += f" ({result.suppressed} suppressed)"
    lines.append(line)
    return "\n".join(lines).rstrip() + "\n"


def render_json(result: LintResult) -> str:
    payload = {
        "ok": not result.has_errors,
        "count": len(result.findings),
        "findings": [finding.as_dict() for finding in result.findings],
        "summary": result.summary(),
        "ruleCounts": result.rule_counts,
    }
    return json.dumps(payload, indent=2, sort_keys=True)


def render_github(result: LintResult) -> str:
    def escape(value: str) -> str:
        return (
            value.replace("%", "%25")
            .replace("\r", "%0D")
            .replace("\n", "%0A")
            .replace(":", "%3A")
            .replace(",", "%2C")
        )

    lines: list[str] = []
    for finding in result.findings:
        command = {
            "error": "error",
            "warn": "warning",
            "info": "notice",
        }.get(finding.severity, "notice")
        lines.append(
            f"::{command} file={escape(finding.file)},line={finding.line},"
            f"col={finding.col},title={finding.rule}::{escape(finding.message)}"
        )
    return "\n".join(lines) + ("\n" if lines else "")


def render_markdown(result: LintResult) -> str:
    lines = [
        "## SafetyNet — SI domain lint",
        "",
        f"**{_summary_line(result)}**",
        "",
    ]
    if not result.findings:
        lines.append("No findings. The contract passes the SafetyNet domain rules.")
        return "\n".join(lines) + "\n"
    lines.extend(
        [
            "| File | Line | Severity | Rule | Message |",
            "|---|---:|---|---|---|",
        ]
    )
    for finding in result.findings:
        lines.append(
            f"| `{finding.file}` | {finding.line} | {finding.severity} | "
            f"`{finding.rule}` | {finding.message} |"
        )
    return "\n".join(lines) + "\n"


def _sarif_level(severity: str) -> str:
    if severity == "error":
        return "error"
    if severity == "warn":
        return "warning"
    return "note"


def render_sarif(result: LintResult) -> str:
    used_rules = {finding.rule for finding in result.findings}
    rules = [meta for meta in result.rules if meta.id in used_rules]
    payload = {
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "version": "2.1.0",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": "safetynet-lint",
                        "informationUri": "https://safetynet.dev/reference/lint-rules",
                        "rules": [
                            {
                                "id": meta.id,
                                "name": meta.name,
                                "shortDescription": {"text": meta.summary},
                                "fullDescription": {"text": meta.rationale},
                                "helpUri": f"https://safetynet.dev/reference/rules/{meta.id}",
                                "defaultConfiguration": {
                                    "level": _sarif_level(meta.severity)
                                },
                                "properties": {"category": meta.category},
                            }
                            for meta in rules
                        ],
                    }
                },
                "results": [
                    {
                        "ruleId": finding.rule,
                        "level": _sarif_level(finding.severity),
                        "message": {"text": finding.message},
                        "locations": [
                            {
                                "physicalLocation": {
                                    "artifactLocation": {"uri": finding.file},
                                    "region": {
                                        "startLine": finding.line,
                                        "startColumn": finding.col,
                                    },
                                }
                            }
                        ],
                    }
                    for finding in result.findings
                ],
            }
        ],
    }
    return json.dumps(payload, indent=2, sort_keys=True)


def explain(meta: RuleMeta) -> str:
    lines = [
        f"{meta.id}  {meta.name}  ({meta.category}, default {meta.severity})",
        "",
        meta.summary,
        "",
        meta.rationale,
        "",
        "Bad:",
        *[f"  {line}" for line in meta.bad.splitlines()],
        "",
        "Good:",
        *[f"  {line}" for line in meta.good.splitlines()],
    ]
    if meta.references:
        lines.extend(["", "References:"])
        lines.extend(f"  - {reference}" for reference in meta.references)
    if meta.options:
        lines.extend(["", "Options:"])
        lines.extend(
            f"  {key}: {value}" for key, value in sorted(meta.options.items())
        )
    lines.extend(
        [
            "",
            "Suppress with a reason:",
            f"  # safetynet-disable-next-line {meta.id} -- reason",
        ]
    )
    return "\n".join(lines) + "\n"


def list_rules_text(rules: list[RuleMeta]) -> str:
    lines = ["ID     Severity  Category      Name"]
    for meta in rules:
        lines.append(
            f"{meta.id:<6} {meta.severity:<9} {meta.category:<13} {meta.name}"
        )
    return "\n".join(lines) + "\n"


def list_rules_json(rules: list[RuleMeta]) -> str:
    return json.dumps([meta.as_dict() for meta in rules], indent=2, sort_keys=True)


REPORTERS = {
    "text": render_text,
    "json": render_json,
    "github": render_github,
    "markdown": render_markdown,
    "sarif": render_sarif,
}
