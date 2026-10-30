"""Per-test state shared by fixtures, proxies, and cheatcodes."""

from __future__ import annotations

from dataclasses import dataclass, field

from safetynet_sim import ConsensusTrace, Simulator, TxResult

DEFAULT_ACCOUNTS: list[str] = [f"0x{i:040x}" for i in range(1, 11)]
DEFAULT_DEPLOYER = DEFAULT_ACCOUNTS[0]


@dataclass
class TestContext:
    sim: Simulator
    mode: str = "sim"
    seed: int = 1337
    validators: int = 5
    sender: str = DEFAULT_DEPLOYER
    last_tx: TxResult | None = None
    last_trace: ConsensusTrace | None = None
    transactions: list[TxResult] = field(default_factory=list)
    prank_stack: list[str] = field(default_factory=list)

    def record(self, tx: TxResult) -> None:
        self.last_tx = tx
        self.last_trace = tx.trace
        self.transactions.append(tx)
