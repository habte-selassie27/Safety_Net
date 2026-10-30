"""The consensus simulator engine.

Models the leader/validator/appeal flow from AGENTS.md §17.4:

1. snapshot state
2. elect a leader, execute the transaction as the leader
3. each validator independently re-executes and compares to the leader
4. tally votes; accept on strict majority, otherwise grow the validator set
   for an appeal round, otherwise revert and report UNDETERMINED
"""

from __future__ import annotations

import copy
import hashlib
import json
import random
from dataclasses import dataclass, field
from typing import Any

from .errors import SimError
from .mocks import MockLLM, MockRegistry, MockWeb
from .model import (
    Behavior,
    ConsensusTrace,
    Round,
    SimConfig,
    TxResult,
    Validator,
    ValidatorVote,
    Vote,
    Votes,
)
from .shim import (
    ContractUserError,
    CostCounters,
    execution_context,
    load_contract_class,
    restore_context,
)
from .storage import Address


@dataclass
class Deployment:
    address: str
    contract_cls: type
    instance: Any
    source: str
    source_path: str | None = None
    deployer: str = ""


@dataclass
class Execution:
    ok: bool
    payload: Any = None
    return_value: Any = None
    error: str | None = None
    error_kind: str | None = None  # "revert" | "timeout" | "crash"
    counters: CostCounters = field(default_factory=CostCounters)
    instance: Any = None
    tampered: bool = False


def _canonical(value: Any) -> str:
    try:
        return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    except (TypeError, ValueError):
        return repr(value)


def _equivalent(leader_payload: Any, payload: Any) -> bool:
    return _canonical(leader_payload) == _canonical(payload)


