"""Cheatcodes exposed as the ``gf`` fixture."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from safetynet_sim import (
    Behavior,
    ContractRevert,
    Simulator,
    TxResult,
)

from .context import DEFAULT_ACCOUNTS, TestContext
from .contracts import DEFAULT_DOMAIN_CONFIG


class Cheatcodes:
    """Test context, deterministic time, pranks, traces, and assertions."""

    def __init__(self, context: TestContext, sim: Simulator) -> None:
        self.context = context
        self.sim = sim

    @property
    def accounts(self) -> list[str]:
        return list(DEFAULT_ACCOUNTS)

    @property
    def default_domain_config(self) -> list[Any]:
        return list(DEFAULT_DOMAIN_CONFIG)

    @property
    def validator_count(self) -> int:
        return len(self.sim.validators)

    @property
    def seed_value(self) -> int:
        return self.context.seed

    @property
    def mode(self) -> str:
        return self.context.mode

    @property
    def last_tx(self) -> TxResult | None:
        return self.context.last_tx

    def seed(self, value: int) -> None:
        self.context.seed = value
        self.sim.rng.seed(value)

    def prank(self, address: str) -> Any:
        """Context manager: use ``address`` as the sender for calls in the block."""
        return self._prank(address)

    @contextmanager
    def _prank(self, address: str) -> Iterator[None]:
        previous = self.context.sender
        self.context.sender = address
        try:
            yield
        finally:
            self.context.sender = previous

    def start_prank(self, address: str) -> None:
        self.context.prank_stack.append(self.context.sender)
        self.context.sender = address

    def stop_prank(self) -> None:
        if self.context.prank_stack:
            self.context.sender = self.context.prank_stack.pop()

    def warp(self, timestamp: int) -> None:
        self.sim.warp(timestamp)

    def warp_by(self, seconds: int) -> None:
        self.sim.warp_by(seconds)

    def snapshot(self) -> str:
        return self.sim.snapshot()

    def revert(self, snapshot_id: str) -> None:
        self.sim.revert(snapshot_id)

    def set_validators(self, count: int) -> None:
        self.sim.set_validators(count)

    def set_leader(self, index: int) -> None:
        self.sim.set_leader(index)

    def fail_validator(self, index: int, kind: str = "timeout") -> None:
        self.sim.fail_validator(index, kind)

    def set_behavior(
        self,
        index: int,
        behavior: str | Behavior,
        *,
        payload: Any = None,
        p: float = 0.0,
    ) -> None:
        self.sim.set_behavior(
            index,
            Behavior(behavior),
            payload=payload,
            p=p,
        )

    @contextmanager
    def expect_revert(self, code: str | None = None) -> Iterator[None]:
        try:
            yield
        except ContractRevert as error:
            if code and code not in str(error):
                raise AssertionError(
                    f"expected revert containing {code!r}, got {error!s}"
                ) from error
        else:
            raise AssertionError("expected a revert, but the call succeeded")

    @contextmanager
    def expect_status(self, status: str) -> Iterator[None]:
        yield
        tx = self.context.last_tx
        if tx is None:
            raise AssertionError(f"expected status {status}, but no call was made")
        if tx.status != status:
            raise AssertionError(f"expected status {status}, got {tx.status}")

    @contextmanager
    def expect_nondet(self, max_blocks: int) -> Iterator[None]:
        yield
        tx = self.context.last_tx
        if tx is None:
            raise AssertionError("expected a call, but none was made")
        if tx.nondet_blocks > max_blocks:
            raise AssertionError(
                f"expected at most {max_blocks} nondet blocks, got {tx.nondet_blocks}"
            )

    def print_trace(self, tx: TxResult | None = None) -> None:
        selected = tx or self.context.last_tx
        if selected is None or selected.trace is None:
            print("  no consensus trace recorded")
            return
        print(selected.trace.pretty())
