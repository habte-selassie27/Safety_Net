"""Minimal persistent-storage types with GenLayer-compatible semantics.

AGENTS.md §17.6: the simulator re-implements the subset of storage types the
reference contract uses, with identical semantics. Anything outside the
documented subset is refused loudly rather than approximated.

Supported subset (see docs/reference/sim-coverage.md):

- ``TreeMap[K, V]``: mapping with ``get``, ``in``, ``len``, iteration, items
- ``DynArray[T]``: ordered sequence; accepts a plain list on assignment
- ``u256`` / ``i256``: bounded integers
- ``Address``: 160-bit address, ``str()`` renders ``0x``-prefixed hex
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from contextvars import ContextVar
from typing import Any, Generic, Self, TypeVar

K = TypeVar("K")
V = TypeVar("V")
T = TypeVar("T")

UINT256_MAX = (1 << 256) - 1
INT256_MIN = -(1 << 255)
INT256_MAX = (1 << 255) - 1

_WRITE_HOOK: ContextVar[Callable[[], None] | None] = ContextVar(
    "safetynet_sim_write_hook", default=None
)


def set_write_hook(fn: Callable[[], None]) -> Any:
    """Install a storage-write observer for the current execution context."""
    return _WRITE_HOOK.set(fn)


def reset_write_hook(token: Any) -> None:
    _WRITE_HOOK.reset(token)


def _note_write() -> None:
    hook = _WRITE_HOOK.get()
    if hook is not None:
        hook()


class TreeMap(dict[K, V], Generic[K, V]):
    """A mapping with the GenLayer persistent-storage surface.

    We subclass ``dict`` so the simulator's deep-copy snapshot semantics are
    exactly Python's, while exposing the same methods a contract uses.
    """

    def __setitem__(self, key: K, value: V) -> None:
        super().__setitem__(key, value)
        _note_write()

    def __delitem__(self, key: K) -> None:
        super().__delitem__(key)
        _note_write()

    def get(self, key: K, default: Any = None) -> Any:
        return super().get(key, default)


class DynArray(list[T], Generic[T]):
    """A list with the GenLayer persistent-storage surface."""

    def append(self, value: T) -> None:
        super().append(value)
        _note_write()

    def __setitem__(self, index: Any, value: Any) -> None:
        super().__setitem__(index, value)
        _note_write()


class u256(int):
    """Unsigned 256-bit integer, validated on construction."""

    def __new__(cls, value: int | str = 0) -> Self:
        if isinstance(value, bool):
            value = int(value)
        if not isinstance(value, int):
            value = int(value)
        if value < 0 or value > UINT256_MAX:
            raise SimStorageError(f"u256 out of range: {value}")
        return super().__new__(cls, value)


class i256(int):
    """Signed 256-bit integer, validated on construction."""

    def __new__(cls, value: int | str = 0) -> Self:
        if isinstance(value, bool):
            value = int(value)
        if not isinstance(value, int):
            value = int(value)
        if value < INT256_MIN or value > INT256_MAX:
            raise SimStorageError(f"i256 out of range: {value}")
        return super().__new__(cls, value)


class Address:
    """A 160-bit address. Accepts bytes, int, or a hex string."""

    __slots__ = ("_raw",)
    _raw: bytes

    def __init__(self, value: bytes | int | str | Address) -> None:
        if isinstance(value, Address):
            self._raw = value._raw
        elif isinstance(value, bytes):
            if len(value) != 20:
                raise SimStorageError(f"Address must be 20 bytes, got {len(value)}")
            self._raw = value
        elif isinstance(value, int):
            if value < 0 or value >= (1 << 160):
                raise SimStorageError(f"Address int out of range: {value}")
            self._raw = value.to_bytes(20, "big")
        elif isinstance(value, str):
            raw = value[2:] if value.startswith(("0x", "0X")) else value
            if len(raw) != 40:
                raise SimStorageError(f"Address hex must be 40 chars, got {len(raw)}")
            self._raw = bytes.fromhex(raw)
        else:
            raise SimStorageError(f"Unsupported Address input: {type(value)!r}")

    @property
    def bytes(self) -> bytes:
        return self._raw

    def __str__(self) -> str:
        return "0x" + self._raw.hex()

    def __repr__(self) -> str:
        return f"Address({self!s})"

    def __eq__(self, other: object) -> bool:
        if isinstance(other, Address):
            return self._raw == other._raw
        return NotImplemented

    def __hash__(self) -> int:
        return hash(self._raw)


class SimStorageError(Exception):
    """Raised when a storage value violates the modeled subset."""


# Annotation helpers -------------------------------------------------------

def default_for_annotation(annotation: Any) -> Any:
    """Return the fresh-storage default for a class annotation.

    GenLayer initializes typed storage fields automatically; our shim mirrors
    that by consulting the annotation when a field was not set in ``__init__``.
    """
    origin = getattr(annotation, "__origin__", None)
    if origin is TreeMap:
        return TreeMap()
    if origin is DynArray:
        return DynArray()
    if annotation is TreeMap:
        return TreeMap()
    if annotation is DynArray:
        return DynArray()
    if annotation is u256:
        return u256(0)
    if annotation is i256:
        return i256(0)
    return None


def is_storage_annotation(annotation: Any) -> bool:
    origin = getattr(annotation, "__origin__", None)
    return origin in (TreeMap, DynArray) or annotation in (TreeMap, DynArray, u256, i256)


def iter_tree_map(tree: TreeMap[Any, Any]) -> Iterator[Any]:
    """Iterate a TreeMap deterministically (sorted keys) for trace output."""
    yield from sorted(tree.keys(), key=str)
