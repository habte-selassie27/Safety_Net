"""A faithful-enough `genlayer` / `gl` shim for in-process simulation.

Design rules from AGENTS.md §17.6:

1. Check the shim against the ground-truth snapshot.
2. If a contract uses an API the shim lacks, fail loudly with E3001 and
   suggest `--mode direct` or `--mode network`.
3. Never silently no-op.
4. Storage types come from ``safetynet_sim.storage`` with tested semantics.

The shim is execution-context aware through a ``ContextVar``: the engine runs
the leader and each validator with its own context, so mocks can target roles
and costs are attributed correctly.
"""

from __future__ import annotations

import json
import types
from collections.abc import Callable
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any

from .errors import ContractRevert, SimUnsupportedFeature
from .mocks import MockProviderError, MockRegistry
from .storage import (
    Address,
    DynArray,
    TreeMap,
    default_for_annotation,
    i256,
    reset_write_hook,
    set_write_hook,
    u256,
)


@dataclass
class CostCounters:
    nondet_blocks: int = 0
    llm_calls: int = 0
    web_calls: int = 0
    storage_writes: int = 0
    rounds: int = 0

    @property
    def validator_work_units(self) -> int:
        return self.llm_calls * 10 + self.web_calls * 5 + self.storage_writes

    def to_dict(self) -> dict[str, Any]:
        return {
            "nondet_blocks": self.nondet_blocks,
            "llm_calls": self.llm_calls,
            "web_calls": self.web_calls,
            "storage_writes": self.storage_writes,
            "validator_work_units": self.validator_work_units,
        }


@dataclass
class ExecContext:
    role: str = "leader"                  # "leader" | "validator" | "view"
    validator_index: int | None = None
    sender: Address = field(default_factory=lambda: Address("0x" + "11" * 20))
    timestamp: int = 1_762_000_000
    mocks: MockRegistry = field(default_factory=MockRegistry)
    counters: CostCounters = field(default_factory=CostCounters)
    eq_payload: Any = None
    tampered: bool = False
    timeout_ms: int = 30_000

    def note_write(self) -> None:
        self.counters.storage_writes += 1


_CTX: ContextVar[ExecContext | None] = ContextVar("safetynet_sim_ctx", default=None)


def current_context() -> ExecContext:
    ctx = _CTX.get()
    if ctx is None:
        raise RuntimeError("no simulator execution context; call inside Simulator")
    return ctx


class _UserError(Exception):
    """Mirror of gl.vm.UserError."""


class _Proxied:
    """Base for shim sub-namespaces: unknown attributes fail loudly."""

    def __init__(self, name: str) -> None:
        self._name = name

    def __getattr__(self, item: str) -> Any:
        raise SimUnsupportedFeature(f"gl.{self._name}.{item}")


# ---------------------------------------------------------------------------
# gl.eq_principle
# ---------------------------------------------------------------------------

class _EqPrinciple(_Proxied):
    def __init__(self) -> None:
        super().__init__("eq_principle")

    def _record(self, fn: Callable[[], Any]) -> Any:
        ctx = current_context()
        ctx.counters.nondet_blocks += 1
        result = fn()
        ctx.eq_payload = result
        return result

    def strict_eq(self, fn: Callable[[], Any]) -> Any:
        return self._record(fn)

    def prompt_comparative(self, fn: Callable[[], Any], principle: Any = None) -> Any:
        # The simulator cannot model an LLM judge; record the payload and let
        # the engine's strict comparison apply. Documented limitation.
        return self._record(fn)

    def prompt_non_comparative(
        self,
        fn: Callable[[], Any],
        task: Any = None,
        criteria: Any = None,
    ) -> Any:
        return self._record(fn)


# ---------------------------------------------------------------------------
# gl.nondet
# ---------------------------------------------------------------------------

class _Web(_Proxied):
    def __init__(self) -> None:
        super().__init__("nondet.web")

    def render(self, url: str, mode: str = "text", **kwargs: Any) -> str:
        ctx = current_context()
        ctx.counters.web_calls += 1
        try:
            response = ctx.mocks.web.resolve(
                url, role=ctx.role, validator_index=ctx.validator_index
            )
        except MockProviderError as exc:
            raise TimeoutError(f"web provider error: {exc.kind}") from exc
        if isinstance(response, dict) and response.get("__delay__"):
            delay = float(response["__delay__"])
            if delay * 1000 > ctx.timeout_ms:
                raise TimeoutError(f"web fetch exceeded {ctx.timeout_ms}ms")
            return ""
        text = _text_of(response, mode)
        if isinstance(response, dict):
            expected = response.get("sha256")
            if expected:
                import hashlib

                actual = "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()
                if actual != expected:
                    ctx.tampered = True
        return text

    def request(self, url: str, **kwargs: Any) -> Any:
        raise SimUnsupportedFeature("gl.nondet.web.request")


class _Nondet(_Proxied):
    def __init__(self) -> None:
        super().__init__("nondet")
        self.web = _Web()

    def exec_prompt(self, prompt: str, **kwargs: Any) -> Any:
        ctx = current_context()
        ctx.counters.llm_calls += 1
        try:
            response = ctx.mocks.llm.resolve(
                prompt, role=ctx.role, validator_index=ctx.validator_index
            )
        except MockProviderError as exc:
            raise TimeoutError(f"llm provider error: {exc.kind}") from exc
        if isinstance(response, (dict, list)):
            return json.dumps(response)
        return response


# ---------------------------------------------------------------------------
# gl.message / gl.block / gl.vm
# ---------------------------------------------------------------------------

