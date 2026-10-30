"""ANL-001/002 stability measurement tests."""

from pathlib import Path

from safetynet_sim.tighten import run_tighten

SCENARIO = (
    Path(__file__).resolve().parents[3]
    / "test"
    / "fixtures"
    / "scenarios"
    / "medical-advice-violation.yaml"
)


def test_tighten_reports_stability_metrics() -> None:
    report = run_tighten(
        samples=3,
        seed=1,
        noise="low",
        scenario_path=SCENARIO,
    )
    assert report["ok"] is True
    assert report["samples"] == 3
    assert 0 <= report["stability"] <= 100
    assert report["baseline"]["verdict"] == "POLICY_VIOLATION"
    assert report["weakest_area"] in {
        "none",
        "verdict",
        "severity",
        "confidence",
        "clauses",
    }


def test_tighten_is_reproducible() -> None:
    first = run_tighten(
        samples=3,
        seed=3,
        noise="medium",
        scenario_path=SCENARIO,
    )
    second = run_tighten(
        samples=3,
        seed=3,
        noise="medium",
        scenario_path=SCENARIO,
    )
    assert first["stability"] == second["stability"]
    assert first["false_disagree"] == second["false_disagree"]
    assert first["false_agree"] == second["false_agree"]
    assert first["field_divergence"] == second["field_divergence"]
