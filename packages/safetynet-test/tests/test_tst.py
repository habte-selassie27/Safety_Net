from __future__ import annotations

import pytest
from safetynet_test import (
    Evidence,
    assert_no_verdict,
    assert_nondet_budget,
    assert_verdict,
    canonical_verdict,
    clause_sets,
    injection_strings,
    noisy_claims,
    policy_text_hash,
)
from safetynet_test.property import evidence_manifests


def _register(sn, policy) -> None:
    sn.write.register_system(
        "synthetic-chatbot-1",
        "Synthetic Chatbot",
        "synthetic-provider",
        policy.version_value,
        policy.hash(),
        policy.clause_ids(),
        policy.url,
    )


def _file(sn, evidence) -> str:
    return sn.write.file_incident(
        "synthetic-chatbot-1",
        "1.0.0",
        "SYNTHETIC: the assistant gave a prescription dosage despite clause C1.",
        evidence.hash(),
        evidence.manifest_json(),
    )


def test_deploy_register_and_read(deploy, policy):
    sn = deploy()
    pol = policy.version("1.0.0").clause(
        "C1",
        "The system must not provide specific prescription dosages.",
        mandatory=True,
    )
    tx = sn.write.register_system(
        "synthetic-chatbot-1",
        "Synthetic Chatbot",
        "synthetic-provider",
        pol.version_value,
        pol.hash(),
        pol.clause_ids(),
        pol.url,
    )
    assert tx == "synthetic-chatbot-1"
    assert tx.status == "ACCEPTED"

    system = sn.read.get_system("synthetic-chatbot-1")
    assert system["system_id"] == "synthetic-chatbot-1"
    assert system["policy_key"] == "synthetic-chatbot-1@1.0.0"


def test_adjudication_with_policy_and_llm_mocks(
    deploy, policy, evidence, mock_web, mock_llm
):
    sn = deploy()
    pol = policy.version("1.0.0").clause(
        "C1",
        "The system must not provide specific prescription dosages.",
        mandatory=True,
    )
    _register(sn, pol)
    mock_web.policy(pol)
    mock_llm.clause("C1").respond(
        {"clause_id": "C1", "finding": "VIOLATED", "reason_code": "EXPLICIT"}
    )

    ev = evidence.inline("SYNTHETIC TRANSCRIPT: Take 4000mg hourly.")
    inc_id = _file(sn, ev)
    tx = sn.write.adjudicate(inc_id)

    assert tx.status == "ACCEPTED"
    assert_nondet_budget(tx, max_blocks=1, max_llm_calls=6)
    verdict = sn.read.get_verdict(inc_id)
    assert_verdict(
        verdict,
        verdict="POLICY_VIOLATION",
        severity="SERIOUS",
        confidence="MEDIUM",
        clauses=["C1"],
    )


def test_expect_revert(deploy, policy, gf):
    sn = deploy()
    pol = policy.version("1.0.0").clause(
        "C1",
        "The system must not provide specific prescription dosages.",
        mandatory=True,
    )
    _register(sn, pol)

    with gf.expect_revert("UNKNOWN_INCIDENT"):
        sn.write.adjudicate("inc-999999")
    assert_no_verdict(sn, "inc-999999")


def test_unmocked_policy_fails_closed(deploy, policy, evidence, gf):
    sn = deploy()
    pol = policy.version("1.0.0").clause(
        "C1",
        "The system must not provide specific prescription dosages.",
        mandatory=True,
    )
    _register(sn, pol)
    inc_id = _file(sn, evidence.inline("SYNTHETIC TRANSCRIPT: Take 4000mg hourly."))

    with gf.expect_revert("EVIDENCE_FETCH_FAILED"):
        sn.write.adjudicate(inc_id)
    assert_no_verdict(sn, inc_id)


def test_snapshot_restore(deploy, policy, gf):
    sn = deploy()
    pol = policy.version("1.0.0").clause(
        "C1",
        "The system must not provide specific prescription dosages.",
        mandatory=True,
    )
    _register(sn, pol)
    snapshot_id = gf.snapshot()
    sn.write.register_system(
        "synthetic-chatbot-2",
        "Synthetic Chatbot 2",
        "synthetic-provider",
        pol.version_value,
        pol.hash(),
        pol.clause_ids(),
        pol.url,
    )
    assert sn.read.get_system("synthetic-chatbot-2") is not None
    gf.revert(snapshot_id)
    assert sn.read.get_system("synthetic-chatbot-2") is None


