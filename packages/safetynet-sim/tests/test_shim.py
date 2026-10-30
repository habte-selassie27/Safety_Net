"""SIM-011: shim signature checks against the ground-truth snapshot.

When a real `genlayer` contract runtime is installed, compare the subset we
model. Otherwise assert the documented signatures from docs/ground-truth.md
so a shim drift is still caught.
"""

import importlib.util
import inspect

import pytest
from safetynet_sim.shim import _GLNamespace, make_genlayer_module

DOCUMENTED_SIGNATURES = {
    "gl.nondet.exec_prompt": ["prompt"],
    "gl.nondet.web.render": ["url", "mode"],
    "gl.eq_principle.strict_eq": ["fn"],
}


def _has_real_genlayer() -> bool:
    try:
        spec = importlib.util.find_spec("genlayer")
    except ModuleNotFoundError:
        return False
    return spec is not None and spec.origin is not None


@pytest.mark.skipif(not _has_real_genlayer(), reason="real genlayer runtime not installed")
def test_shim_names_exist_on_real_sdk():
    import genlayer

    for path in DOCUMENTED_SIGNATURES:
        parts = path.split(".")[1:]
        obj = genlayer.gl
        for part in parts:
            assert hasattr(obj, part), f"real SDK lacks {path}"
            obj = getattr(obj, part)


def test_documented_shim_signatures():
    gl = _GLNamespace()
    assert list(inspect.signature(gl.nondet.exec_prompt).parameters)[:1] == ["prompt"]
    render_params = list(inspect.signature(gl.nondet.web.render).parameters)
    assert render_params[:2] == ["url", "mode"]
    strict_params = list(inspect.signature(gl.eq_principle.strict_eq).parameters)
    assert strict_params == ["fn"]


def test_gl_namespace_exposes_the_contract_surface():
    gl = _GLNamespace()
    assert gl.vm.UserError is not None
    assert isinstance(type(gl.message).sender_address, property)
    assert isinstance(type(gl.block).timestamp, property)
    assert callable(gl.public.view)
    assert callable(gl.public.write)


def test_unknown_gl_member_raises_e3001():
    from safetynet_sim.errors import SimUnsupportedFeature

    gl = _GLNamespace()
    with pytest.raises(SimUnsupportedFeature) as info:
        _ = gl.definitely_not_real
    assert info.value.code == "E3001"


def test_genlayer_module_exports_the_subset():
    module = make_genlayer_module()
    for name in ("gl", "Contract", "TreeMap", "DynArray", "Address", "u256", "allow_storage"):
        assert hasattr(module, name), name