class _Message:
    @property
    def sender_address(self) -> Address:
        return current_context().sender

    @property
    def value(self) -> int:
        return 0


class _Block:
    @property
    def timestamp(self) -> int:
        return current_context().timestamp


class _VM(_Proxied):
    def __init__(self) -> None:
        super().__init__("vm")
        self.UserError = _UserError


# ---------------------------------------------------------------------------
# public decorators
# ---------------------------------------------------------------------------

def _mark(kind: str) -> Callable[[Any], Any]:
    def decorator(fn: Any) -> Any:
        fn.__gl_public__ = kind
        return fn

    return decorator


class _PublicView:
    def __call__(self, fn: Any) -> Any:
        return _mark("view")(fn)


class _PublicWrite:
    def __call__(self, fn: Any) -> Any:
        return _mark("write")(fn)


class _Public:
    view = _PublicView()
    write = _PublicWrite()


class _GLNamespace:
    """The `gl` object imported by contracts."""

    Contract: Any
    eq_principle = _EqPrinciple()
    nondet = _Nondet()
    message = _Message()
    block = _Block()
    vm = _VM()
    public = _Public()

    def __getattr__(self, item: str) -> Any:
        raise SimUnsupportedFeature(f"gl.{item}")


# ---------------------------------------------------------------------------
# Contract base
# ---------------------------------------------------------------------------

class Contract:
    """Base class for simulated contracts.

    Wraps ``__init__`` so typed storage fields declared as class annotations
    are auto-initialized, mirroring GenLayer's persistent storage behavior.
    """

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        original = cls.__dict__.get("__init__")

        def wrapped(self: Any, *args: Any, **kw: Any) -> None:
            if original is not None:
                original(self, *args, **kw)
            annotations: dict[str, Any] = {}
            for base in reversed(cls.__mro__):
                annotations.update(getattr(base, "__annotations__", {}))
            for name, annotation in annotations.items():
                if name not in self.__dict__:
                    setattr(self, name, default_for_annotation(annotation))

        cls.__init__ = wrapped  # type: ignore[method-assign]

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<{type(self).__name__} (sim)>"


# Expose gl.Contract (contracts may use either `gl.Contract` or the import).
_GLNamespace.Contract = Contract


# ---------------------------------------------------------------------------
# Module loading
# ---------------------------------------------------------------------------

def allow_storage(cls: Any) -> Any:
    """No-op stand-in for GenLayer's storage-struct decorator."""
    return cls


def _text_of(response: Any, mode: str) -> str:
    if response is None:
        raise TimeoutError("web fetch returned no content")
    if isinstance(response, str):
        return response
    if isinstance(response, dict):
        if mode == "html" and "html" in response:
            return str(response["html"])
        if "text" in response:
            return str(response["text"])
        if "body" in response:
            return str(response["body"])
    return str(response)


def make_genlayer_module() -> types.ModuleType:
    """Build a fake ``genlayer`` module exposing the shim subset."""
    module = types.ModuleType("genlayer")
    exports = {
        "gl": _GLNamespace(),
        "Contract": Contract,
        "TreeMap": TreeMap,
        "DynArray": DynArray,
        "Address": Address,
        "u256": u256,
        "i256": i256,
        "allow_storage": allow_storage,
    }
    for name, value in exports.items():
        setattr(module, name, value)
    module.__all__ = list(exports)  # type: ignore[attr-defined]
    return module


def load_contract_class(source: str, filename: str = "<contract>") -> type[Contract]:
    """Execute contract source under the shim and return its Contract subclass."""
    import sys

    fake = make_genlayer_module()
    previous = sys.modules.get("genlayer")
    module_name = "safetynet_sim_contract"
    module = types.ModuleType(module_name)
    module.__file__ = filename
    sys.modules["genlayer"] = fake
    sys.modules[module_name] = module
    try:
        code = compile(source, filename, "exec", dont_inherit=True)
        exec(code, module.__dict__)  # noqa: S102 - executing the user's contract is the point
    finally:
        if previous is not None:
            sys.modules["genlayer"] = previous
        else:
            sys.modules.pop("genlayer", None)

    namespace = module.__dict__
    candidates = [
        obj
        for obj in namespace.values()
        if isinstance(obj, type) and issubclass(obj, Contract) and obj is not Contract
    ]
    if not candidates:
        raise ContractRevert("no gl.Contract subclass found in source")
    if len(candidates) > 1:
        raise ContractRevert("multiple gl.Contract subclasses found")
    cls = candidates[0]
    # Keep the module alive so dataclasses can resolve their module namespace.
    cls.__sim_module__ = module  # type: ignore[attr-defined]
    return cls


def execution_context(
    *,
    role: str,
    validator_index: int | None,
    sender: Address,
    timestamp: int,
    mocks: MockRegistry,
    timeout_ms: int,
) -> tuple[tuple[Any, Any], ExecContext]:
    """Install an execution context; returns (tokens, context)."""
    ctx = ExecContext(
        role=role,
        validator_index=validator_index,
        sender=sender,
        timestamp=timestamp,
        mocks=mocks,
        timeout_ms=timeout_ms,
    )
    ctx_token = _CTX.set(ctx)
    hook_token = set_write_hook(ctx.note_write)
    return (ctx_token, hook_token), ctx


def restore_context(tokens: Any) -> None:
    ctx_token, hook_token = tokens
    reset_write_hook(hook_token)
    _CTX.reset(ctx_token)


# Public alias used by the engine to distinguish contract reverts from crashes.
ContractUserError = _UserError
