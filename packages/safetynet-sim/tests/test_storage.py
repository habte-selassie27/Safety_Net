"""SIM-002: storage types have the tested subset of GenLayer semantics."""

import pytest
from safetynet_sim.storage import (
    Address,
    DynArray,
    SimStorageError,
    TreeMap,
    i256,
    u256,
)


def test_tree_map_set_get_contains_len_iterate():
    tree: TreeMap[str, str] = TreeMap()
    tree["b"] = "two"
    tree["a"] = "one"
    assert tree["a"] == "one"
    assert tree.get("missing") is None
    assert tree.get("missing", "fallback") == "fallback"
    assert "a" in tree
    assert len(tree) == 2
    assert sorted(tree.keys()) == ["a", "b"]
    assert sorted(tree.items()) == [("a", "one"), ("b", "two")]


def test_tree_map_deepcopy_is_independent():
    import copy

    original: TreeMap[str, str] = TreeMap({"a": "1"})
    clone = copy.deepcopy(original)
    clone["a"] = "2"
    assert original["a"] == "1"


def test_dyn_array_accepts_plain_list_assignment_and_append():
    array: DynArray[str] = DynArray()
    array.append("C1")
    array.append("C2")
    assert list(array) == ["C1", "C2"]
    assert len(array) == 2


def test_u256_bounds():
    assert int(u256(0)) == 0
    assert int(u256((1 << 256) - 1)) == (1 << 256) - 1
    with pytest.raises(SimStorageError):
        u256(-1)
    with pytest.raises(SimStorageError):
        u256(1 << 256)


def test_i256_bounds():
    assert int(i256(-(1 << 255))) == -(1 << 255)
    assert int(i256((1 << 255) - 1)) == (1 << 255) - 1
    with pytest.raises(SimStorageError):
        i256(1 << 255)


def test_address_round_trips():
    raw = "0x" + "ab" * 20
    address = Address(raw)
    assert str(address) == raw
    assert Address(address.bytes) == address
    assert Address(int(raw, 16)) == address
    assert hash(Address(raw)) == hash(Address(raw))


def test_address_rejects_bad_input():
    with pytest.raises(SimStorageError):
        Address("0x1234")
    with pytest.raises(SimStorageError):
        Address(b"short")
