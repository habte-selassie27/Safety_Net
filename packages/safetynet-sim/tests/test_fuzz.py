"""ANL-010 adjudication property tests."""

from pathlib import Path

from safetynet_sim.fuzz import PROPERTIES, run_fuzz


def test_all_seven_properties_hold(tmp_path: Path) -> None:
    report = run_fuzz(cases=1, seed=7, corpus_dir=tmp_path)
    assert report["ok"], report["failures"]
    assert {entry["name"] for entry in report["properties"]} == set(PROPERTIES)
    assert all(entry["failures"] == [] for entry in report["properties"])
    assert report["failures"] == []


def test_single_property_filter(tmp_path: Path) -> None:
    report = run_fuzz(
        cases=1,
        seed=7,
        property_name="no-free-text-comparison",
        corpus_dir=tmp_path,
    )
    assert report["ok"], report["failures"]
    assert len(report["properties"]) == 1
    assert report["properties"][0]["name"] == "no-free-text-comparison"


def test_fuzz_is_deterministic(tmp_path: Path) -> None:
    first = run_fuzz(cases=1, seed=11, corpus_dir=tmp_path)
    second = run_fuzz(cases=1, seed=11, corpus_dir=tmp_path)
    assert first["ok"] and second["ok"]
    assert [
        (entry["name"], entry["cases"], entry["failures"])
        for entry in first["properties"]
    ] == [
        (entry["name"], entry["cases"], entry["failures"])
        for entry in second["properties"]
    ]
