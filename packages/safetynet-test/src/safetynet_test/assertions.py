"""Readable assertions for verdicts, votes, and consensus outcomes."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, cast

from safetynet_sim import ContractRevert, TxResult


def _tx(value: Any) -> TxResult:
    return cast(TxResult, value.tx if hasattr(value, "tx") else value)


def assert_verdict(
    actual: dict[str, Any] | None,
    *,
    verdict: str | None = None,
    severity: str | None = None,
    confidence: str | None = None,
    clauses: list[str] | None = None,
    **kwargs: Any,
) -> None:
    """Assert the canonical four-field verdict object."""
    assert actual is not None, "expected a verdict, got none"
    if verdict is not None:
        assert actual.get("verdict") == verdict, actual
    if severity is not None:
        assert actual.get("severity") == severity, actual
    if confidence is not None:
        assert actual.get("confidence") == confidence, actual
    if clauses is not None:
        assert actual.get("clauses") == clauses, actual
    for key, expected in kwargs.items():
        assert actual.get(key) == expected, actual


def assert_no_verdict(contract: Any, incident_id: str) -> None:
    assert contract.read.get_verdict(incident_id) is None


def assert_accepted(tx: Any) -> None:
    result = _tx(tx)
    assert result.status in ("ACCEPTED", "FINALIZED"), result.status


def assert_undetermined(tx: Any) -> None:
    result = _tx(tx)
    assert result.status == "UNDETERMINED", result.status


def assert_votes(
    tx: Any,
    *,
    agree: int | None = None,
    disagree: int | None = None,
    timeout: int | None = None,
    abstain: int | None = None,
) -> None:
    votes = _tx(tx).votes
    if agree is not None:
        assert votes.agree == agree, votes
    if disagree is not None:
        assert votes.disagree == disagree, votes
    if timeout is not None:
        assert votes.timeout == timeout, votes
    if abstain is not None:
        assert votes.abstain == abstain, votes


def assert_nondet_budget(
    tx: Any,
    *,
    max_blocks: int = 3,
    max_llm_calls: int = 6,
    max_web_calls: int | None = None,
) -> None:
    result = _tx(tx)
    assert result.nondet_blocks <= max_blocks, result.nondet_blocks
    assert result.llm_calls <= max_llm_calls, result.llm_calls
    if max_web_calls is not None:
        assert result.web_calls <= max_web_calls, result.web_calls


def assert_evidence_rejected(
    call: Callable[[], Any],
    *,
    code: str,
) -> None:
    try:
        call()
    except ContractRevert as error:
        assert code in str(error), str(error)
    else:
        raise AssertionError(f"expected revert containing {code!r}")


def assert_policy_pinned(incident: dict[str, Any] | None, policy: Any) -> None:
    assert incident is not None, "expected an incident"
    assert incident.get("policy_hash") == policy.hash(), incident


def assert_storage(contract: Any, field: str, value: Any) -> None:
    assert getattr(contract.instance, field) == value


def assert_reverts(call: Callable[[], Any], *, code: str) -> None:
    assert_evidence_rejected(call, code=code)
