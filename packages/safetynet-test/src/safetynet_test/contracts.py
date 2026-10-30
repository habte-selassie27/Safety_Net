"""Contract deployment and typed read/write proxies over the simulator."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Self

from safetynet_sim import ContractRevert, Simulator, TxResult

from .context import TestContext

DEFAULT_DOMAIN_CONFIG: list[Any] = [
    8,  # max evidence items
    20_000,  # max evidence bytes
    24,  # max policy clauses
    72,  # appeal window hours
    1,  # max appeals
    48,  # min provider response hours
    "example.com,raw.githubusercontent.com",
]

_CONFIG_KEYS = [
    "max_evidence_items",
    "max_evidence_bytes",
    "max_policy_clauses",
    "appeal_window_hours",
    "max_appeals",
    "min_provider_response_hours",
    "evidence_allowlist",
]


def domain_config_args(config: Any = None) -> list[Any]:
    """Normalize a list or dict domain config into constructor arguments."""
    if config is None:
        return list(DEFAULT_DOMAIN_CONFIG)
    if isinstance(config, (list, tuple)):
        return list(config)
    if isinstance(config, dict):
        args: list[Any] = []
        for key in _CONFIG_KEYS:
            parts = key.split("_")
            camel = parts[0] + "".join(part.title() for part in parts[1:])
            args.append(config.get(key, config.get(camel)))
        return args
    raise TypeError("domain config must be a list, tuple, or dict")


class WriteResult(str):
    """A string return value that also exposes the full ``TxResult``.

    This keeps both common test styles working:

        inc_id = sn.write.file_incident(...)       # usable as a string
        tx = sn.write.adjudicate(inc_id)           # tx.status, tx.votes, ...
    """

    tx: TxResult

    def __new__(cls, tx: TxResult) -> Self:
        value = tx.return_value
        if isinstance(value, str):
            text = value
        elif value is None:
            text = ""
        else:
            text = json.dumps(value, sort_keys=True, separators=(",", ":"))
        obj = str.__new__(cls, text)
        obj.tx = tx
        return obj

    def __getattr__(self, name: str) -> Any:
        return getattr(self.tx, name)

    @property
    def value(self) -> Any:
        return self.tx.return_value


def _plain(value: Any) -> Any:
    """Strip ``WriteResult`` wrappers so contract state only holds plain values.

    ``WriteResult`` subclasses ``str`` but carries the full ``TxResult``.
    Passing one into a write stores a wrapper in contract storage, and the
    simulator's state deepcopy then fails on the next transaction.
    """
    if isinstance(value, WriteResult):
        return str(value)
    if isinstance(value, (list, tuple)):
        return [_plain(item) for item in value]
    if isinstance(value, dict):
        return {key: _plain(item) for key, item in value.items()}
    return value


def _decode(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    text = value.strip()
    if not text:
        return None
    if text[0] in "{[":
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return value
    return value


class ReadProxy:
    def __init__(self, sim: Simulator, address: str, context: TestContext) -> None:
        self._sim = sim
        self._address = address
        self._context = context

    def __getattr__(self, method: str) -> Any:
        def call(*args: Any, sender: str | None = None) -> Any:
            raw = self._sim.read(
                self._address,
                method,
                [_plain(arg) for arg in args],
                sender=sender or self._context.sender,
            )
            return _decode(raw)

        return call


class WriteProxy:
    def __init__(self, sim: Simulator, address: str, context: TestContext) -> None:
        self._sim = sim
        self._address = address
        self._context = context

    def __getattr__(self, method: str) -> Any:
        def call(
            *args: Any,
            sender: str | None = None,
            wait: str = "ACCEPTED",
        ) -> WriteResult:
            tx = self._sim.write(
                self._address,
                method,
                [_plain(arg) for arg in args],
                sender=sender or self._context.sender,
                wait=wait,
            )
            self._context.record(tx)
            if tx.status == "REVERTED":
                raise ContractRevert(tx.error or "transaction reverted")
            return WriteResult(tx)

        return call


class ContractProxy:
    """A deployed contract with ``read`` and ``write`` namespaces."""

    def __init__(self, sim: Simulator, address: str, context: TestContext) -> None:
        self.address = address
        self.read = ReadProxy(sim, address, context)
        self.write = WriteProxy(sim, address, context)
        self._sim = sim
        self._context = context

    @property
    def instance(self) -> Any:
        return self._sim.deployments[self.address].instance

    @property
    def last_tx(self) -> TxResult | None:
        return self._context.last_tx


def project_root() -> Path:
    """Find the repository root containing ``contracts/safetynet.py``."""
    candidates = [Path.cwd(), *Path(__file__).resolve().parents]
    for candidate in candidates:
        if (candidate / "contracts" / "safetynet.py").is_file():
            return candidate
    return Path.cwd()


def contract_path(name: str = "SafetyNet") -> Path:
    root = project_root()
    candidates = [
        root / "contracts" / f"{name.lower()}.py",
        root / "contracts" / f"{name}.py",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(
        f"contract {name!r} not found under {root / 'contracts'}; pass source_path"
    )


def deploy_contract(
    sim: Simulator,
    context: TestContext,
    *,
    name: str = "SafetyNet",
    args: Any = None,
    source_path: str | Path | None = None,
    sender: str | None = None,
) -> ContractProxy:
    path = Path(source_path) if source_path is not None else contract_path(name)
    address = sim.deploy(
        source_path=str(path),
        args=domain_config_args(args),
        sender=sender or context.sender,
    )
    return ContractProxy(sim, address, context)
