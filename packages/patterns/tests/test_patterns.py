"""Pattern library smoke tests."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from safetynet_patterns import get, PATTERNS
from safetynet_patterns.p1_enum_verdict import canonical as p1_canonical
from safetynet_patterns.p7_deterministic_aggregation import aggregate as p7_aggregate
from safetynet_patterns.p8_pinned_evidence import pin as p8_pin, verify as p8_verify


def test_get_known_pattern():
    assert get("P1")["id"] == "P1"
    assert get("P7")["id"] == "P7"
    assert get("P8")["id"] == "P8"


def test_get_unknown_raises():
    try:
        get("P99")
    except KeyError:
        return
    raise AssertionError("expected KeyError")


def test_p1_canonicalizes():
    assert p1_canonical({"verdict": "POLICY_VIOLATION"}) == "POLICY_VIOLATION"
    assert p1_canonical({"verdict": "garbage"}) == "INSUFFICIENT_EVIDENCE"
    assert p1_canonical("dismissed") == "DISMISSED"


def test_p7_aggregates_mandatory_violation():
    r = p7_aggregate([{"clause_id": "C1", "finding": "VIOLATED", "mandatory": True}])
    assert r["verdict"] == "POLICY_VIOLATION"
    assert r["clauses"] == ["C1"]


def test_p7_all_compliant_is_gap():
    r = p7_aggregate([{"clause_id": "C1", "finding": "COMPLIANT"}])
    assert r["verdict"] == "POLICY_ADEQUATE_BUT_HARM"


def test_p8_pin_and_verify():
    h = p8_pin("hello")
    assert h.startswith("sha256:")
    assert p8_verify(h, "hello")["tampered"] is False
    assert p8_verify(h, "changed")["tampered"] is True
    assert p8_verify(h, "changed")["can_dismiss"] is False


def test_patterns_count():
    assert len(PATTERNS) == 3