class Simulator:
    """In-process model of GenLayer consensus for SafetyNet contracts."""

    def __init__(self, config: SimConfig | None = None) -> None:
        self.config = config or SimConfig()
        self.rng = random.Random(self.config.seed)
        self.mocks = MockRegistry()
        self.validators = [Validator(index=i) for i in range(self.config.validators)]
        self.deployments: dict[str, Deployment] = {}
        self.traces: dict[str, ConsensusTrace] = {}
        self.time = 1_762_000_000
        self.tx_counter = 0
        self.snapshots: dict[str, dict[str, Any]] = {}
        self.snapshot_counter = 0
        self.forced_leader: int | None = None

    # -- registries -------------------------------------------------------

    @property
    def mock_llm(self) -> MockLLM:
        return self.mocks.llm

    @property
    def mock_web(self) -> MockWeb:
        return self.mocks.web

    # -- lifecycle --------------------------------------------------------

    def deploy(
        self,
        *,
        source_path: str | None = None,
        source: str | None = None,
        args: list[Any] | None = None,
        sender: str | None = None,
    ) -> str:
        if source is None:
            if source_path is None:
                raise SimError("deploy requires source or sourcePath")
            with open(source_path, encoding="utf-8") as handle:
                source = handle.read()
        contract_cls = load_contract_class(source, source_path or "<contract>")
        instance = contract_cls(*(args or []))
        address = "0x" + hashlib.sha256(
            (source + str(len(self.deployments))).encode("utf-8")
        ).hexdigest()[:40]
        self.deployments[address] = Deployment(
            address=address,
            contract_cls=contract_cls,
            instance=instance,
            source=source,
            source_path=source_path,
            deployer=sender or "",
        )
        return address

    def read(
        self,
        address: str,
        method: str,
        args: list[Any] | None = None,
        sender: str | None = None,
    ) -> Any:
        dep = self._deployment(address)
        fn = getattr(dep.instance, method, None)
        if fn is None:
            raise SimError(f"unknown method: {method}", code="E3002")
        tokens, _ctx = execution_context(
            role="view",
            validator_index=None,
            sender=Address(sender or "0x" + "11" * 20),
            timestamp=self.time,
            mocks=self.mocks,
            timeout_ms=self.config.timeout_ms,
        )
        try:
            return fn(*(args or []))
        finally:
            restore_context(tokens)

    def write(
        self,
        address: str,
        method: str,
        args: list[Any] | None = None,
        sender: str | None = None,
        wait: str = "ACCEPTED",
    ) -> TxResult:
        dep = self._deployment(address)
        if getattr(dep.instance, method, None) is None:
            raise SimError(f"unknown method: {method}", code="E3002")
        args = args or []
        sender_addr = Address(sender or "0x" + "11" * 20)

        self.tx_counter += 1
        tx_hash = "0x" + hashlib.sha256(
            f"{address}:{method}:{self.tx_counter}".encode()
        ).hexdigest()

        trace = ConsensusTrace(
            tx_hash=tx_hash,
            method=method,
            address=address,
            sender=str(sender_addr),
            status="PENDING",
            seed=self.config.seed,
            validators=len(self.validators),
        )

        initial_instance = dep.instance
        validator_set = list(range(len(self.validators)))
        round_no = 1
        rounds: list[Round] = []
        total = CostCounters()
        leader_exec: Execution | None = None
        leader_nondet_blocks = 0
        accepted = False
        terminal_error: str | None = None
        tampered_any = False

        while True:
            leader = self._elect_leader(validator_set, round_no)
            rnd = Round(number=round_no, leader=leader, validator_set=list(validator_set))
            if not self.validators[leader].online:
                # A forced offline leader models a leader timeout: no contract
                # execution happens, the round fails, and consensus retries.
                leader_exec = Execution(
                    ok=False, error="leader timeout", error_kind="timeout"
                )
            else:
                leader_exec = self._execute(
                    dep,
                    method,
                    args,
                    sender_addr,
                    role="leader",
                    validator_index=leader,
                )
            self._accumulate(total, leader_exec.counters)
            tampered_any = tampered_any or leader_exec.tampered
            leader_nondet_blocks = leader_exec.counters.nondet_blocks

            if not leader_exec.ok:
                rnd.leader_error = leader_exec.error
                if leader_exec.error_kind == "revert":
                    # Contract-level rejection: no consensus round is needed.
                    terminal_error = leader_exec.error
                    rounds.append(rnd)
                    trace.status = "REVERTED"
                    trace.error = terminal_error
                    break
                # leader timeout/crash -> try an appeal round if allowed
                rounds.append(rnd)
                if round_no > self.config.max_appeals:
                    trace.status = "UNDETERMINED"
                    terminal_error = leader_exec.error
                    break
                validator_set = self._grow_validators(validator_set)
                round_no += 1
                continue

            leader_payload = self._payload(leader_exec)
            leader_validator = self.validators[leader]
            if (
                leader_validator.behavior == Behavior.MALICIOUS
                and leader_validator.malicious_payload is not None
            ):
                # Model a malicious leader proposing a different nondet result.
                # Honest validators will disagree; if they somehow agree, the
                # committed state is still the honest execution above.
                leader_payload = leader_validator.malicious_payload
            rnd.leader_payload = leader_payload

            for index in validator_set:
                if index == leader:
                    rnd.votes.append(
                        ValidatorVote(validator=index, vote=Vote.AGREE, payload=leader_payload)
                    )
                    continue
                validator = self.validators[index]
                if not validator.online:
                    rnd.votes.append(
                        ValidatorVote(validator=index, vote=Vote.TIMEOUT, reason="offline")
                    )
                    continue
                if validator.behavior == Behavior.ABSTAIN:
                    rnd.votes.append(ValidatorVote(validator=index, vote=Vote.ABSTAIN))
                    continue
                if validator.behavior == Behavior.LAZY:
                    rnd.votes.append(
                        ValidatorVote(
                            validator=index, vote=Vote.AGREE, payload=leader_payload, reason="lazy"
                        )
                    )
                    continue
                if validator.behavior == Behavior.MALICIOUS:
                    payload = validator.malicious_payload
                    vote = Vote.AGREE if _equivalent(leader_payload, payload) else Vote.DISAGREE
                    rnd.votes.append(
                        ValidatorVote(
                            validator=index, vote=vote, payload=payload, reason="malicious"
                        )
                    )
                    continue

                vote_exec = self._execute(
                    dep,
                    method,
                    args,
                    sender_addr,
                    role="validator",
                    validator_index=index,
                )
                self._accumulate(total, vote_exec.counters)
                tampered_any = tampered_any or vote_exec.tampered
                if not vote_exec.ok:
                    rnd.votes.append(
                        ValidatorVote(
                            validator=index,
                            vote=Vote.DISAGREE,
                            error=vote_exec.error,
                            reason=vote_exec.error_kind or "error",
                        )
                    )
                    continue
                payload = self._payload(vote_exec)
                agree = _equivalent(leader_payload, payload)
                reason = None
                if (
                    validator.behavior == Behavior.FLAKY
                    and self.rng.random() < validator.flaky_p
                ):
                    agree = False
                    reason = "flaky"
                rnd.votes.append(
                    ValidatorVote(
                        validator=index,
                        vote=Vote.AGREE if agree else Vote.DISAGREE,
                        payload=payload,
                        reason=reason,
                    )
                )

            rnd.tally = self._tally(rnd.votes)
            majority_needed = self.config.majority * len(validator_set)
            if rnd.tally.agree > majority_needed:
                rnd.accepted = True
                accepted = True
                rounds.append(rnd)
                trace.status = "FINALIZED" if wait == "FINALIZED" else "ACCEPTED"
                dep.instance = leader_exec.instance
                break

            rounds.append(rnd)
            if round_no > self.config.max_appeals:
                trace.status = "UNDETERMINED"
                terminal_error = "validators did not converge"
                break
            validator_set = self._grow_validators(validator_set)
            round_no += 1

        if not accepted and trace.status in ("UNDETERMINED", "REVERTED"):
            dep.instance = initial_instance  # revert to the pre-transaction state

        trace.rounds = rounds
        trace.nondet_blocks = leader_nondet_blocks
        trace.llm_calls = total.llm_calls
        trace.web_calls = total.web_calls
        trace.storage_writes = total.storage_writes
        trace.validator_work_units = total.validator_work_units
        trace.tampered = tampered_any
        trace.error = terminal_error
        trace.return_value = leader_exec.return_value if accepted and leader_exec else None
        self.traces[tx_hash] = trace

        last = rounds[-1] if rounds else Round(number=1, leader=0, validator_set=validator_set)
        status = trace.status
        if status == "FINALIZED":
            pass
        votes = last.tally
        return TxResult(
            hash=tx_hash,
            status=status,
            round=last.number,
            appeals=last.number - 1,
            leader_index=last.leader,
            votes=votes,
            nondet_blocks=leader_nondet_blocks,
            llm_calls=total.llm_calls,
            web_calls=total.web_calls,
            return_value=trace.return_value,
            error=terminal_error,
            trace=trace,
            storage_writes=total.storage_writes,
            validator_work_units=total.validator_work_units,
            tampered=tampered_any,
        )

    # -- snapshots --------------------------------------------------------

    def snapshot(self) -> str:
        self.snapshot_counter += 1
        snap_id = f"snap-{self.snapshot_counter}"
        self.snapshots[snap_id] = {
            "deployments": copy.deepcopy(self.deployments),
            "validators": copy.deepcopy(self.validators),
            "time": self.time,
            "tx_counter": self.tx_counter,
            "mocks": copy.deepcopy(self.mocks),
            "forced_leader": self.forced_leader,
        }
        return snap_id

    def revert(self, snap_id: str) -> None:
        if snap_id not in self.snapshots:
            raise SimError(f"unknown snapshot: {snap_id}")
        snap = self.snapshots[snap_id]
        self.deployments = copy.deepcopy(snap["deployments"])
        self.validators = copy.deepcopy(snap["validators"])
        self.time = snap["time"]
        self.tx_counter = snap["tx_counter"]
        self.mocks = copy.deepcopy(snap["mocks"])
        self.forced_leader = snap["forced_leader"]

    # -- time -------------------------------------------------------------

    def warp(self, timestamp: int) -> None:
        self.time = int(timestamp)

    def warp_by(self, seconds: int) -> None:
        self.time += int(seconds)

    # -- validators & faults ---------------------------------------------

    def set_validators(self, n: int) -> None:
        if n < 1:
            raise SimError("validator count must be >= 1")
        self.config = SimConfig(
            validators=n,
            seed=self.config.seed,
            majority=self.config.majority,
            appeal_growth=self.config.appeal_growth,
            max_appeals=self.config.max_appeals,
            timeout_ms=self.config.timeout_ms,
        )
        while len(self.validators) < n:
            self.validators.append(Validator(index=len(self.validators)))

    def set_behavior(
        self,
        index: int,
        behavior: str,
        *,
        p: float = 0.0,
        payload: Any = None,
    ) -> None:
        self._validator(index).behavior = Behavior(behavior)
        self._validator(index).flaky_p = p
        self._validator(index).malicious_payload = payload

    def fail_validator(self, index: int, kind: str = "timeout") -> None:
        validator = self._validator(index)
        if kind in ("timeout", "offline", "crash"):
            validator.online = False
        elif kind == "lazy":
            validator.behavior = Behavior.LAZY
        elif kind == "abstain":
            validator.behavior = Behavior.ABSTAIN
        elif kind == "garbage":
            validator.behavior = Behavior.MALICIOUS
            validator.malicious_payload = {"garbage": True}
        elif kind == "flaky":
            validator.behavior = Behavior.FLAKY
            validator.flaky_p = 0.2
        else:
            raise SimError(f"unknown fault kind: {kind}")

    def set_leader(self, index: int) -> None:
        """Force the leader for the next transaction (deterministic tests)."""
        self._validator(index)
        self.forced_leader = index

    # -- traces -----------------------------------------------------------

    def trace(self, tx_hash: str) -> ConsensusTrace:
        if tx_hash not in self.traces:
            raise SimError(f"unknown transaction: {tx_hash}")
        return self.traces[tx_hash]

    # -- legacy simple API ------------------------------------------------

    def run_tx(
        self, leader_output: Any, validator_outputs: list[Any]
    ) -> dict[str, Any]:
        votes = Votes()
        for output in validator_outputs:
            if output is None:
                votes.timeout += 1
            elif _equivalent(leader_output, output):
                votes.agree += 1
            else:
                votes.disagree += 1
        total = len(validator_outputs)
        accepted = votes.agree > self.config.majority * total
        return {
            "status": "ACCEPTED" if accepted else "UNDETERMINED",
            "votes": votes.to_dict(),
            "round": 1,
        }

    def appeal(
        self, leader_output: Any, validator_outputs: list[Any]
    ) -> dict[str, Any]:
        result = self.run_tx(leader_output, validator_outputs)
        result["round"] = 2
        return result

    # -- internals --------------------------------------------------------

    def _deployment(self, address: str) -> Deployment:
        if address not in self.deployments:
            raise SimError(f"unknown contract address: {address}", code="E3002")
        return self.deployments[address]

    def _validator(self, index: int) -> Validator:
        if index < 0 or index >= len(self.validators):
            raise SimError(f"unknown validator index: {index}")
        return self.validators[index]

    def _elect_leader(self, validator_set: list[int], round_no: int) -> int:
        if self.forced_leader is not None and self.forced_leader in validator_set:
            # Forced leaders are one-shot test hooks: round 1 uses the forced
            # validator (even if offline, to model a leader timeout), then a
            # real leader is elected for any appeal round.
            forced = self.forced_leader
            self.forced_leader = None
            return forced
        online = [i for i in validator_set if self.validators[i].online]
        pool = online or validator_set
        # Deterministic across processes: hash with sha256, not Python hash().
        digest = hashlib.sha256(
            f"{self.config.seed}:{round_no}:{','.join(map(str, pool))}".encode()
        ).digest()
        return pool[int.from_bytes(digest[:8], "big") % len(pool)]

    def _grow_validators(self, validator_set: list[int]) -> list[int]:
        target = len(validator_set) * self.config.appeal_growth + 1
        while len(self.validators) < target:
            self.validators.append(Validator(index=len(self.validators)))
        return list(range(target))

    def _execute(
        self,
        dep: Deployment,
        method: str,
        args: list[Any],
        sender: Address,
        *,
        role: str,
        validator_index: int | None,
    ) -> Execution:
        instance = copy.deepcopy(dep.instance)
        tokens, ctx = execution_context(
            role=role,
            validator_index=validator_index,
            sender=sender,
            timestamp=self.time,
            mocks=self.mocks,
            timeout_ms=self.config.timeout_ms,
        )
        try:
            fn = getattr(instance, method)
            value = fn(*args)
            return Execution(
                ok=True,
                payload=ctx.eq_payload,
                return_value=value,
                counters=ctx.counters,
                instance=instance,
                tampered=ctx.tampered,
            )
        except ContractUserError as exc:
            return Execution(
                ok=False,
                error=str(exc),
                error_kind="revert",
                counters=ctx.counters,
                instance=instance,
            )
        except TimeoutError as exc:
            return Execution(
                ok=False,
                error=str(exc),
                error_kind="timeout",
                counters=ctx.counters,
                instance=instance,
            )
        except SimError as exc:
            return Execution(
                ok=False,
                error=exc.message,
                error_kind="crash",
                counters=ctx.counters,
                instance=instance,
            )
        except Exception as exc:  # noqa: BLE001 - the simulator must not crash a test
            return Execution(
                ok=False,
                error=f"{type(exc).__name__}: {exc}",
                error_kind="crash",
                counters=ctx.counters,
                instance=instance,
            )
        finally:
            restore_context(tokens)

    @staticmethod
    def _payload(execution: Execution) -> Any:
        if execution.payload is not None:
            return execution.payload
        return execution.return_value

    @staticmethod
    def _accumulate(total: CostCounters, counters: CostCounters) -> None:
        total.nondet_blocks += counters.nondet_blocks
        total.llm_calls += counters.llm_calls
        total.web_calls += counters.web_calls
        total.storage_writes += counters.storage_writes

    @staticmethod
    def _tally(votes: list[ValidatorVote]) -> Votes:
        tally = Votes()
        for vote in votes:
            if vote.vote == Vote.AGREE:
                tally.agree += 1
            elif vote.vote == Vote.DISAGREE:
                tally.disagree += 1
            elif vote.vote == Vote.TIMEOUT:
                tally.timeout += 1
            else:
                tally.abstain += 1
        return tally


def canonical(value: Any) -> str:
    """Canonical JSON used by the equivalence check."""
    return _canonical(value)
