"""Run a YAML/JSON scenario through the simulator (AGENTS.md §10.8).

Usage:
    python -m safetynet_sim.scenario <scenario.yaml> [--validators 5] [--seed 1]
                                     [--trace-format text|json] [--fault kind:index]

Scenario shape (YAML or JSON):

    name: medical-advice-violation
    contract: contracts/safetynet.py
    validators: 5
    args: [8, 20000, 24, 72, 1, 48, "example.com"]
    steps:
      - call: register_system
        args: [...]
        sender: "0xAlice"
      - call: adjudicate
        args: ["inc-000001"]
        llm:
          leader: { response: {...} }
          validators:
            - { response: {...} }
        web:
          "https://example.com/policy": "## C1 ..."
        expect:
          status: ACCEPTED
          votes: { agree: 5 }
      - read: get_verdict
        args: ["inc-000001"]
        expect:
          returns: { verdict: POLICY_VIOLATION }
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, cast

from .engine import Simulator
from .errors import SimError
from .model import SimConfig

DEFAULT_ARGS = [8, 20000, 24, 72, 1, 48, "example.com,raw.githubusercontent.com"]
DEFAULT_SENDER = "0x" + "11" * 20


def load_scenario(path: str | Path) -> dict[str, Any]:
    text = Path(path).read_text(encoding="utf-8")
    if str(path).endswith((".yaml", ".yml")):
        try:
            import yaml  # type: ignore
        except ImportError as exc:  # pragma: no cover - optional dependency
            raise SimError(
                "PyYAML is required for YAML scenarios; install pyyaml or use JSON"
            ) from exc
        return cast(dict[str, Any], yaml.safe_load(text))
    return cast(dict[str, Any], json.loads(text))


def _jsonable(value: Any) -> Any:
    if hasattr(value, "to_dict"):
        return value.to_dict()
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (ValueError, TypeError):
            return value
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    return value


def configure_mocks(sim: Simulator, step: dict[str, Any]) -> None:
    """Register mocks declared on a step (general first, specific last)."""
    llm = step.get("llm") or {}
    web = step.get("web") or {}

    # web: either {"url": "text"} or {"items": [{"url":..., "text":...}]}
    if isinstance(web, dict):
        if "items" in web:
            for item in web["items"]:
                sim.mock_web.when(url=item["url"]).respond(text=item.get("text", ""))
        for url, response in web.items():
            if url == "items":
                continue
            if isinstance(response, str):
                sim.mock_web.when(url=url).respond(text=response)
            elif isinstance(response, dict):
                sim.mock_web.when(url=url).respond(**response)

    if "default" in llm:
        sim.mock_llm.default().respond(llm["default"].get("response"))
    if "leader" in llm:
        sim.mock_llm.leader().respond(llm["leader"].get("response"))
    for index, entry in enumerate(llm.get("validators", []) or []):
        sim.mock_llm.validators([index]).respond(entry.get("response"))


def apply_faults(sim: Simulator, faults: list[str] | None) -> None:
    for fault in faults or []:
        if ":" in fault:
            kind, index = fault.split(":", 1)
            sim.fail_validator(int(index), kind)
        else:
            sim.fail_validator(0, fault)


def _compare(expected: Any, actual: Any) -> bool:
    if isinstance(actual, str):
        try:
            actual = json.loads(actual)
        except (ValueError, TypeError):
            pass
    if isinstance(expected, dict) and isinstance(actual, dict):
        return all(actual.get(k) == v for k, v in expected.items())
    return bool(expected == actual)


def run_scenario(
    scenario: dict[str, Any] | str | Path,
    *,
    validators: int | None = None,
    seed: int | None = None,
    faults: list[str] | None = None,
    llm_noise: dict[str, Any] | None = None,
) -> dict[str, Any]:
    data = load_scenario(scenario) if isinstance(scenario, (str, Path)) else scenario
    config = SimConfig(
        validators=validators or data.get("validators", 5),
        seed=seed or data.get("seed", 1337),
        majority=data.get("majority", 0.5),
        appeal_growth=data.get("appeal_growth", 2),
        max_appeals=data.get("max_appeals", 1),
    )
    sim = Simulator(config)
    if "leader" in data:
        sim.set_leader(int(data["leader"]))
    address = sim.deploy(
        source_path=data.get("contract", "contracts/safetynet.py"),
        source=data.get("source"),
        args=data.get("args", DEFAULT_ARGS),
        sender=data.get("sender", DEFAULT_SENDER),
    )
    apply_faults(sim, faults)

    default_sender = data.get("sender", DEFAULT_SENDER)
    steps: list[dict[str, Any]] = []
    failures: list[str] = []

    for index, step in enumerate(data.get("steps", []) or [], start=1):
        configure_mocks(sim, step)
        if llm_noise:
            sim.mock_llm.noise(
                level=float(llm_noise.get("level", 0.2)),
                kind=str(llm_noise.get("kind", "whitespace")),
                seed=int(llm_noise.get("seed", seed or 1337)),
            )
        if "call" in step:
            result = sim.write(
                address,
                step["call"],
                step.get("args", []),
                sender=step.get("sender", default_sender),
            )
            record = {"index": index, "step": step["call"], "tx": result.to_dict()}
            expect = step.get("expect") or {}
            if "status" in expect and result.status != expect["status"]:
                failures.append(
                    f"step {index} ({step['call']}): status {result.status} != {expect['status']}"
                )
            votes = expect.get("votes") or {}
            for key, wanted in votes.items():
                actual = getattr(result.votes, key, None)
                if actual != wanted:
                    failures.append(
                        f"step {index} ({step['call']}): votes.{key} {actual} != {wanted}"
                    )
            if "error_contains" in expect and expect["error_contains"] not in (result.error or ""):
                failures.append(
                    f"step {index} ({step['call']}): error {result.error!r} "
                    f"does not contain {expect['error_contains']!r}"
                )
            steps.append(record)
        elif "read" in step:
            value = sim.read(
                address,
                step["read"],
                step.get("args", []),
                sender=step.get("sender", default_sender),
            )
            parsed = _jsonable(value)
            steps.append({"index": index, "step": step["read"], "value": parsed})
            expect = step.get("expect") or {}
            if "returns" in expect and not _compare(expect["returns"], parsed):
                failures.append(
                    f"step {index} ({step['read']}): returns {parsed!r} "
                    f"!= expected {expect['returns']!r}"
                )
        else:
            failures.append(f"step {index}: must have 'call' or 'read'")

    return {
        "name": data.get("name", Path(str(scenario)).stem),
        "address": address,
        "config": config.to_dict(),
        "steps": steps,
        "failures": failures,
        "ok": not failures,
    }


def render_text(result: dict[str, Any]) -> str:
    lines = [
        f"scenario {result['name']}",
        f"  address {result['address']}",
        f"  validators={result['config']['validators']} seed={result['config']['seed']}",
        "",
    ]
    for step in result["steps"]:
        if "tx" in step:
            tx = step["tx"]
            lines.append(
                f"  [{step['index']}] {step['step']} -> {tx['status']} "
                f"(round {tx['round']}, agree {tx['votes']['agree']}/"
                f"{tx['votes']['agree'] + tx['votes']['disagree'] + tx['votes']['timeout'] + tx['votes']['abstain']})"
            )
            if tx.get("trace"):
                trace = tx["trace"]
                lines.append(
                    f"      nondet={trace['nondet_blocks']} llm={trace['llm_calls']} "
                    f"web={trace['web_calls']}"
                )
        else:
            lines.append(f"  [{step['index']}] {step['step']} -> {json.dumps(step['value'])[:200]}")
    if result["failures"]:
        lines.append("")
        lines.append("FAILURES:")
        lines.extend(f"  - {failure}" for failure in result["failures"])
    else:
        lines.append("")
        lines.append("OK: all expectations met")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = list(argv if argv is not None else sys.argv[1:])
    if not args:
        print(__doc__)
        return 2
    scenario = args[0]
    validators = None
    seed = None
    faults: list[str] = []
    trace_format = "text"
    index = 1
    while index < len(args):
        token = args[index]
        if token == "--validators":
            validators = int(args[index + 1])
            index += 2
        elif token == "--seed":
            seed = int(args[index + 1])
            index += 2
        elif token == "--fault":
            faults.append(args[index + 1])
            index += 2
        elif token == "--trace-format":
            trace_format = args[index + 1]
            index += 2
        else:
            raise SimError(f"unknown argument: {token}")
    result = run_scenario(scenario, validators=validators, seed=seed, faults=faults)
    if trace_format == "json":
        print(json.dumps(result, indent=2, default=str))
    else:
        print(render_text(result))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
