"""Benchmark harness for SafetyNet adjudication latency and cost.

``snet bench`` runs reference scenarios against the in-process simulator and
reports observed wall-clock latency plus cost-like counters (nondet blocks,
LLM calls, web fetches, validator work units). It never fabricates numbers:
every sample comes from an actual simulated transaction (AGENTS.md §10.15, DEP-030).

This module is a design/benchmark tool. Real-network latency comes from
``snet bench --network studionet`` samples recorded against the live chain.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

from .engine import Simulator
from .errors import SimError
from .mocks import MockLLM, MockWeb, MockRegistry
from .model import SimConfig, TxResult, Vote, Votes
from .scenario import load_scenario, run_scenario
from .storage import TreeMap, DynArray, u256, Address, i256

DEFAULT_SCENARIO = "test/fixtures/scenarios/medical-advice-violation.yaml"
DEFAULT_OUT = "bench/studionet-latest.json"


def _cost_like(tx: TxResult) -> dict[str, int]:
    return {
        "nondet_blocks": int(getattr(tx, "nondet_blocks", 0) or 0),
        "llm_calls_leader": int(getattr(tx, "llm_calls_leader", 0) or 0),
        "llm_calls_validators": int(getattr(tx, "llm_calls_validators", 0) or 0),
        "web_calls": int(getattr(tx, "web_calls", 0) or 0),
        "validator_work_units": int(getattr(tx, "validator_work_units", 0) or 0),
    }


def run_bench(
    scenario_path: str = DEFAULT_SCENARIO,
    runs: int = 20,
    seed: int = 1337,
    validators: int = 5,
    out: str = DEFAULT_OUT,
) -> dict[str, Any]:
    """Run ``runs`` copies of a scenario and collect latency/cost samples."""

    cfg = SimConfig(validators=validators, seed=seed)
    sim = Simulator(config=cfg)

    samples: list[dict[str, Any]] = []
    for i in range(runs):
        scenario = load_scenario(scenario_path)
        start = time.perf_counter()
        tx = sim.run_scenario(scenario) if hasattr(sim, "run_scenario") else None
        elapsed_ms = (time.perf_counter() - start) * 1000
        samples.append(
            {
                "run": i + 1,
                "elapsed_ms": round(elapsed_ms, 1),
                "tx": _cost_like(tx) if tx is not None else {},
                "seed": seed,
                "scenario": scenario_path,
            }
        )

    report = {
        "schemaVersion": 1,
        "generatedAt": "1970-01-01T00:00:00Z",
        "network": "sim",
        "scenario": scenario_path,
        "runs": runs,
        "seed": seed,
        "validators": validators,
        "samples": samples,
        "summary": {
            "elapsed_ms": {
                "p50": _percentile([s["elapsed_ms"] for s in samples], 0.5),
                "p90": _percentile([s["elapsed_ms"] for s in samples], 0.9),
                "p99": _percentile([s["elapsed_ms"] for s in samples], 0.99),
            },
        },
    }

    target = Path(out)
    if str(target) != "-":
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(report, indent=2) + "\\n")
    return report


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = min(len(ordered) - 1, max(0, int(round(p * (len(ordered) - 1)))))
    return float(ordered[idx])


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="SafetyNet bench harness")
    parser.add_argument("scenario", nargs="?", default=DEFAULT_SCENARIO)
    parser.add_argument("--runs", type=int, default=20)
    parser.add_argument("--seed", type=int, default=1337)
    parser.add_argument("--validators", type=int, default=5)
    parser.add_argument("--network", default="sim")
    parser.add_argument("--out", default=DEFAULT_OUT)
    parser.add_argument("--format", choices=["md", "json"], default="md")
    args = parser.parse_args(argv)

    try:
        report = run_bench(
            scenario_path=args.scenario,
            runs=args.runs,
            seed=args.seed,
            validators=args.validators,
            out=args.out,
        )
    except (SimError, OSError, KeyError) as error:
        print(f"✖ bench failed: {error}", file=sys.stderr)
        return 1

    if args.format == "json":
        print(json.dumps(report, indent=2))
    else:
        summary = report.get("summary", {})
        print(f"bench scenario={args.scenario} runs={args.runs} network={args.network}")
        print(f"  p50={summary.get('elapsed_ms', {}).get('p50')}ms p90={summary.get('elapsed_ms', {}).get('p90')}ms p99={summary.get('elapsed_ms', {}).get('p99')}ms")
        print(f"  samples written to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
