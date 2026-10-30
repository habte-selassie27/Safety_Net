from pathlib import Path

import pytest

from safetynet_lint.cli import main

HEADER = '# { "Depends": "py-genlayer:testhash" }\nfrom genlayer import *\n'
CLEAN = (
    HEADER
    + '\nVERDICTS = ("INSUFFICIENT_EVIDENCE",)\n'
    + "\nclass SafetyNet(gl.Contract):\n"
    + "    pass\n"
)


def test_explain(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["--explain", "SI012"]) == 0
    output = capsys.readouterr().out
    assert "free-text-in-equivalence-payload" in output
    assert "Bad:" in output and "Good:" in output


def test_list_rules(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["--list-rules"]) == 0
    output = capsys.readouterr().out
    assert "SI001" in output
    assert "SI099" in output


def test_list_rules_json(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["--list-rules", "--json"]) == 0
    output = capsys.readouterr().out
    assert '"id": "SI001"' in output


def test_json_reporter_and_exit_code(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    path = tmp_path / "contract.py"
    path.write_text(CLEAN + "\n# TODO: later\n", encoding="utf-8")
    code = main([str(path), "--format", "json"])
    assert code == 0
    output = capsys.readouterr().out
    assert '"rule": "SI090"' in output
    assert '"ok": true' in output


def test_error_exit_code(tmp_path: Path) -> None:
    path = tmp_path / "contract.py"
    path.write_text("class Broken(:\n", encoding="utf-8")
    assert main([str(path)]) == 1


def test_max_warnings_fails_build(tmp_path: Path) -> None:
    path = tmp_path / "contract.py"
    path.write_text(
        HEADER
        + (
            '\nVERDICTS = ("INSUFFICIENT_EVIDENCE",)\n'
            "\nclass SafetyNet(gl.Contract):\n"
            "    @gl.public.view\n"
            "    def get(self, incident_id):\n"
            "        return incident_id\n"
        ),
        encoding="utf-8",
    )
    assert main([str(path), "--max-warnings", "0"]) == 1


def test_unknown_rule_override_is_usage_error(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    path = tmp_path / "contract.py"
    path.write_text(HEADER, encoding="utf-8")
    assert main([str(path), "--rule", "SI999=error"]) == 2
    assert "unknown rule" in capsys.readouterr().err


def test_write_docs(tmp_path: Path) -> None:
    out = tmp_path / "rules"
    assert main(["--write-docs", str(out)]) == 0
    assert (out / "SI012.md").exists()
    text = (out / "SI012.md").read_text(encoding="utf-8")
    assert "AUTO-GENERATED" in text
