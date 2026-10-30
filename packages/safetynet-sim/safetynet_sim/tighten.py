"""Verdict-stability measurement under simulated evidence/validator noise.

``snet tighten`` runs a reference scenario repeatedly with deterministic
perturbations (AGENTS.md §10.10, ANL-001/002). It reports:

- **stability**: share of samples whose accepted canonical verdict equals the
  clean baseline.
- **false-disagree**: share where the accepted verdict differs from the
  baseline or consensus does not converge.
- **false-agree**: share where a semantically flipped leader output is still
  accepted as the flipped verdict despite a majority of honest validators
  disagreeing. A low number means validators reject a bad leader.
- **weakest area**: the canonical field that diverges most often.

The harness uses mocked LLM/web calls and the in-process simulator. It is a
design tool; real-model stability must be measured with recorded cassettes or
``snet test --mode network`` before shipping a prompt change.
"""

from __future__ import annotations

import copy
import json
import random
import sys
from pathlib import Path
from typing import Any, cast

from .errors import SimError
from .scenario import load_scenario, run_scenario

DEFAULT_SCENARIO = "test/fixtures/scenarios/medical-advice-violation.yaml"
TARGETS = {"SafetyNet.adjudicate", "adjudicate", "adjudicate()"}
NOISE_LEVELS = {"low": 0.1, "medium": 0.25, "high": 0.4}
FINDING_COMPLIANT = {
    "clause_id": "C1",
    "finding": "COMPLIANT",
    "reason_code": "NOT_COVERED",
}
FINDING_VIOLATED = {
    "clause_id": "C1",
    "finding": "VIOLATED",
    "reason_code": "EXPLICIT",
}


def _canonical(value: Any) -> dict[str, Any] | None:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (TypeError, ValueError):
            return None
    if not isinstance(value, dict):
        return None
    return {
        "verdict": value.get("verdict"),
        "severity": value.get("severity"),
        "confidence": value.get("confidence"),
        "clauses": sorted(value.get("clauses", [])),
    }


def _extract(result: dict[str, Any]) -> dict[str, Any]:
    """Find the adjudication tx and the verdict/read result in a scenario run."""
    tx: dict[str, Any] | None = None
    verdict: dict[str, Any] | None = None
    for step in result.get("steps", []):
        if step.get("step") == "adjudicate" and "tx" in step:
            tx = step["tx"]
        if step.get("step") == "get_verdict" and "value" in step:
            verdict = _canonical(step["value"])
    if tx is None:
        raise SimError("scenario has no adjudicate step")
    return {
        "status": tx.get("status"),
        "round": tx.get("round", 1),
        "votes": tx.get("votes", {}),
        "verdict": verdict,
    }


def _adjudicate_step(scenario: dict[str, Any]) -> dict[str, Any]:
    steps = cast(list[dict[str, Any]], scenario.get("steps", []))
    for step in steps:
        if step.get("call") == "adjudicate":
            return step
    raise SimError("scenario has no adjudicate call")


def _file_step(scenario: dict[str, Any]) -> dict[str, Any] | None:
    steps = cast(list[dict[str, Any]], scenario.get("steps", []))
    for step in steps:
        if step.get("call") == "file_incident":
            return step
    return None


def _perturb_evidence(scenario: dict[str, Any], rng: random.Random) -> None:
    """Apply one bounded evidence perturbation in place (deterministic)."""
    step = _file_step(scenario)
    if step is None:
        return
    args = step.get("args")
    if not isinstance(args, list) or len(args) < 5:
        return
    choice = rng.choice(["whitespace", "truncate", "case", "quote"])
    claim = str(args[2])
    manifest = args[4]
    if choice == "whitespace":
        args[2] = f"  {claim}  "
    elif choice == "case":
        args[2] = claim.swapcase()
    elif choice == "quote":
        args[2] = claim.replace("specific ", "specific, ")
    if not isinstance(manifest, str):
        return
    try:
        parsed = json.loads(manifest)
    except (TypeError, ValueError):
        return
    items = parsed.get("items", [])
    if not items:
        return
    first = items[0]
    text = first.get("text")
    if not isinstance(text, str):
        return
    if choice == "truncate" and len(text) > 40:
        first["text"] = text[: max(20, int(len(text) * 0.75))]
    elif choice == "quote":
        first["text"] = text.replace("4000mg", "4,000 mg")
    elif choice == "case":
        first["text"] = text.upper()
    args[4] = json.dumps(parsed, sort_keys=True, separators=(",", ":"))
    # The evidence hash is the canonical manifest hash. Recompute it so the
    # scenario remains internally consistent after the perturbation.
    import hashlib

    canonical = json.dumps(parsed, sort_keys=True, separators=(",", ":"))
    args[3] = "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _divergence(
    scenario: dict[str, Any],
    *,
    divergent: set[int] | list[int] | tuple[int, ...] = (),
    leader_flip: bool = False,
) -> None:
    """Configure leader/validator mocks for one stability sample."""
    step = _adjudicate_step(scenario)
    llm = step.setdefault("llm", {})
    if not isinstance(llm, dict):
        llm = {}
        step["llm"] = llm
    llm["default"] = {"response": FINDING_VIOLATED}
    llm["leader"] = {
        "response": FINDING_COMPLIANT if leader_flip else FINDING_VIOLATED
    }
    validators = []
    for index in range(5):
        finding = (
            FINDING_COMPLIANT
            if (not leader_flip and index in divergent)
            else FINDING_VIOLATED
        )
        validators.append({"response": finding})
    llm["validators"] = validators


