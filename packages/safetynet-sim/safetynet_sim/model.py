"""Core simulator model: config, validators, votes, rounds, results, traces.

Mirrors AGENTS.md §17.3 and §16.15. The simulator approximates consensus; it
is not the real network (see docs/reference/sim-coverage.md).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class Vote(str, Enum):
    AGREE = "agree"
    DISAGREE = "disagree"
    TIMEOUT = "timeout"
    ABSTAIN = "abstain"


class Outcome(str, Enum):
    ACCEPTED = "ACCEPTED"
    UNDETERMINED = "UNDETERMINED"
    CANCELED = "CANCELED"
    REVERTED = "REVERTED"


class Behavior(str, Enum):
    HONEST = "honest"
    LAZY = "lazy"          # always agrees
    MALICIOUS = "malicious"
    FLAKY = "flaky"
    ABSTAIN = "abstain"


@dataclass(frozen=True)
class SimConfig:
    validators: int = 5
    seed: int = 1337
    majority: float = 0.5          # strictly greater than
    appeal_growth: int = 2         # new_size = size * growth + 1
    max_appeals: int = 1
    timeout_ms: int = 30_000

    def to_dict(self) -> dict[str, Any]:
        return {
            "validators": self.validators,
            "seed": self.seed,
            "majority": self.majority,
            "appeal_growth": self.appeal_growth,
            "max_appeals": self.max_appeals,
            "timeout_ms": self.timeout_ms,
        }


@dataclass
class Validator:
    index: int
    online: bool = True
    behavior: Behavior = Behavior.HONEST
    flaky_p: float = 0.0
    malicious_payload: Any = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "index": self.index,
            "online": self.online,
            "behavior": self.behavior.value,
            "flaky_p": self.flaky_p,
        }


@dataclass
class Votes:
    agree: int = 0
    disagree: int = 0
    timeout: int = 0
    abstain: int = 0

    @property
    def total(self) -> int:
        return self.agree + self.disagree + self.timeout + self.abstain

    def to_dict(self) -> dict[str, Any]:
        return {
            "agree": self.agree,
            "disagree": self.disagree,
            "timeout": self.timeout,
            "abstain": self.abstain,
        }


@dataclass
class ValidatorVote:
    validator: int
    vote: Vote
    payload: Any = None
    error: str | None = None
    reason: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "validator": self.validator,
            "vote": self.vote.value,
            "payload": self.payload,
            "error": self.error,
            "reason": self.reason,
        }


@dataclass
class Round:
    number: int
    leader: int
    validator_set: list[int]
    leader_payload: Any = None
    leader_error: str | None = None
    votes: list[ValidatorVote] = field(default_factory=list)
    tally: Votes = field(default_factory=Votes)
    accepted: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "number": self.number,
            "leader": self.leader,
            "validator_set": self.validator_set,
            "leader_payload": self.leader_payload,
            "leader_error": self.leader_error,
            "votes": [v.to_dict() for v in self.votes],
            "tally": self.tally.to_dict(),
            "accepted": self.accepted,
        }


@dataclass
class ConsensusTrace:
    tx_hash: str
    method: str
    address: str
    sender: str
    status: str
    seed: int
    validators: int
    rounds: list[Round] = field(default_factory=list)
    nondet_blocks: int = 0
    llm_calls: int = 0
    web_calls: int = 0
    storage_writes: int = 0
    validator_work_units: int = 0
    tampered: bool = False
    error: str | None = None
    return_value: Any = None

    @property
    def repro(self) -> str:
        return (
            f"snet test -k <test> --seed {self.seed} "
            f"--validators {self.validators} mode=sim"
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "txHash": self.tx_hash,
            "method": self.method,
            "address": self.address,
            "sender": self.sender,
            "status": self.status,
            "seed": self.seed,
            "validators": self.validators,
            "rounds": [r.to_dict() for r in self.rounds],
            "nondet_blocks": self.nondet_blocks,
            "llm_calls": self.llm_calls,
            "web_calls": self.web_calls,
            "storage_writes": self.storage_writes,
            "validator_work_units": self.validator_work_units,
            "tampered": self.tampered,
            "error": self.error,
            "return_value": self.return_value,
            "repro": self.repro,
        }

    def pretty(self) -> str:
        """Render the consensus trace in the §16.16 failure format."""
        lines = [
            f"  Consensus trace  ({self.status})",
            f"  seed={self.seed} validators={self.validators} mode=sim",
            "",
        ]
        for rnd in self.rounds:
            lines.append(f"  round {rnd.number} leader=v{rnd.leader}")
            leader_payload = _short(rnd.leader_payload)
            lines.append(f"    leader (v{rnd.leader})  -> {leader_payload}")
            for v in rnd.votes:
                if v.vote == Vote.AGREE:
                    verdict = "agree"
                elif v.vote == Vote.DISAGREE:
                    diff = _diff(rnd.leader_payload, v.payload)
                    verdict = f"DISAGREE ({diff})" if diff else "DISAGREE"
                elif v.vote == Vote.TIMEOUT:
                    verdict = "timeout"
                else:
                    verdict = "abstain"
                lines.append(f"    v{v.validator:<12} -> {_short(v.payload)}   {verdict}")
            t = rnd.tally
            lines.append(
                f"    tally: {t.agree} agree / {t.disagree} disagree / "
                f"{t.timeout} timeout / {t.abstain} abstain -> "
                f"{'ACCEPTED' if rnd.accepted else 'not accepted'}"
            )
            lines.append("")
        lines.append(
            f"  nondet blocks={self.nondet_blocks} llm calls={self.llm_calls} "
            f"web calls={self.web_calls} work units={self.validator_work_units}"
        )
        if self.tampered:
            lines.append("  tampered evidence detected")
        if self.error:
            lines.append(f"  error: {self.error}")
        lines.append(f"  repro: {self.repro}")
        return "\n".join(lines)


@dataclass
class TxResult:
    """§16.15 TxResult model."""

    hash: str
    status: str
    round: int = 1
    appeals: int = 0
    leader_index: int = 0
    votes: Votes = field(default_factory=Votes)
    nondet_blocks: int = 0
    llm_calls: int = 0
    web_calls: int = 0
    return_value: Any = None
    error: str | None = None
    trace: ConsensusTrace | None = None
    storage_writes: int = 0
    validator_work_units: int = 0
    tampered: bool = False

    @property
    def gas_like(self) -> dict[str, int]:
        """Deterministic cost model (§17.8), not real gas."""
        return {
            "validator_work_units": self.validator_work_units,
            "llm_calls": self.llm_calls,
            "web_calls": self.web_calls,
            "storage_writes": self.storage_writes,
            "rounds": self.round,
        }

    def to_dict(self) -> dict[str, Any]:
        return {
            "hash": self.hash,
            "status": self.status,
            "round": self.round,
            "appeals": self.appeals,
            "leader_index": self.leader_index,
            "votes": self.votes.to_dict(),
            "nondet_blocks": self.nondet_blocks,
            "llm_calls": self.llm_calls,
            "web_calls": self.web_calls,
            "return_value": self.return_value,
            "error": self.error,
            "storage_writes": self.storage_writes,
            "validator_work_units": self.validator_work_units,
            "tampered": self.tampered,
            "gas_like": self.gas_like,
            "trace": self.trace.to_dict() if self.trace else None,
        }


def _short(value: Any, limit: int = 150) -> str:
    if value is None:
        return "None"
    try:
        text = json.dumps(value, sort_keys=True, separators=(",", ":"))
    except (TypeError, ValueError):
        text = repr(value)
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _diff(left: Any, right: Any) -> str | None:
    """Return the first differing field name, for the failure UX."""
    if isinstance(left, dict) and isinstance(right, dict):
        for key in sorted(set(left) | set(right)):
            if left.get(key) != right.get(key):
                return f"{key} differs"
    if type(left) is not type(right):
        return f"type differs ({type(left).__name__} vs {type(right).__name__})"
    return "value differs"