def test_evidence_and_policy_hashes_are_stable():
    ev = (
        Evidence()
        .inline("SYNTHETIC evidence")
        .url(
            "https://example.com/transcript",
            text="SYNTHETIC page",
        )
    )
    assert ev.hash() == ev.hash()
    assert ev.manifest()["items"][0]["id"] == "e1"
    assert ev.manifest()["items"][1]["id"] == "e2"
    assert policy_text_hash("a\r\nb   \r\n") == policy_text_hash("a\nb\n")


def test_property_strategies_are_deterministic():
    assert clause_sets(seed=1) == clause_sets(seed=1)
    assert noisy_claims(seed=1) == noisy_claims(seed=1)
    assert evidence_manifests(seed=1) == evidence_manifests(seed=1)
    assert len(injection_strings()) >= 5
    assert canonical_verdict(
        {
            "verdict": "policy_violation",
            "severity": "serious",
            "confidence": "high",
            "clauses": ["c2", "C1"],
        }
    ) == {
        "verdict": "POLICY_VIOLATION",
        "severity": "SERIOUS",
        "confidence": "HIGH",
        "clauses": ["C1", "C2"],
    }


@pytest.mark.sim_only
def test_sim_only_marker_works():
    assert True


def test_verdict_coverage_counts_only_accepted_adjudications():
    from types import SimpleNamespace

    from safetynet_test.plugin import collect_verdict_coverage

    class Tx:
        def __init__(self, status, value):
            self.status = status
            self.return_value = value
            self.trace = SimpleNamespace(method="adjudicate")

    context = SimpleNamespace(
        transactions=[
            Tx("ACCEPTED", "POLICY_VIOLATION"),
            Tx("FINALIZED", {"verdict": "INSUFFICIENT_EVIDENCE"}),
            Tx("UNDETERMINED", "DISMISSED"),
            Tx("ACCEPTED", "not-a-verdict"),
            Tx("ACCEPTED", "register_system-result"),
        ]
    )
    items = [SimpleNamespace(funcargs={"context": context})]

    assert collect_verdict_coverage(items) == {
        "POLICY_VIOLATION": 1,
        "POLICY_ADEQUATE_BUT_HARM": 0,
        "INSUFFICIENT_EVIDENCE": 1,
        "OUT_OF_SCOPE": 0,
        "DISMISSED": 0,
    }


def _adjudicated_incident(sn, policy, evidence, mock_web, mock_llm):
    pol = policy.version("1.0.0").clause(
        "C1",
        "The system must not provide specific prescription dosages.",
        mandatory=True,
    )
    _register(sn, pol)
    mock_web.policy(pol)
    mock_llm.clause("C1").respond(
        {"clause_id": "C1", "finding": "VIOLATED", "reason_code": "EXPLICIT"}
    )
    inc_id = _file(sn, evidence.inline("SYNTHETIC TRANSCRIPT: Take 4000mg hourly."))
    tx = sn.write.adjudicate(inc_id)
    assert tx.status == "ACCEPTED"
    return inc_id


def test_appeal_after_window_reverts(
    deploy, policy, evidence, mock_web, mock_llm, gf
):
    sn = deploy()
    inc_id = _adjudicated_incident(sn, policy, evidence, mock_web, mock_llm)

    gf.warp_by(73 * 3600)  # default window is 72h
    with gf.expect_revert("APPEAL_WINDOW_CLOSED"):
        sn.write.appeal(
            inc_id,
            "SYNTHETIC: the verdict ignored the pinned transcript evidence.",
        )

    assert sn.read.get_appeals(inc_id) == []
    assert sn.read.get_verdict(inc_id)["round"] == 1


def test_finalize_before_window_reverts(
    deploy, policy, evidence, mock_web, mock_llm, gf
):
    sn = deploy()
    inc_id = _adjudicated_incident(sn, policy, evidence, mock_web, mock_llm)

    with gf.expect_revert("APPEAL_WINDOW_OPEN"):
        sn.write.finalize(inc_id)

    assert sn.read.get_incident(inc_id)["status"] == "DECIDED"


def test_appeal_within_window_then_finalize(
    deploy, policy, evidence, mock_web, mock_llm, gf
):
    sn = deploy()
    inc_id = _adjudicated_incident(sn, policy, evidence, mock_web, mock_llm)

    gf.warp_by(3600)
    sn.write.appeal(
        inc_id,
        "SYNTHETIC: the verdict ignored the pinned transcript evidence.",
    )
    appeals = sn.read.get_appeals(inc_id)
    assert len(appeals) == 1
    assert appeals[0]["prior_verdict"] == "POLICY_VIOLATION"
    assert sn.read.get_incident(inc_id)["status"] == "APPEALED"

    gf.warp_by(73 * 3600)
    sn.write.finalize(inc_id)
    assert sn.read.get_incident(inc_id)["status"] == "FINAL"
    assert sn.read.get_verdict(inc_id)["round"] == 1
