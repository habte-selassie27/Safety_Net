"""Simulator engine tests (SIM-001, SIM-003..012)."""

import hashlib
import json

import pytest
from safetynet_sim import SimConfig, Simulator, Vote

CONTRACT = "contracts/safetynet.py"
ARGS = [8, 20000, 24, 72, 1, 48, "example.com,raw.githubusercontent.com"]
REPORTER = "0x" + "22" * 20
PROVIDER = "0x" + "33" * 20
POLICY_URL = "https://example.com/policy"
POLICY_TEXT = "## C1\nmust not give prescription dosage\n"
POLICY_HASH = "sha256:" + hashlib.sha256(POLICY_TEXT.encode("utf-8")).hexdigest()


def manifest(text: str) -> tuple[str, str]:
    payload = {
        "schemaVersion": 1,
        "items": [
            {
                "id": "e1",
                "kind": "inline",
                "text": text,
                "contentSha256": "sha256:" + "b" * 64,
                "maxChars": 2000,
            }
        ],
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest(), canonical


@pytest.fixture
def sim() -> Simulator:
    return Simulator(SimConfig(validators=5, seed=1337, max_appeals=1))


@pytest.fixture
def deployed(sim: Simulator) -> str:
    address = sim.deploy(source_path=CONTRACT, args=ARGS)
    sim.write(
        address,
        "register_system",
        ["bot-1", "Synthetic Bot", "acme", "1.0.0", POLICY_HASH, ["C1"], POLICY_URL],
        sender=PROVIDER,
    )
    sim.write(address, "claim_system", ["bot-1"], sender=PROVIDER)
    return address


def file_incident(sim: Simulator, address: str, claim: str = "the bot gave dosage advice") -> str:
    evidence_hash, evidence_json = manifest("Take 4000mg of DrugX every hour.")
    result = sim.write(
        address,
        "file_incident",
        ["bot-1", "1.0.0", claim, evidence_hash, evidence_json],
        sender=REPORTER,
    )
    assert result.status == "ACCEPTED", result.error
    return result.return_value


def mock_happy_path(sim: Simulator) -> None:
    sim.mock_web.when(url=POLICY_URL).respond(text=POLICY_TEXT)
    sim.mock_llm.when(contains='<clause id="C1">').respond(
        {"clause_id": "C1", "finding": "VIOLATED", "reason_code": "EXPLICIT"}
    )


# -- SIM-001: contract loads and runs under the shim -----------------------

def test_contract_loads_and_view_runs(sim: Simulator, deployed: str):
    config = json.loads(sim.read(deployed, "get_config"))
    assert config["max_evidence_items"] == 8
    assert config["max_appeals"] == 1
    assert sim.read(deployed, "get_incident_count") == 0
    system = json.loads(sim.read(deployed, "get_system", ["bot-1"]))
    assert system["system_id"] == "bot-1"
    assert system["claimed_by"] == PROVIDER


# -- SIM-003: leader/validator loop, majority rule ------------------------

def test_adjudication_accepts_with_unanimous_validators(sim: Simulator, deployed: str):
    incident = file_incident(sim, deployed)
    mock_happy_path(sim)
    result = sim.write(deployed, "adjudicate", [incident], sender=REPORTER)
    assert result.status == "ACCEPTED"
    assert result.votes.agree == 5
    assert result.votes.disagree == 0
    verdict = json.loads(sim.read(deployed, "get_verdict", [incident]))
    assert verdict["verdict"] == "POLICY_VIOLATION"
    assert verdict["clauses"] == ["C1"]


def test_deterministic_write_without_mocks_is_accepted(sim: Simulator, deployed: str):
    result = sim.write(
        deployed,
        "publish_policy",
        ["bot-1", "1.1.0", POLICY_HASH, ["C1"], POLICY_URL],
        sender=PROVIDER,
    )
    assert result.status == "ACCEPTED"
    assert result.nondet_blocks == 0
    assert result.votes.agree == 5


# -- SIM-004: timeouts ----------------------------------------------------

def test_offline_validators_vote_timeout(sim: Simulator, deployed: str):
    incident = file_incident(sim, deployed)
    mock_happy_path(sim)
    sim.fail_validator(1, "offline")
    sim.fail_validator(2, "timeout")
    result = sim.write(deployed, "adjudicate", [incident], sender=REPORTER)
    assert result.status == "ACCEPTED"
    assert result.votes.timeout >= 2
    assert result.votes.agree >= 3


def test_majority_offline_makes_tx_undetermined(sim: Simulator, deployed: str):
    incident = file_incident(sim, deployed)
    mock_happy_path(sim)
    for index in (0, 1, 2, 3):
        sim.fail_validator(index, "offline")
    result = sim.write(deployed, "adjudicate", [incident], sender=REPORTER)
    assert result.status in ("UNDETERMINED", "ACCEPTED")
    if result.status == "UNDETERMINED":
        assert sim.read(deployed, "get_verdict", [incident]) == ""
    else:  # appeal round brought enough honest validators
        assert result.round == 2


# -- SIM-005: appeals -----------------------------------------------------

def test_disagreement_triggers_appeal_round_with_more_validators(sim: Simulator, deployed: str):
    incident = file_incident(sim, deployed)
    sim.set_leader(0)
    sim.mock_web.when(url=POLICY_URL).respond(text=POLICY_TEXT)
    # 3 of 5 validators see the clause as compliant -> majority disagree.
    sim.mock_llm.when(contains='<clause id="C1">').respond(
        {"clause_id": "C1", "finding": "VIOLATED", "reason_code": "EXPLICIT"}
    )
    sim.mock_llm.validators([1, 2, 3]).respond(
        {"clause_id": "C1", "finding": "COMPLIANT", "reason_code": "NOT_COVERED"}
    )
    result = sim.write(deployed, "adjudicate", [incident], sender=REPORTER)
    assert result.round == 2
    assert result.appeals == 1
    assert len(result.trace.rounds) == 2
    assert len(result.trace.rounds[1].validator_set) == 11


def test_no_appeals_left_means_undetermined(sim: Simulator, deployed: str):
    sim.config = SimConfig(validators=5, seed=1337, max_appeals=0)
    incident = file_incident(sim, deployed)
    sim.set_leader(0)
    sim.mock_web.when(url=POLICY_URL).respond(text=POLICY_TEXT)
    sim.mock_llm.when(contains='<clause id="C1">').respond(
        {"clause_id": "C1", "finding": "VIOLATED", "reason_code": "EXPLICIT"}
    )
    sim.mock_llm.validators([1, 2, 3]).respond(
        {"clause_id": "C1", "finding": "COMPLIANT", "reason_code": "NOT_COVERED"}
    )
    result = sim.write(deployed, "adjudicate", [incident], sender=REPORTER)
    assert result.status == "UNDETERMINED"
    assert sim.read(deployed, "get_verdict", [incident]) == ""


# -- SIM-006: determinism -------------------------------------------------

def test_identical_runs_produce_identical_traces():
    traces = []
    for _ in range(100):
        sim = Simulator(SimConfig(validators=5, seed=42))
        address = sim.deploy(source_path=CONTRACT, args=ARGS)
        sim.write(
            address,
            "register_system",
            ["bot-1", "Synthetic Bot", "acme", "1.0.0", POLICY_HASH, ["C1"], POLICY_URL],
            sender=PROVIDER,
        )
        incident = file_incident(sim, address)
        mock_happy_path(sim)
        result = sim.write(address, "adjudicate", [incident], sender=REPORTER)
        traces.append(result.trace.to_dict())
    assert all(trace == traces[0] for trace in traces)


# -- SIM-007: cost counters ----------------------------------------------

def test_cost_counters_count_nondet_and_llm_calls(sim: Simulator, deployed: str):
    incident = file_incident(sim, deployed)
    mock_happy_path(sim)
    result = sim.write(deployed, "adjudicate", [incident], sender=REPORTER)
    # One nondet block in the leader; 1 clause x (leader + 4 validators) prompts.
    assert result.nondet_blocks == 1
    assert result.llm_calls == 5
    assert result.web_calls == 5
    assert result.storage_writes > 0
    expected_units = (
        result.llm_calls * 10 + result.web_calls * 5 + result.storage_writes
    )
    assert result.validator_work_units == expected_units
    assert result.trace.validator_work_units == expected_units
    assert result.gas_like["validator_work_units"] == expected_units
    assert result.gas_like["rounds"] == result.round


# -- SIM-008: fault injection --------------------------------------------

def test_lazy_validator_always_agrees(sim: Simulator, deployed: str):
    incident = file_incident(sim, deployed)
    sim.mock_web.when(url=POLICY_URL).respond(text=POLICY_TEXT)
    sim.mock_llm.when(contains='<clause id="C1">').respond(
        {"clause_id": "C1", "finding": "VIOLATED", "reason_code": "EXPLICIT"}
    )
    sim.mock_llm.validators([1, 2, 3]).respond(
        {"clause_id": "C1", "finding": "COMPLIANT", "reason_code": "NOT_COVERED"}
    )
    sim.fail_validator(1, "lazy")
    sim.fail_validator(2, "lazy")
    sim.fail_validator(3, "lazy")
    result = sim.write(deployed, "adjudicate", [incident], sender=REPORTER)
    assert result.status == "ACCEPTED"
    assert result.votes.agree == 5
    assert all(v.reason == "lazy" for v in result.trace.rounds[0].votes if v.reason == "lazy")


def test_malicious_validator_disagrees(sim: Simulator, deployed: str):
    incident = file_incident(sim, deployed)
    mock_happy_path(sim)
    sim.set_behavior(1, "malicious", payload={"verdict": "DISMISSED"})
    result = sim.write(deployed, "adjudicate", [incident], sender=REPORTER)
    assert result.status == "ACCEPTED"
    rounds = result.trace.rounds
    if len(rounds) == 1:
        assert result.votes.disagree >= 1


def test_abstaining_validator_reduces_agree_margin(sim: Simulator, deployed: str):
    incident = file_incident(sim, deployed)
    mock_happy_path(sim)
    sim.fail_validator(1, "abstain")
    result = sim.write(deployed, "adjudicate", [incident], sender=REPORTER)
    assert result.status == "ACCEPTED"
    assert result.votes.abstain == 1


def test_flaky_validator_can_disagree(sim: Simulator, deployed: str):
    incident = file_incident(sim, deployed)
    mock_happy_path(sim)
    sim.set_behavior(1, "flaky", p=1.0)
    result = sim.write(deployed, "adjudicate", [incident], sender=REPORTER)
    assert result.status == "ACCEPTED"
    first_round = result.trace.rounds[0]
    flaky = next(v for v in first_round.votes if v.validator == 1)
    assert flaky.vote == Vote.DISAGREE
    assert flaky.reason == "flaky"


def test_garbage_validator_disagrees(sim: Simulator, deployed: str):
    incident = file_incident(sim, deployed)
    mock_happy_path(sim)
    sim.fail_validator(1, "garbage")
    result = sim.write(deployed, "adjudicate", [incident], sender=REPORTER)
    assert result.status == "ACCEPTED"
    garbage = next(v for v in result.trace.rounds[0].votes if v.validator == 1)
    assert garbage.vote == Vote.DISAGREE


def test_forced_offline_leader_times_out_then_appeal_succeeds(
    sim: Simulator, deployed: str
):
    incident = file_incident(sim, deployed)
    mock_happy_path(sim)
    sim.set_leader(0)
    sim.fail_validator(0, "timeout")
    result = sim.write(deployed, "adjudicate", [incident], sender=REPORTER)
    assert result.status == "ACCEPTED"
    assert result.round == 2
    first = result.trace.rounds[0]
    assert first.leader == 0
    assert first.leader_error == "leader timeout"
    assert first.tally.agree == 0
    # The forced leader is one-shot, so round 2 elects an online validator.
    assert result.trace.rounds[1].leader != 0
    assert result.trace.rounds[1].leader_error is None


def test_malicious_leader_payload_is_rejected_by_honest_validators(
    sim: Simulator, deployed: str
):
    incident = file_incident(sim, deployed)
    mock_happy_path(sim)
    sim.set_leader(0)
    sim.set_behavior(0, "malicious", payload={"verdict": "DISMISSED"})
    result = sim.write(deployed, "adjudicate", [incident], sender=REPORTER)
    assert result.status == "ACCEPTED"
    assert result.round == 2
    first = result.trace.rounds[0]
    assert first.leader_payload == {"verdict": "DISMISSED"}
    assert first.accepted is False
    assert first.tally.disagree >= 4
    verdict = json.loads(sim.read(deployed, "get_verdict", [incident]))
    assert verdict["verdict"] == "POLICY_VIOLATION"


def test_tampered_web_evidence_is_flagged(sim: Simulator, deployed: str):
    incident = file_incident(sim, deployed)
    sim.mock_web.when(url=POLICY_URL).respond(
        text=POLICY_TEXT, sha256="sha256:" + "0" * 64
    )
    sim.mock_llm.when(contains='<clause id="C1">').respond(
        {"clause_id": "C1", "finding": "VIOLATED", "reason_code": "EXPLICIT"}
    )
    result = sim.write(deployed, "adjudicate", [incident], sender=REPORTER)
    assert result.status == "ACCEPTED"
    assert result.tampered is True
    assert result.trace.tampered is True
    assert "tampered evidence detected" in result.trace.pretty()


def test_stale_web_for_one_validator_causes_disagreement(
    sim: Simulator, deployed: str
):
    incident = file_incident(sim, deployed)
    sim.set_leader(0)
    sim.mock_web.when(url=POLICY_URL).respond(text=POLICY_TEXT)
    sim.mock_web.validators([2]).respond(
        text="## C1\ncompletely different policy\n"
    )
    sim.mock_llm.when(contains='<clause id="C1">').respond(
        {"clause_id": "C1", "finding": "VIOLATED", "reason_code": "EXPLICIT"}
    )
    result = sim.write(deployed, "adjudicate", [incident], sender=REPORTER)
    assert result.status == "ACCEPTED"
    assert result.votes.disagree == 1
    stale = next(v for v in result.trace.rounds[0].votes if v.validator == 2)
    assert stale.vote == Vote.DISAGREE


def test_llm_provider_error_fails_closed(sim: Simulator, deployed: str):
    incident = file_incident(sim, deployed)
    sim.mock_web.when(url=POLICY_URL).respond(text=POLICY_TEXT)
    sim.mock_llm.when(contains='<clause id="C1">').fail(kind="timeout")
    result = sim.write(deployed, "adjudicate", [incident], sender=REPORTER)
    assert result.status == "REVERTED"
    assert "LLM_OUTPUT_INVALID" in (result.error or "")
    assert sim.read(deployed, "get_verdict", [incident]) == ""



# -- SIM-012: unknown API fails loudly -----------------------------------

BAD_CONTRACT = """
from genlayer import *

class Bad(gl.Contract):
    @gl.public.write
    def go(self) -> str:
        return gl.this_does_not_exist()
"""


def test_unknown_sdk_feature_fails_loudly():
    sim = Simulator(SimConfig(validators=3, max_appeals=0))
    address = sim.deploy(source=BAD_CONTRACT, args=[])
    result = sim.write(address, "go", [])
    assert result.status == "UNDETERMINED"
    assert "Unsupported SDK feature" in (result.error or "")


# -- snapshot / revert ----------------------------------------------------

def test_snapshot_and_revert_restore_state(sim: Simulator, deployed: str):
    snapshot = sim.snapshot()
    file_incident(sim, deployed)
    assert sim.read(deployed, "get_incident_count") == 1
    sim.revert(snapshot)
    assert sim.read(deployed, "get_incident_count") == 0
    assert sim.read(deployed, "get_system", ["bot-1"]) != ""


def test_snapshot_restores_forced_leader(sim: Simulator):
    sim.set_leader(2)
    snapshot = sim.snapshot()
    sim.set_leader(3)
    assert sim.forced_leader == 3
    sim.revert(snapshot)
    assert sim.forced_leader == 2



def test_warp_advances_timestamp(sim: Simulator):
    before = sim.time
    sim.warp_by(3600)
    assert sim.time == before + 3600
    sim.warp(123)
    assert sim.time == 123


# -- unmocked calls are loud ---------------------------------------------

def test_unmocked_llm_raises_actionable_error(sim: Simulator, deployed: str):
    incident = file_incident(sim, deployed)
    sim.mock_web.when(url=POLICY_URL).respond(text=POLICY_TEXT)
    result = sim.write(deployed, "adjudicate", [incident], sender=REPORTER)
    assert result.status == "REVERTED"
    assert "LLM_OUTPUT_INVALID" in (result.error or "")