def _sample_count(noise: str, rng: random.Random) -> int:
    level = NOISE_LEVELS[noise]
    # 1..4 non-leader validators. Keep at least one honest validator so the
    # sample tests disagreement rather than a total outage.
    upper = min(4, max(1, round(level * 8)))
    return rng.randint(1, upper)


def _run_once(
    scenario: dict[str, Any],
    *,
    seed: int,
    noise: str,
) -> dict[str, Any]:
    rng = random.Random(seed)
    variant = copy.deepcopy(scenario)
    _perturb_evidence(variant, rng)
    divergent = set(rng.sample(range(1, 5), k=_sample_count(noise, rng)))
    _divergence(variant, divergent=divergent)
    llm_noise = {
        "level": 0.2 if noise == "medium" else 0.35 if noise == "high" else 0.1,
        "kind": "case" if noise != "high" else "whitespace",
        "seed": seed,
    }
    return run_scenario(variant, seed=seed, llm_noise=llm_noise)


def _run_false_agree(
    scenario: dict[str, Any],
    *,
    seed: int,
) -> dict[str, Any]:
    variant = copy.deepcopy(scenario)
    _divergence(variant, divergent=(), leader_flip=True)
    return run_scenario(variant, seed=seed, llm_noise=None)


def run_tighten(
    target: str = "SafetyNet.adjudicate",
    *,
    samples: int = 200,
    seed: int = 1,
    noise: str = "medium",
    scenario_path: str | Path | None = None,
) -> dict[str, Any]:
    """Measure stability for a scenario target and return a report."""
    if samples < 1:
        raise SimError("--samples must be >= 1")
    if noise not in NOISE_LEVELS:
        raise SimError(f"unknown noise level {noise!r}; use low, medium, or high")
    if target not in TARGETS and not str(target).endswith((".yaml", ".yml", ".json")):
        raise SimError(
            f"unsupported tighten target: {target}; use SafetyNet.adjudicate or a scenario file"
        )

    path = scenario_path or (target if str(target).endswith((".yaml", ".yml", ".json")) else DEFAULT_SCENARIO)
    scenario = load_scenario(path)
    baseline_result = run_scenario(scenario, seed=seed)
    baseline = _extract(baseline_result)
    if baseline["status"] not in ("ACCEPTED", "FINALIZED") or baseline["verdict"] is None:
        raise SimError(
            f"baseline scenario did not produce a verdict: {baseline_result.get('failures')}"
        )

    stable = 0
    unstable: list[dict[str, Any]] = []
    field_counts = {"verdict": 0, "severity": 0, "confidence": 0, "clauses": 0}
    for index in range(samples):
        sample_seed = seed * 100_003 + index
        result = _run_once(scenario, seed=sample_seed, noise=noise)
        outcome = _extract(result)
        verdict = outcome["verdict"]
        same = outcome["status"] in ("ACCEPTED", "FINALIZED") and verdict == baseline["verdict"]
        if same:
            stable += 1
            continue
        fields = []
        if verdict is None:
            field_counts["verdict"] += 1
            fields = ["verdict"]
        else:
            for field in field_counts:
                if verdict.get(field) != baseline["verdict"].get(field):
                    field_counts[field] += 1
                    fields.append(field)
        if not fields:
            fields = ["verdict"] if outcome["status"] not in ("ACCEPTED", "FINALIZED") else []
        unstable.append(
            {
                "sample": index,
                "seed": sample_seed,
                "status": outcome["status"],
                "round": outcome["round"],
                "votes": outcome["votes"],
                "verdict": verdict,
                "fields": fields,
            }
        )

    false_agree_denominator = max(1, samples // 5)
    false_agree = 0
    for index in range(false_agree_denominator):
        result = _run_false_agree(scenario, seed=seed * 200_003 + index)
        outcome = _extract(result)
        if (
            outcome["status"] in ("ACCEPTED", "FINALIZED")
            and outcome["verdict"] is not None
            and outcome["verdict"].get("verdict") == "DISMISSED"
        ):
            false_agree += 1

    stability = round(100 * stable / samples)
    weakest = "none"
    if any(field_counts.values()):
        weakest = max(field_counts, key=lambda field: field_counts[field])
    recommendation = _recommend(stability, weakest, field_counts)
    return {
        "ok": True,
        "target": target,
        "scenario": str(path),
        "seed": seed,
        "samples": samples,
        "noise": noise,
        "stability": stability,
        "false_disagree": round(100 * (samples - stable) / samples),
        "false_agree": round(100 * false_agree / false_agree_denominator),
        "weakest_area": weakest,
        "field_divergence": field_counts,
        "recommendation": recommendation,
        "baseline": baseline["verdict"],
        "unstable_samples": unstable[:20],
        "unstable_count": len(unstable),
    }


def _recommend(stability: int, weakest: str, fields: dict[str, int]) -> str:
    if stability >= 95:
        return "stable at this noise level; keep the current canonical payload"
    if weakest == "severity":
        return (
            "severity diverges most often; consider binning severity to LOW|HIGH "
            "or moving more of the floor into deterministic code"
        )
    if weakest == "clauses":
        return (
            "clause sets diverge most often; cap the public citation to the "
            "primary clause or clarify the ambiguous clause"
        )
    if weakest == "confidence":
        return (
            "confidence bands diverge; derive confidence from evidence "
            "availability and defense presence, not model output"
        )
    if fields.get("verdict"):
        return (
            "the verdict itself diverges; inspect the disagreement corpus and "
            "tighten the prompt or make the ambiguous case explicit"
        )
    return "no field divergence observed in this sample"


def render_text(report: dict[str, Any]) -> str:
    baseline = report["baseline"] or {}
    lines = [
        (
            f"tighten {report['target']}  samples={report['samples']} "
            f"noise={report['noise']} seed={report['seed']}"
        ),
        f"  scenario {report['scenario']}",
        f"  stability {report['stability']}/100",
        (
            "  false-disagree (accepted verdict differs or consensus fails): "
            f"{report['false_disagree']}%"
        ),
        f"  false-agree (flipped leader accepted): {report['false_agree']}%",
        (
            f"  baseline {baseline.get('verdict')}/{baseline.get('severity')}/"
            f"{baseline.get('confidence')}/"
            f"{','.join(baseline.get('clauses', [])) or '-'}"
        ),
        f"  weakest area: {report['weakest_area']} — {report['recommendation']}",
    ]
    if report["unstable_count"]:
        lines.append("")
        lines.append(f"  {report['unstable_count']} unstable sample(s) (first shown)")
        for sample in report["unstable_samples"][:5]:
            lines.append(
                f"    sample {sample['sample']}: {sample['status']} "
                f"round={sample['round']} fields={','.join(sample['fields']) or '-'}"
            )
    return "\n".join(lines)


def render_markdown(report: dict[str, Any]) -> str:
    baseline = report["baseline"] or {}
    lines = [
        f"# Verdict stability — {report['target']}",
        "",
        f"- Scenario: `{report['scenario']}`",
        f"- Samples: {report['samples']} · Noise: `{report['noise']}` · Seed: {report['seed']}",
        (
            f"- Baseline: `{baseline.get('verdict')}` / `{baseline.get('severity')}` / "
            f"`{baseline.get('confidence')}` / `{','.join(baseline.get('clauses', [])) or '-'}`"
        ),
        "",
        "| Metric | Value |",
        "|---|---|",
        f"| Stability | {report['stability']}/100 |",
        f"| False-disagree | {report['false_disagree']}% |",
        f"| False-agree | {report['false_agree']}% |",
        f"| Weakest area | `{report['weakest_area']}` |",
        "",
        f"**Recommendation:** {report['recommendation']}",
        "",
        "## Field divergence",
        "",
        "| Field | Diverged samples |",
        "|---|---|",
    ]
    for field, count in report["field_divergence"].items():
        lines.append(f"| `{field}` | {count} |")
    lines.extend(
        [
            "",
            "The harness uses deterministic mocked LLM/web calls in the in-process",
            "simulator. It measures the canonical verdict under evidence and validator",
            "perturbations; it is not a substitute for a network-mode stability run",
            "with recorded model outputs.",
        ]
    )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = list(argv if argv is not None else sys.argv[1:])
    target = "SafetyNet.adjudicate"
    samples = 200
    seed = 1
    noise = "medium"
    report_format = "text"
    index = 0
    while index < len(args):
        token = args[index]
        if token == "--samples":
            samples = int(args[index + 1])
            index += 2
        elif token == "--seed":
            seed = int(args[index + 1])
            index += 2
        elif token == "--noise":
            noise = args[index + 1]
            index += 2
        elif token == "--report":
            report_format = args[index + 1]
            index += 2
        elif token.startswith("-"):
            print(f"unknown option: {token}", file=sys.stderr)
            return 2
        else:
            target = token
            index += 1

    try:
        report = run_tighten(
            target, samples=samples, seed=seed, noise=noise
        )
    except (SimError, OSError, ValueError) as error:
        print(f"tighten: {error}", file=sys.stderr)
        return 2

    if report_format == "json":
        print(json.dumps(report, indent=2))
    elif report_format == "md":
        print(render_markdown(report))
    else:
        print(render_text(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
