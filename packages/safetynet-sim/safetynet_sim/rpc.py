"""JSON-RPC 2.0 bridge for safetynet-sim over stdio.

Protocol: newline-delimited JSON. Methods (AGENTS.md §17.10):

    sim.init        {config}                                  -> {ok, protocolVersion}
    sim.deploy      {sourcePath|source, args, sender}         -> {address}
    sim.read        {address, method, args, sender}           -> {value}
    sim.write       {address, method, args, sender, wait}     -> TxResult
    sim.mock        {kind, rule}                              -> {ruleId}
    sim.snapshot    {id?}                                     -> {id}
    sim.revert      {id}                                      -> {ok}
    sim.setValidators {n}                                     -> {ok}
    sim.trace       {txHash}                                  -> ConsensusTrace
    sim.shutdown    {}                                        -> {ok}

Backwards-compatible extras: sim.run_tx, sim.appeal, sim.canonical.
"""

from __future__ import annotations

import json
import sys
from typing import Any

from .engine import Simulator, canonical
from .model import SimConfig
from .errors import SimError

PROTOCOL_VERSION = 1
STATE: dict[str, Any] = {}


def _sim() -> Simulator:
    sim = STATE.get("sim")
    if sim is None:
        sim = Simulator()
        STATE["sim"] = sim
    return sim


def _error(rid: Any, code: int, message: str, data: Any = None) -> dict[str, Any]:
    err: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        err["data"] = data
    return {"jsonrpc": "2.0", "id": rid, "error": err}


def _result(rid: Any, result: Any) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": rid, "result": result}


def _jsonable(value: Any) -> Any:
    """Convert storage/trace objects to plain JSON."""
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if hasattr(value, "to_dict"):
        return value.to_dict()
    if hasattr(value, "__dict__") and not isinstance(value, type):
        return {k: _jsonable(v) for k, v in value.__dict__.items() if not k.startswith("_")}
    return value


def _mock_rule(kind: str, rule: dict[str, Any]) -> str:
    sim = _sim()
    match = rule.get("match", {}) or {}
    if kind == "web":
        builder = sim.mock_web.when(
            url=match.get("url") or match.get("contains"),
            url_regex=match.get("url_regex") or match.get("regex"),
        )
    else:
        builder = sim.mock_llm.when(
            contains=match.get("contains"),
            regex=match.get("regex"),
            exact=match.get("exact"),
            hash=match.get("hash"),
        )
    if rule.get("role"):
        builder.role = rule["role"]
    if rule.get("validators"):
        builder.validators = list(rule["validators"])
    if rule.get("fail"):
        builder.fail(kind=str(rule["fail"]))
    elif rule.get("sequence"):
        builder.sequence(list(rule["sequence"]))
    elif rule.get("delay"):
        builder.delay(seconds=float(rule["delay"]))
    else:
        response = rule.get("response")
        if isinstance(response, dict):
            if kind == "web":
                builder.respond(
                    text=response.get("text"),
                    html=response.get("html"),
                    sha256=response.get("sha256"),
                )
            else:
                builder.respond(response)
        elif response is not None:
            builder.respond(response)
        else:
            raise SimError("sim.mock requires response, sequence, fail, or delay")
    return f"{kind}:{len(builder.registry.rules)}"


def handle(req: dict[str, Any]) -> dict[str, Any]:
    method = req.get("method")
    params = req.get("params", {}) or {}
    rid = req.get("id")
    try:
        if method == "sim.init":
            cfg = params.get("config", {}) or {}
            requested = params.get("protocolVersion")
            if requested is not None and int(requested) != PROTOCOL_VERSION:
                return _error(
                    rid,
                    -32000,
                    "protocol version mismatch",
                    {
                        "code": "E3001",
                        "expected": PROTOCOL_VERSION,
                        "received": requested,
                    },
                )
            allowed = {
                "validators",
                "seed",
                "majority",
                "appeal_growth",
                "max_appeals",
                "timeout_ms",
            }
            unknown = sorted(set(cfg) - allowed)
            if unknown:
                return _error(
                    rid,
                    -32602,
                    f"unknown config keys: {', '.join(unknown)}",
                    {"code": "E1002", "keys": unknown},
                )
            STATE["sim"] = Simulator(SimConfig(**cfg))
            return _result(rid, {"ok": True, "protocolVersion": PROTOCOL_VERSION})

        if method == "sim.deploy":
            sim = _sim()
            address = sim.deploy(
                source_path=params.get("sourcePath"),
                source=params.get("source"),
                args=params.get("args", []),
                sender=params.get("sender"),
            )
            return _result(rid, {"address": address})

        if method == "sim.read":
            value = _sim().read(
                params["address"],
                params["method"],
                params.get("args", []),
                params.get("sender"),
            )
            return _result(rid, {"value": _jsonable(value)})

        if method == "sim.write":
            result = _sim().write(
                params["address"],
                params["method"],
                params.get("args", []),
                params.get("sender"),
                params.get("wait", "ACCEPTED"),
            )
            return _result(rid, result.to_dict())

        if method == "sim.mock":
            kind = params.get("kind")
            if kind not in ("llm", "web"):
                return _error(rid, -32602, "kind must be 'llm' or 'web'")
            rule_id = _mock_rule(kind, params.get("rule", {}) or {})
            return _result(rid, {"ruleId": rule_id})

        if method == "sim.snapshot":
            snap = _sim().snapshot()
            STATE.setdefault("snapshots", {})[snap] = snap
            return _result(rid, {"id": snap})

        if method == "sim.revert":
            _sim().revert(params["id"])
            return _result(rid, {"ok": True})

        if method == "sim.setValidators":
            _sim().set_validators(int(params["n"]))
            return _result(rid, {"ok": True})

        if method == "sim.trace":
            trace = _sim().trace(params["txHash"])
            return _result(rid, trace.to_dict())

        if method == "sim.shutdown":
            STATE.clear()
            return _result(rid, {"ok": True})

        # -- backwards-compatible extras ---------------------------------
        if method == "sim.run_tx":
            sim = _sim()
            res = sim.run_tx(params.get("leader_output"), params.get("validator_outputs", []))
            return _result(rid, res)

        if method == "sim.appeal":
            sim = _sim()
            res = sim.appeal(params.get("leader_output"), params.get("validator_outputs", []))
            return _result(rid, res)

        if method == "sim.canonical":
            return _result(rid, canonical(params.get("obj")))

        return _error(rid, -32601, "Method not found")
    except SimError as exc:
        return _error(rid, -32000, exc.message, exc.as_dict())
    except KeyError as exc:
        return _error(rid, -32602, f"missing parameter: {exc}")
    except Exception as exc:  # noqa: BLE001 - bridge must stay alive
        return _error(rid, -32000, f"{type(exc).__name__}: {exc}")


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception as exc:  # noqa: BLE001
            sys.stdout.write(
                json.dumps(_error(None, -32700, f"parse error: {exc}")) + "\n"
            )
            sys.stdout.flush()
            continue
        response = handle(req)
        sys.stdout.write(json.dumps(response, default=str) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
