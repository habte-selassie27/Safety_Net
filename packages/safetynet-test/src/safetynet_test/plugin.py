"""pytest plugin and fixtures for SafetyNet adjudication tests.

Install ``safetynet-test`` (or add ``packages/safetynet-test/src`` to
``PYTHONPATH``) and the fixtures below are available automatically.
"""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from safetynet_sim import SimConfig, Simulator

from .cheatcodes import Cheatcodes
from .context import DEFAULT_ACCOUNTS, TestContext
from .contracts import ContractProxy, deploy_contract
from .evidence import Evidence
from .policies import PolicyBuilder

VERDICT_OUTCOMES = (
    "POLICY_VIOLATION",
    "POLICY_ADEQUATE_BUT_HARM",
    "INSUFFICIENT_EVIDENCE",
    "OUT_OF_SCOPE",
    "DISMISSED",
)


def _transaction_verdict(tx: Any) -> str | None:
    """Extract a committed verdict from a recorded simulator transaction."""
    trace = getattr(tx, "trace", None)
    if (
        trace is None
        or getattr(trace, "method", None) != "adjudicate"
        or tx.status not in ("ACCEPTED", "FINALIZED")
    ):
        return None
    payload = getattr(tx, "return_value", None)
    if isinstance(payload, dict):
        verdict = payload.get("verdict")
        return verdict if verdict in VERDICT_OUTCOMES else None
    if isinstance(payload, str) and payload in VERDICT_OUTCOMES:
        return payload
    return None


def pytest_addoption(parser: pytest.Parser) -> None:
    group = parser.getgroup("safetynet")
    group.addoption("--snet-mode", default="sim", choices=["sim", "direct", "network"])
    group.addoption("--snet-network", default="studionet")
    group.addoption("--snet-seed", type=int, default=1337)
    group.addoption("--snet-validators", type=int, default=5)
    group.addoption("--snet-llm", default="mock")
    group.addoption("--snet-web", default="mock")


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line(
        "markers",
        "sim_only: requires simulator-only features such as forced votes",
    )
    config.addinivalue_line(
        "markers",
        "network: requires a real network; skipped in sim mode",
    )


def pytest_collection_modifyitems(
    config: pytest.Config,
    items: list[pytest.Item],
) -> None:
    mode = config.getoption("snet_mode")
    skip_sim = pytest.mark.skip(reason="requires sim mode")
    skip_network = pytest.mark.skip(reason="requires network mode")
    for item in items:
        if mode != "sim" and item.get_closest_marker("sim_only"):
            item.add_marker(skip_sim)
        if mode != "network" and item.get_closest_marker("network"):
            item.add_marker(skip_network)


def collect_verdict_coverage(items: list[pytest.Item]) -> dict[str, int]:
    """Count committed verdicts recorded by the selected test items.

    Example::

        coverage = collect_verdict_coverage(pytest_items)
        assert coverage["POLICY_VIOLATION"] == 1
    """
    coverage = {verdict: 0 for verdict in VERDICT_OUTCOMES}
    for item in items:
        context = getattr(item, "funcargs", {}).get("context")
        for tx in getattr(context, "transactions", []):
            verdict = _transaction_verdict(tx)
            if verdict is not None:
                coverage[verdict] += 1
    return coverage


def pytest_runtest_teardown(item: pytest.Item) -> None:
    """Capture verdict coverage before pytest releases the test fixtures."""
    context = getattr(item, "funcargs", {}).get("context")
    transactions = getattr(context, "transactions", [])
    coverage = getattr(item.config, "_safetynet_verdict_coverage", None)
    if coverage is None:
        coverage = {verdict: 0 for verdict in VERDICT_OUTCOMES}
        setattr(item.config, "_safetynet_verdict_coverage", coverage)
    for tx in transactions:
        verdict = _transaction_verdict(tx)
        if verdict is not None:
            coverage[verdict] += 1


def pytest_terminal_summary(
    terminalreporter: Any,
    exitstatus: int,
    config: pytest.Config,
) -> None:
    """Report canonical verdict coverage from accepted simulator adjudications."""
    if config.getoption("snet_mode") != "sim":
        return
    coverage = getattr(
        config,
        "_safetynet_verdict_coverage",
        {verdict: 0 for verdict in VERDICT_OUTCOMES},
    )
    if not any(coverage.values()):
        return
    terminalreporter.write_sep("=", "SafetyNet verdict coverage")

    for verdict in VERDICT_OUTCOMES:
        count = coverage[verdict]
        label = "covered" if count else "NOT covered"
        terminalreporter.write_line(f"  {verdict:<30} {count:>3} adjudications — {label}")
    missing = [verdict for verdict in VERDICT_OUTCOMES if coverage[verdict] == 0]
    if missing:
        terminalreporter.write_line(
            "  Add simulator integration coverage for: " + ", ".join(missing)
        )


def pytest_exception_interact(
    node: pytest.Item,
    call: pytest.CallInfo[Any],
    report: pytest.TestReport,
) -> None:
    """Print the last consensus trace after a failed test call."""
    if report.when != "call" or not report.failed:
        return
    context = getattr(node, "funcargs", {}).get("context")
    tx = getattr(context, "last_tx", None)
    trace = getattr(tx, "trace", None)
    if trace is None:
        return
    print("\nConsensus trace")
    try:
        print(trace.pretty())
    except Exception:  # noqa: BLE001  # pragma: no cover - defensive trace formatting
        print("  trace unavailable")


@pytest.fixture(scope="session")
def mode(pytestconfig: pytest.Config) -> str:
    return str(pytestconfig.getoption("snet_mode"))


@pytest.fixture(scope="session")
def seed(pytestconfig: pytest.Config) -> int:
    return int(pytestconfig.getoption("snet_seed"))


@pytest.fixture(scope="session")
def validator_count(pytestconfig: pytest.Config) -> int:
    return int(pytestconfig.getoption("snet_validators"))


@pytest.fixture
def sim(seed: int, validator_count: int) -> Simulator:
    """A fresh deterministic simulator for each test."""
    return Simulator(SimConfig(seed=seed, validators=validator_count))


@pytest.fixture
def context(sim: Simulator, mode: str, seed: int, validator_count: int) -> TestContext:
    return TestContext(
        sim=sim,
        mode=mode,
        seed=seed,
        validators=validator_count,
    )


@pytest.fixture
def accounts() -> list[str]:
    return list(DEFAULT_ACCOUNTS)


@pytest.fixture
def deployer() -> str:
    return DEFAULT_ACCOUNTS[0]


@pytest.fixture
def deploy(
    sim: Simulator,
    context: TestContext,
) -> Callable[..., ContractProxy]:
    """Deploy ``contracts/safetynet.py`` (or an explicit source path)."""

    def _deploy(
        name: str = "SafetyNet",
        *,
        args: Any = None,
        source_path: str | Path | None = None,
        sender: str | None = None,
    ) -> ContractProxy:
        return deploy_contract(
            sim,
            context,
            name=name,
            args=args,
            source_path=source_path,
            sender=sender,
        )

    return _deploy


@pytest.fixture
def policy() -> PolicyBuilder:
    return PolicyBuilder()


@pytest.fixture
def evidence() -> Evidence:
    return Evidence()


@pytest.fixture
def mock_llm(sim: Simulator) -> Any:
    return sim.mock_llm


@pytest.fixture
def mock_web(sim: Simulator) -> Any:
    return sim.mock_web


@pytest.fixture
def gf(context: TestContext, sim: Simulator) -> Cheatcodes:
    return Cheatcodes(context, sim)


@pytest.fixture
def trace(context: TestContext) -> Any:
    return context.last_trace
