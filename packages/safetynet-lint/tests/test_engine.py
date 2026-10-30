from pathlib import Path

import pytest

from safetynet_lint.engine import (
    LintUsageError,
    lint_paths,
    resolve_rules,
)
from safetynet_lint.model import build_model
from safetynet_lint.rules import METADATA

HEADER = '# { "Depends": "py-genlayer:testhash" }\nfrom genlayer import *\n'
CLEAN = (
    HEADER
    + '\nVERDICTS = ("INSUFFICIENT_EVIDENCE",)\n'
    + "\nclass SafetyNet(gl.Contract):\n"
    + "    pass\n"
)


def lint_source(tmp_path: Path, source: str, **kwargs):
    path = tmp_path / "contract.py"
    path.write_text(source, encoding="utf-8")
    return lint_paths([str(path)], **kwargs)


def test_resolve_rules_recommended_includes_catalog() -> None:
    rules = resolve_rules()
    ids = {meta.id for meta in rules}
    assert "SI012" in ids
    assert ids == set(METADATA)


def test_resolve_rules_minimal() -> None:
    ids = {meta.id for meta in resolve_rules("minimal")}
    assert ids == {"SI001", "SI002", "SI010", "SI020", "SI021"}


def test_resolve_rules_strict_promotes_warnings() -> None:
    rules = {meta.id: meta for meta in resolve_rules("strict")}
    assert METADATA["SI003"].severity == "warn"
    assert rules["SI003"].severity == "error"


def test_resolve_rules_override_off_and_severity() -> None:
    rules = {meta.id: meta for meta in resolve_rules("recommended", ["SI090=off", "SI003=info"])}
    assert "SI090" not in rules
    assert rules["SI003"].severity == "info"


def test_resolve_rules_rejects_unknown() -> None:
    with pytest.raises(LintUsageError):
        resolve_rules("nope")
    with pytest.raises(LintUsageError):
        resolve_rules("recommended", ["SI999=error"])
    with pytest.raises(LintUsageError):
        resolve_rules("recommended", ["SI012"])


def test_suppression_next_line_with_reason(tmp_path: Path) -> None:
    source = HEADER + "\n# safetynet-disable-next-line SI090 -- tracked in DOC-001\n# TODO: later\n"
    result = lint_source(tmp_path, source)
    assert "SI090" not in {finding.rule for finding in result.findings}
    assert result.suppressed == 1


def test_suppression_missing_reason_is_an_error(tmp_path: Path) -> None:
    source = HEADER + (
        "\nclass SafetyNet(gl.Contract):\n"
        "    # safetynet-disable-next-line SI010\n"
        "    incidents: dict[str, str]\n"
    )
    result = lint_source(tmp_path, source)
    assert "SI010" not in {finding.rule for finding in result.findings}
    s000 = [finding for finding in result.findings if finding.rule == "SI000"]
    assert s000 and s000[0].severity == "error"


def test_unused_suppression_is_reported(tmp_path: Path) -> None:
    source = HEADER + "\n# safetynet-disable-next-line SI090 -- stale\nVALUE = 1\n"
    result = lint_source(tmp_path, source)
    assert "SI099" in {finding.rule for finding in result.findings}


def test_block_disable_and_enable(tmp_path: Path) -> None:
    source = HEADER + (
        "\n# safetynet-disable SI090 -- temporary\n"
        "# TODO: hidden\n"
        "# safetynet-enable SI090\n"
        "# TODO: visible\n"
    )
    result = lint_source(tmp_path, source)
    todo = [finding for finding in result.findings if finding.rule == "SI090"]
    assert len(todo) == 1
    assert todo[0].line == 7


def test_parse_error_becomes_si000(tmp_path: Path) -> None:
    result = lint_source(tmp_path, "class Broken(:\n")
    assert result.findings[0].rule == "SI000"
    assert "could not parse" in result.findings[0].message


def test_reporter_json_and_sarif(tmp_path: Path) -> None:
    from safetynet_lint.reporters import render_json, render_sarif

    result = lint_source(tmp_path, HEADER + "\n# TODO: later\n")
    payload = render_json(result)
    assert '"rule": "SI090"' in payload
    sarif = render_sarif(result)
    assert '"version": "2.1.0"' in sarif
    assert '"ruleId": "SI090"' in sarif


def test_reporter_github_escapes_newlines(tmp_path: Path) -> None:
    from safetynet_lint.reporters import render_github

    result = lint_source(tmp_path, CLEAN + "\n# TODO: later\n")
    output = render_github(result)
    assert "::notice file=" in output
    assert "title=SI090" in output


def test_model_extracts_methods_storage_and_nondet(tmp_path: Path) -> None:
    source = HEADER + (
        "\nclass SafetyNet(gl.Contract):\n"
        "    verdicts: TreeMap[str, str]\n"
        "    @gl.public.write\n"
        "    def adjudicate(self, incident_id: str) -> str:\n"
        '        return gl.nondet.exec_prompt("x")\n'
    )
    path = tmp_path / "contract.py"
    path.write_text(source, encoding="utf-8")
    model = build_model(str(path))
    assert model.contract() is not None
    method = model.method("adjudicate")
    assert method is not None
    assert method.is_write
    assert method.nondet and method.nondet[0].kind == "llm"
    assert model.contract().storage[0].annotation == "TreeMap[str, str]"


def test_read_only_allowlist_access_does_not_trigger_si044(tmp_path: Path) -> None:
    source = HEADER + (
        "\nclass SafetyNet(gl.Contract):\n"
        "    @gl.public.view\n"
        "    def get_config(self) -> str:\n"
        '        return {"evidence_allowlist": self.config.evidence_allowlist}\n'
    )
    result = lint_source(tmp_path, source, overrides=["SI044=error"])
    assert "SI044" not in {finding.rule for finding in result.findings}
