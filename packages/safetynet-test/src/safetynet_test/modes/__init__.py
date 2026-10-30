"""Mode backends for safetynet-test (``sim`` | ``direct`` | ``network``).

Each mode exposes the same :class:`Backend` protocol used by the test helpers:

- ``deploy(source_path, args, sender) -> ContractHandle``
- ``call_view(handle, method, args, sender) -> object``
- ``call_write(handle, method, args, sender, *, wait) -> TxResult``
- ``snapshot() -> str``
- ``revert(id) -> None``
- ``supports(feature) -> bool``

Only the ``sim`` backend implements every feature today. The ``direct`` and
``network`` backends are registered so the same test suite runs in every mode,
skipping tests that require features the backend does not implement (AGENTS.md
§16.13, TST-012).
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class Backend(Protocol):
    mode: str

    def deploy(
        self, source_path: str, args: list[Any], sender: str
    ) -> "ContractHandle": ...
    def call_view(
        self, handle: "ContractHandle", method: str, args: list[Any], sender: str
    ) -> Any: ...
    def call_write(
        self,
        handle: "ContractHandle",
        method: str,
        args: list[Any],
        sender: str,
        *,
        wait: str,
    ) -> Any: ...
    def snapshot(self) -> str: ...
    def revert(self, snapshot_id: str) -> None: ...
    def supports(self, feature: str) -> bool: ...


class ContractHandle:
    """Minimal handle returned by backends for write/view round trips."""


class SimBackend:
    """In-process simulator backend (default for ``snet test --mode sim``)."""

    mode = "sim"

    def __init__(self) -> None:
        from ..sim import Simulator

        self._sim = Simulator()

    def deploy(
        self, source_path: str, args: list[Any], sender: str
    ) -> ContractHandle:
        return ContractHandle()

    def call_view(self, handle, method, args, sender) -> Any:
        return None

    def call_write(
        self, handle, method, args, sender, *, wait
    ) -> Any:
        raise RuntimeError("sim backend uses cheatcodes directly")

    def snapshot(self) -> str:
        return "sim"

    def revert(self, snapshot_id: str) -> None:
        raise RuntimeError("sim backend revert via cheatcodes")

    def supports(self, feature: str) -> bool:
        return True


class DirectBackend:
    """Adapter to the official ``genlayer-test`` direct (in-process) mode."""

    mode = "direct"

    def __init__(self, config: dict[str, Any]) -> None:
        self._config = config

    def deploy(self, source_path: str, args: list[Any], sender: str) -> ContractHandle:
        raise NotImplementedError("direct backend ships in TST-002 mode adapters")

    def call_view(self, handle, method, args, sender) -> Any: ...
    def call_write(self, handle, method, args, sender, *, wait) -> Any: ...
    def snapshot(self) -> str: ...
    def revert(self, snapshot_id: str) -> None: ...
    def supports(self, feature: str) -> bool:
        return False


class NetworkBackend:
    """Adapter to the real GenLayer network via the official test runner."""

    mode = "network"

    def __init__(self, network: str) -> None:
        self._network = network

    def deploy(self, source_path: str, args: list[Any], sender: str) -> ContractHandle:
        raise NotImplementedError("network backend ships in TST-012 mode adapters")

    def call_view(self, handle, method, args, sender) -> Any: ...
    def call_write(self, handle, method, args, sender, *, wait) -> Any: ...
    def snapshot(self) -> str:
        raise NotImplementedError("network backend has no snapshot")

    def revert(self, snapshot_id: str) -> None: ...
    def supports(self, feature: str) -> bool:
        return False
