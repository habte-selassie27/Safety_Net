import json
from pathlib import Path

from safetynet_lint.engine import lint_paths, resolve_rules
from safetynet_lint.reporters import render_json

ROOT = Path(__file__).resolve().parents[3]
GOLDEN = Path(__file__).resolve().parent / "golden"


def test_reference_contract_is_clean() -> None:
    result = lint_paths([str(ROOT / "contracts" / "safetynet.py")])
    expected = json.loads((GOLDEN / "safetynet.json").read_text(encoding="utf-8"))
    assert json.loads(render_json(result)) == expected


def test_rule_catalog_is_stable() -> None:
    expected = json.loads((GOLDEN / "rules.json").read_text(encoding="utf-8"))
    actual = [
        {"id": meta.id, "severity": meta.severity, "category": meta.category}
        for meta in resolve_rules()
    ]
    assert actual == expected
