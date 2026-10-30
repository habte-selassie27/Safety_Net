from __future__ import annotations

import json
from pathlib import Path

import pytest

from safetynet_lint.report import generate_report, main, render_markdown

HEADER = '# { "Depends": "py-genlayer:testhash" }\nfrom genlayer import *\n'


def test_generate_report_counts_calls_and_discloses_estimates(tmp_path: Path) -> None:
    source = HEADER + '''
class SafetyNet(gl.Contract):
    items: TreeMap[str, str]

    @gl.public.write
    def adjudicate(self, incident_id: str) -> str:
        def evaluate():
            page = gl.nondet.web.render("https://example.com")
            answer = gl.nondet.exec_prompt(page)
            return canonical_verdict(answer)
        return gl.eq_principle.strict_eq(evaluate)
'''
    contract = tmp_path / "contract.py"
    contract.write_text(source, encoding="utf-8")

    report = generate_report(str(contract), validators=5, network="studionet")
    method = report["methods"][0]
    assert method["name"] == "adjudicate"
    assert method["kind"] == "write"
    assert method["nondetBlocks"] == 1
    assert method["principles"] == ["strict_eq"]
    assert method["llmCallsPerExecution"] == 1
    assert method["webCallsPerExecution"] == 1
    assert method["estimatedValidatorCalls"] == 5
    assert method["estimatedLlmCalls"] == 5
    assert report["storage"][0]["name"] == "items"
    assert report["latency"]["status"] == "unmeasured"
    assert report["risk"]["numericScore"] is None
    assert "static estimates" in report["estimateNote"]


def test_report_json_and_markdown(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    contract = tmp_path / "contract.py"
    contract.write_text(HEADER + "class SafetyNet(gl.Contract):\n    pass\n", encoding="utf-8")
    assert main([str(contract), "--format", "json"]) == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["schemaVersion"] == 1
    markdown = render_markdown(payload)
    assert "## Methods" in markdown
    assert "Latency: unmeasured." in markdown


def test_report_writes_under_project_root_only(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    contract = tmp_path / "contract.py"
    contract.write_text(HEADER + "class SafetyNet(gl.Contract):\n    pass\n", encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    assert main(["contract.py", "--format", "json", "--out", "reports/profile.json"]) == 0
    assert (tmp_path / "reports" / "profile.json").exists()
    with pytest.raises(ValueError, match="stay inside"):
        from safetynet_lint.report import _write_output

        _write_output("../outside.json", "{}")


def test_report_rejects_non_positive_validator_count(tmp_path: Path) -> None:
    contract = tmp_path / "contract.py"
    contract.write_text(HEADER + "class SafetyNet(gl.Contract):\n    pass\n", encoding="utf-8")
    with pytest.raises(ValueError, match="positive"):
        generate_report(str(contract), validators=0)
