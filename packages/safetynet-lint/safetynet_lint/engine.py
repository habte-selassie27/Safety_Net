"""Rule selection, suppression handling, and the lint runner."""

from __future__ import annotations

import dataclasses
import re
from dataclasses import dataclass, field
from pathlib import Path

from .findings import Finding, RuleMeta
from .model import ModuleModel, build_model
from .rules import METADATA, check_rule

PRESETS = ("recommended", "strict", "predeploy", "minimal")

_MINIMAL = {"SI001", "SI002", "SI010", "SI020", "SI021"}
_PRedeploy_CATEGORIES = {
    "evidence",
    "permanence",
    "fairness",
    "policy",
    "injection",
    "determinism",
}
_PRedeploy_ALWAYS = {
    "SI023",
    "SI024",
    "SI042",
    "SI043",
    "SI044",
    "SI045",
}
_SKIP_DIRS = {
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
}


class LintUsageError(Exception):
    pass


@dataclass
class Suppression:
    ids: set[str]
    start: int
    end: int
    reason: str
    comment_line: int
    used: set[str] = field(default_factory=set)


@dataclass
class LintResult:
    findings: list[Finding]
    files: list[str]
    suppressed: int = 0
    rules: list[RuleMeta] = field(default_factory=list)
    suppressions: list[Suppression] = field(default_factory=list)

    @property
    def counts(self) -> dict[str, int]:
        counts = {"error": 0, "warn": 0, "info": 0}
        for finding in self.findings:
            counts[finding.severity] = counts.get(finding.severity, 0) + 1
        return counts

    @property
    def rule_counts(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for finding in self.findings:
            counts[finding.rule] = counts.get(finding.rule, 0) + 1
        return dict(sorted(counts.items()))

    @property
    def has_errors(self) -> bool:
        return any(finding.severity == "error" for finding in self.findings)

    def summary(self) -> dict[str, object]:
        counts = self.counts
        return {
            "files": len(self.files),
            "errors": counts.get("error", 0),
            "warnings": counts.get("warn", 0),
            "info": counts.get("info", 0),
            "suppressed": self.suppressed,
            "rules": len(self.rules),
        }


def _override_meta(meta: RuleMeta, severity: str) -> RuleMeta:
    return dataclasses.replace(meta, severity=severity)


def resolve_rules(
    preset: str = "recommended", overrides: list[str] | None = None
) -> list[RuleMeta]:
    """Return active rules with effective severities for a preset/overrides."""
    if preset not in PRESETS:
        raise LintUsageError(
            f"unknown preset `{preset}`; choose one of {', '.join(PRESETS)}"
        )
    selected: dict[str, RuleMeta] = {}
    for rule_id, meta in METADATA.items():
        if preset == "minimal" and rule_id not in _MINIMAL:
            continue
        if preset == "predeploy":
            if (
                meta.category not in _PRedeploy_CATEGORIES
                and rule_id not in _PRedeploy_ALWAYS
            ):
                continue
        effective = meta
        if preset == "strict" and meta.severity == "warn":
            effective = _override_meta(meta, "error")
        selected[rule_id] = effective

    for override in overrides or []:
        if "=" not in override:
            raise LintUsageError(
                f"invalid --rule `{override}`; expected RULE=LEVEL"
            )
        rule_id, level = (part.strip() for part in override.split("=", 1))
        level = level.lower()
        if rule_id not in METADATA:
            raise LintUsageError(f"unknown rule `{rule_id}`")
        if level in {"off", "none"}:
            selected.pop(rule_id, None)
            continue
        if level not in {"error", "warn", "info"}:
            raise LintUsageError(
                f"invalid severity `{level}` for {rule_id}; use error, warn, info, or off"
            )
        selected[rule_id] = _override_meta(METADATA[rule_id], level)

    return sorted(selected.values(), key=lambda meta: meta.id)


_ACTIONS = re.compile(
    r"safetynet-(disable-next-line|disable|enable)\s+([A-Z0-9,\s]+?)(?:\s+--\s*(.*))?$"
)


def parse_suppressions(model: ModuleModel, rules: list[RuleMeta]) -> list[Suppression]:
    intervals: list[Suppression] = []
    active: dict[str, tuple[int, str, int]] = {}
    for line_no, line in enumerate(model.lines, 1):
        if "safetynet-" not in line:
            continue
        match = _ACTIONS.search(line)
        if not match:
            continue
        action, raw_ids, reason = match.groups()
        ids = {part.strip() for part in raw_ids.split(",") if part.strip()}
        active_ids = {meta.id for meta in rules}
        ids = {rule_id for rule_id in ids if rule_id in METADATA and rule_id in active_ids}
        if not ids:
            continue
        reason = (reason or "").strip()
        if action == "disable-next-line":
            intervals.append(
                Suppression(
                    ids=ids,
                    start=line_no + 1,
                    end=line_no + 1,
                    reason=reason,
                    comment_line=line_no,
                )
            )
        elif action == "disable":
            for rule_id in ids:
                active[rule_id] = (line_no + 1, reason, line_no)
        else:  # enable
            for rule_id in ids:
                if rule_id not in active:
                    continue
                start, why, comment = active.pop(rule_id)
                intervals.append(
                    Suppression(
                        ids={rule_id},
                        start=start,
                        end=line_no - 1,
                        reason=why,
                        comment_line=comment,
                    )
                )
    last_line = max(1, len(model.lines))
    for rule_id, (start, reason, comment) in active.items():
        intervals.append(
            Suppression(
                ids={rule_id},
                start=start,
                end=last_line,
                reason=reason,
                comment_line=comment,
            )
        )
    return intervals


def apply_suppressions(
    model: ModuleModel,
    findings: list[Finding],
    rules: list[RuleMeta],
) -> tuple[list[Finding], int, list[Suppression]]:
    intervals = parse_suppressions(model, rules)
    severity = {meta.id: meta.severity for meta in rules}
    kept: list[Finding] = []
    suppressed = 0
    for finding in findings:
        match = next(
            (
                interval
                for interval in intervals
                if finding.rule in interval.ids
                and interval.start <= finding.line <= interval.end
            ),
            None,
        )
        if match is None:
            kept.append(finding)
            continue
        suppressed += 1
        match.used.add(finding.rule)
        if not match.reason and severity.get(finding.rule) == "error":
            kept.append(
                Finding(
                    rule="SI000",
                    severity="error",
                    message="suppression for an error rule requires a reason after `--`",
                    file=model.path,
                    line=match.comment_line,
                    help="Write: # safetynet-disable-next-line SI012 -- reason",
                    category="style",
                )
            )
    for interval in intervals:
        for rule_id in sorted(interval.ids):
            if rule_id in interval.used:
                continue
            kept.append(
                Finding(
                    rule="SI099",
                    severity="info",
                    message=f"unused suppression for {rule_id}",
                    file=model.path,
                    line=interval.comment_line,
                    help="Remove the stale suppression.",
                    category="style",
                )
            )
    return kept, suppressed, intervals


def iter_python_files(paths: list[str]) -> list[str]:
    files: list[str] = []
    for raw in paths or ["contracts"]:
        path = Path(raw)
        if not path.exists():
            raise LintUsageError(f"path does not exist: {raw}")
        if path.is_file():
            if path.suffix == ".py":
                files.append(str(path))
            continue
        for candidate in sorted(path.rglob("*.py")):
            if any(part in _SKIP_DIRS for part in candidate.parts):
                continue
            files.append(str(candidate))
    return sorted(dict.fromkeys(files))


def lint_model(model: ModuleModel, rules: list[RuleMeta]) -> LintResult:
    findings: list[Finding] = []
    for meta in rules:
        findings.extend(check_rule(meta, model))
    findings, suppressed, intervals = apply_suppressions(model, findings, rules)
    findings.sort(key=lambda finding: (finding.file, finding.line, finding.col, finding.rule))
    return LintResult(
        findings=findings,
        files=[model.path],
        suppressed=suppressed,
        rules=rules,
        suppressions=intervals,
    )


def lint_paths(
    paths: list[str], preset: str = "recommended", overrides: list[str] | None = None
) -> LintResult:
    rules = resolve_rules(preset, overrides)
    files = iter_python_files(paths)
    all_findings: list[Finding] = []
    suppressed = 0
    intervals: list[Suppression] = []
    for file in files:
        try:
            model = build_model(file)
        except SyntaxError as error:
            all_findings.append(
                Finding(
                    rule="SI000",
                    severity="error",
                    message=f"could not parse source: {error.msg}",
                    file=file,
                    line=error.lineno or 1,
                    col=error.offset or 1,
                    help="Fix the syntax error; no SI rule can run on unparseable source.",
                    category="style",
                )
            )
            continue
        result = lint_model(model, rules)
        all_findings.extend(result.findings)
        suppressed += result.suppressed
        intervals.extend(result.suppressions)
    all_findings.sort(
        key=lambda finding: (finding.file, finding.line, finding.col, finding.rule)
    )
    return LintResult(
        findings=all_findings,
        files=files,
        suppressed=suppressed,
        rules=rules,
        suppressions=intervals,
    )
