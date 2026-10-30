from pathlib import Path

import pytest

from safetynet_lint.engine import lint_paths
from safetynet_lint.rules import METADATA

ROOT = Path(__file__).resolve().parent / "corpus"
CASES = sorted(path for path in ROOT.iterdir() if path.is_dir())


def _rules(result) -> set[str]:
    return {finding.rule for finding in result.findings}


def test_every_rule_has_a_corpus_case() -> None:
    covered = {case.name for case in CASES}
    expected = set(METADATA) - {"SI000", "SI099"}
    assert expected <= covered, f"missing corpus: {sorted(expected - covered)}"


@pytest.mark.parametrize("case", CASES, ids=[case.name for case in CASES])
def test_corpus_bad_and_good(case: Path) -> None:
    rule = case.name
    bad = lint_paths([str(case / "bad.py")])
    good = lint_paths([str(case / "good.py")])
    assert rule in _rules(bad), f"{rule} did not fire on bad.py"
    assert rule not in _rules(good), f"{rule} fired on good.py"
