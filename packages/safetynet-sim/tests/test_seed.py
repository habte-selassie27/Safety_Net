"""SEED-001: synthetic seed fixtures and deterministic runner."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from safetynet_sim.seed import (
    DEFAULT_FIXTURES,
    SeedError,
    load_fixtures,
    policy_text_hash,
    run_seed,
)

ROOT = Path(__file__).resolve().parents[3]


def test_seed_set_matches_all_five_expected_verdicts():
    report = run_seed()
    assert report["synthetic"] is True
    assert report["network"] == "sim"
    assert report["matched"] is True
    assert len(report["incidents"]) == 5
    assert [entry["actual"]["verdict"] for entry in report["incidents"]] == [
        "POLICY_VIOLATION",
        "POLICY_VIOLATION",
        "POLICY_ADEQUATE_BUT_HARM",
        "DISMISSED",
        "INSUFFICIENT_EVIDENCE",
    ]
    assert all(entry["synthetic"] for entry in report["incidents"])


def test_seed_is_deterministic():
    first = run_seed()
    second = run_seed()
    assert first["contract"]["address"] == second["contract"]["address"]
    assert [entry["incident_id"] for entry in first["incidents"]] == [
        entry["incident_id"] for entry in second["incidents"]
    ]
    assert [entry["actual"] for entry in first["incidents"]] == [
        entry["actual"] for entry in second["incidents"]
    ]


def test_seed_can_skip_adjudication():
    report = run_seed(adjudicate=False)
    assert report["matched"] is None
    assert all(entry["actual"] is None for entry in report["incidents"])


def test_seed_policy_hashes_are_computed_from_policy_text():
    fixtures = load_fixtures(DEFAULT_FIXTURES)
    hashes = {system["system_id"]: system["_policy_hash"] for system in fixtures["systems"]}
    assert hashes["synthetic-chatbot-1"] == (
        "sha256:5f8c41a3871973628e6c66d3e2db9efa891459fe181b5f898abe6f08a1818707"
    )
    assert hashes["synthetic-agent-loan"] == (
        "sha256:20bbe6c90577ec2d6aea822ff083ddd5a3c631b8b98dd354b06e518c237d7e97"
    )
    assert hashes["synthetic-codegen-1"] == (
        "sha256:13c5e887d7f5133ed3a480cc2b2afb6adc4b31632f0504471a2d3b612ebb554e"
    )
    assert hashes["synthetic-moderator-1"] == (
        "sha256:37a220078d25ac291352afe7cb5e1311192a413432feebdf9372530896f4f571"
    )


def test_policy_text_hash_normalizes_line_endings():
    text = "\ufeff# Policy\r\n\r\n## C1 — Test\r\nBody.   \r\n\r\n"
    assert policy_text_hash(text) == policy_text_hash("# Policy\n\n## C1 — Test\nBody.\n")


def test_unlabelled_fixture_is_rejected(tmp_path: Path):
    fixture = tmp_path / "seed.json"
    fixture.write_text(
        json.dumps({"systems": [], "incidents": []}), encoding="utf-8"
    )
    with pytest.raises(SeedError, match="synthetic"):
        load_fixtures(fixture)


def test_expected_verdict_mismatch_is_reported(tmp_path: Path):
    data = json.loads(DEFAULT_FIXTURES.read_text(encoding="utf-8"))
    data["incidents"][0]["expected_verdict"]["severity"] = "LOW"
    fixture = tmp_path / "seed.json"
    fixture.write_text(json.dumps(data), encoding="utf-8")
    # Policy paths are relative to the fixture file; copy them into place.
    (tmp_path / "policies").symlink_to(ROOT / "test" / "fixtures" / "seed" / "policies")
    report = run_seed(fixture)
    assert report["matched"] is False
    assert report["incidents"][0]["matched"] is False
