"""Mock registry behavior tests (SIM-008 adjacent)."""

import pytest
from safetynet_sim.errors import UnmockedLLMCall, UnmockedWebCall
from safetynet_sim.mocks import MockRegistry


def test_contains_regex_exact_hash_matching():
    registry = MockRegistry()
    registry.llm.when(contains="alpha").respond("A")
    registry.llm.when(regex=r"beta-\d+").respond("B")
    registry.llm.when(exact="gamma").respond("G")
    import hashlib

    digest = "sha256:" + hashlib.sha256(b"delta").hexdigest()
    registry.llm.when(hash=digest).respond("D")

    assert registry.llm.resolve("xx alpha yy", role="leader", validator_index=0) == "A"
    assert registry.llm.resolve("beta-42", role="leader", validator_index=0) == "B"
    assert registry.llm.resolve("gamma", role="leader", validator_index=0) == "G"
    assert registry.llm.resolve("delta", role="leader", validator_index=0) == "D"


def test_later_rules_override_earlier_rules():
    registry = MockRegistry()
    registry.llm.when(contains="clause").respond("general")
    registry.llm.validators([1]).respond("validator-1")
    assert registry.llm.resolve("clause", role="validator", validator_index=1) == "validator-1"
    assert registry.llm.resolve("clause", role="validator", validator_index=2) == "general"


def test_sequence_returns_responses_in_order_then_repeats_last():
    registry = MockRegistry()
    registry.llm.sequence(["one", "two", "three"])
    assert registry.llm.resolve("x", role="leader", validator_index=0) == "one"
    assert registry.llm.resolve("x", role="leader", validator_index=0) == "two"
    assert registry.llm.resolve("x", role="leader", validator_index=0) == "three"
    assert registry.llm.resolve("x", role="leader", validator_index=0) == "three"


def test_unmatched_llm_call_raises_actionable_error():
    registry = MockRegistry()
    with pytest.raises(UnmockedLLMCall) as info:
        registry.llm.resolve("some prompt", role="leader", validator_index=0)
    assert "mock_llm.when" in str(info.value)


def test_unmatched_web_call_raises_actionable_error():
    registry = MockRegistry()
    with pytest.raises(UnmockedWebCall) as info:
        registry.web.resolve("https://nowhere.example", role="leader", validator_index=0)
    assert "mock_web.when" in str(info.value)


def test_default_rule_is_used_when_nothing_matches():
    registry = MockRegistry()
    registry.llm.default().respond("fallback")
    assert registry.llm.resolve("anything", role="leader", validator_index=0) == "fallback"


def test_calls_are_recorded():
    registry = MockRegistry()
    registry.llm.when(contains="x").respond("y")
    registry.llm.resolve("x", role="validator", validator_index=2)
    assert len(registry.llm.calls) == 1
    call = registry.llm.calls[0]
    assert call.role == "validator"
    assert call.validator_index == 2
    assert call.response == "y"
