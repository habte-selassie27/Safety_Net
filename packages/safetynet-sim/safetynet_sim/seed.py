"""Deterministic synthetic seed fixtures (SEED-001).

The seed set is deliberately small and explicit. Every fixture is labelled
``synthetic`` and every policy/evidence hash is computed from the fixture text,
never copied from the web app's illustrative hashes.

Usage::

    python -m safetynet_sim.seed
    python -m safetynet_sim.seed --fixtures test/fixtures/seed/seed-v1.json --json
    python -m safetynet_sim.seed --no-adjudicate

Only the in-process simulator is supported. Public-network seeding stays
disabled until an allowlisted HTTPS host serves the exact policy text and the
owner approves a permanent synthetic dataset.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any, cast

from .engine import Simulator
from .model import SimConfig
from .errors import SimError

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_FIXTURES = ROOT / "test" / "fixtures" / "seed" / "seed-v1.json"
DEFAULT_CONTRACT = ROOT / "contracts" / "safetynet.py"
DEFAULT_ARGS = [8, 20_000, 24, 72, 1, 48, "example.com,raw.githubusercontent.com"]
DEFAULT_SEED = 1337
DEFAULT_VALIDATORS = 5


class SeedError(SimError):
    """A fixture is malformed or its expected verdict did not match."""

    code = "E2004"


def normalize_policy_text(text: str) -> str:
    """Canonical policy text, identical to ``snet policy hash``."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.removeprefix("\ufeff")
    lines = [line.rstrip(" \t") for line in text.split("\n")]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    return "\n".join(lines) + "\n"


def policy_text_hash(text: str) -> str:
    return "sha256:" + hashlib.sha256(
        normalize_policy_text(text).encode("utf-8")
    ).hexdigest()


def _digest(value: str) -> str:
    return "sha256:" + hashlib.sha256(value.encode("utf-8")).hexdigest()


def _canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _manifest(items: list[dict[str, Any]]) -> tuple[str, str]:
    normalized: list[dict[str, Any]] = []
    for item in items:
        out = dict(item)
        if "contentSha256" not in out:
            content = out.get("text") or out.get("url") or ""
            out["contentSha256"] = _digest(str(content))
        out.setdefault("maxChars", 2000)
        normalized.append(out)
    payload = {"schemaVersion": 1, "items": normalized}
    canonical = _canonical_json(payload)
    return _digest(canonical), canonical


def load_fixtures(path: str | Path = DEFAULT_FIXTURES) -> dict[str, Any]:
    fixture_path = Path(path)
    if not fixture_path.exists():
        raise SeedError(f"seed fixture not found: {fixture_path}")
    data = json.loads(fixture_path.read_text(encoding="utf-8"))
    if data.get("synthetic") is not True:
        raise SeedError("seed fixtures must be labelled synthetic: true")
    if not isinstance(data.get("systems"), list) or not isinstance(
        data.get("incidents"), list
    ):
        raise SeedError("seed fixtures need systems[] and incidents[]")
    base = fixture_path.parent
    for system in data["systems"]:
        policy_file = system.get("policy_file")
        if not isinstance(policy_file, str):
            raise SeedError(f"system {system.get('system_id')} has no policy_file")
        policy_path = base / policy_file
        if not policy_path.exists():
            raise SeedError(f"policy file not found: {policy_path}")
        text = policy_path.read_text(encoding="utf-8")
        system["_policy_text"] = text
        system["_policy_hash"] = policy_text_hash(text)
    return cast(dict[str, Any], data)


def _system_index(data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {str(system["system_id"]): system for system in data["systems"]}


def _incident_report(
    incident: dict[str, Any],
    incident_id: str,
    expected: dict[str, Any],
    actual: dict[str, Any] | None,
    result: Any | None,
) -> dict[str, Any]:
    matched = actual is not None and all(
        actual.get(field) == expected.get(field)
        for field in ("verdict", "severity", "confidence", "clauses")
    )
    return {
        "key": incident.get("key"),
        "incident_id": incident_id,
        "system_id": incident.get("system_id"),
        "policy_version": incident.get("policy_version"),
        "synthetic": True,
        "expected": expected,
        "actual": actual,
        "matched": matched if actual is not None else None,
        "tx": {
            "hash": getattr(result, "hash", None),
            "status": getattr(result, "status", None),
            "round": getattr(result, "round", None),
            "votes": getattr(getattr(result, "votes", None), "__dict__", None),
        }
        if result is not None
        else None,
    }


def run_seed(
    fixtures: str | Path = DEFAULT_FIXTURES,
    *,
    contract: str | Path = DEFAULT_CONTRACT,
    seed: int = DEFAULT_SEED,
    validators: int = DEFAULT_VALIDATORS,
    adjudicate: bool = True,
    domain_config: list[Any] | None = None,
) -> dict[str, Any]:
    """Load, register, file, and (optionally) adjudicate the seed set."""
    data = load_fixtures(fixtures)
    sim = Simulator(SimConfig(seed=seed, validators=validators, max_appeals=1))
    address = sim.deploy(
        source_path=str(contract),
        args=list(domain_config or DEFAULT_ARGS),
    )
    systems = _system_index(data)
    registrar = "0x5B3661C576c7001e6d6279C67F3779705d334c89"

    for system in data["systems"]:
        system_id = str(system["system_id"])
        provider = system.get("provider_address")
        sender = str(provider) if provider else registrar
        result = sim.write(
            address,
            "register_system",
            [
                system_id,
                str(system["display_name"]),
                str(system["provider_id"]),
                str(system["policy_version"]),
                str(system["_policy_hash"]),
                list(system["clause_ids"]),
                str(system["policy_url"]),
            ],
            sender=sender,
        )
        if result.status != "ACCEPTED":
            raise SeedError(
                f"register_system failed for {system_id}: {result.error}"
            )
        if system.get("claimed") and provider:
            claim = sim.write(address, "claim_system", [system_id], sender=sender)
            if claim.status != "ACCEPTED":
                raise SeedError(f"claim_system failed for {system_id}: {claim.error}")

    incidents: list[dict[str, Any]] = []
    for incident in data["incidents"]:
        system_id = str(incident["system_id"])
        system = systems.get(system_id)
        if system is None:
            raise SeedError(f"incident references unknown system: {system_id}")
        policy_version = str(incident["policy_version"])
        if policy_version != str(system["policy_version"]):
            raise SeedError(
                f"incident policy version {policy_version} does not match {system_id}"
            )
        evidence_hash, evidence_manifest = _manifest(incident["evidence_items"])
        filed = sim.write(
            address,
            "file_incident",
            [
                system_id,
                policy_version,
                str(incident["claim"]),
                evidence_hash,
                evidence_manifest,
            ],
            sender=str(incident["reporter"]),
        )
        if filed.status != "ACCEPTED":
            raise SeedError(
                f"file_incident failed for {incident.get('key')}: {filed.error}"
            )
        incident_id = str(filed.return_value)

        response = incident.get("response")
        if response is not None:
            response_hash, response_manifest = _manifest(
                response.get("evidence_items", [])
            )
            replied = sim.write(
                address,
                "provider_respond",
                [
                    incident_id,
                    str(response["defense"]),
                    response_hash,
                    response_manifest,
                ],
                sender=str(system.get("provider_address") or registrar),
            )
            if replied.status != "ACCEPTED":
                raise SeedError(
                    f"provider_respond failed for {incident_id}: {replied.error}"
                )

        adjudication_result: Any | None = None
        actual = None
        if adjudicate:
            sim.mock_llm.clear()
            sim.mock_web.clear()
            policy_url = str(system["policy_url"])
            sim.mock_web.when(url=policy_url).respond(
                text=str(system["_policy_text"]),
                sha256=str(system["_policy_hash"]),
            )
            for url, text in (incident.get("web") or {}).items():
                if text is None:
                    sim.mock_web.when(url=str(url)).fail(kind="network")
                else:
                    sim.mock_web.when(url=str(url)).respond(text=str(text))
            for clause_id, finding in incident["clause_findings"].items():
                sim.mock_llm.clause(str(clause_id)).respond(
                    {
                        "clause_id": str(clause_id),
                        "finding": str(finding["finding"]),
                        "reason_code": str(finding["reason_code"]),
                    }
                )
            adjudication_result = sim.write(
                address,
                "adjudicate",
                [incident_id],
                sender=str(incident["reporter"]),
            )
            if adjudication_result.status not in ("ACCEPTED", "FINALIZED"):
                raise SeedError(
                    f"adjudicate did not converge for {incident_id}: "
                    f"{adjudication_result.status} {adjudication_result.error}"
                )
            raw = sim.read(address, "get_verdict", [incident_id])
            actual = json.loads(raw) if isinstance(raw, str) and raw else raw

        incidents.append(
            _incident_report(
                incident,
                incident_id,
                incident["expected_verdict"],
                actual,
                adjudication_result,
            )
        )

    return {
        "schemaVersion": 1,
        "synthetic": True,
        "network": "sim",
        "seed": seed,
        "validators": validators,
        "contract": {
            "source": str(contract),
            "address": address,
        },
        "systems": [
            {
                "system_id": system["system_id"],
                "policy_version": system["policy_version"],
                "policy_hash": system["_policy_hash"],
                "policy_url": system["policy_url"],
                "claimed": bool(system.get("claimed")),
                "provider_address": system.get("provider_address"),
                "synthetic": True,
            }
            for system in data["systems"]
        ],
        "incidents": incidents,
        "matched": (
            all(entry["matched"] for entry in incidents) if adjudicate else None
        ),
    }


def _print_text(report: dict[str, Any], *, adjudicate: bool) -> None:
    print("SYNTHETIC DATA — not real incidents")
    print(f"network=sim seed={report['seed']} validators={report['validators']}")
    print(f"contract {report['contract']['address']}")
    for system in report["systems"]:
        print(
            f"  system {system['system_id']}@{system['policy_version']} "
            f"policy={system['policy_hash'][:19]}… "
            f"{'claimed' if system['claimed'] else 'unclaimed'}"
        )
    print()
    for entry in report["incidents"]:
        actual = entry["actual"]
        if actual is None:
            print(f"  {entry['incident_id']}  {entry['key']}  (not adjudicated)")
            continue
        marker = "✔" if entry["matched"] else "✖"
        clauses = ",".join(actual.get("clauses", []))
        print(
            f"  {marker} {entry['incident_id']}  {actual.get('verdict')}  "
            f"{actual.get('severity')}  {actual.get('confidence')}  [{clauses}]"
        )
        if not entry["matched"]:
            print(f"      expected: {json.dumps(entry['expected'], sort_keys=True)}")
            print(f"      actual:   {json.dumps(actual, sort_keys=True)}")
    if adjudicate:
        matched = sum(1 for entry in report["incidents"] if entry["matched"])
        print()
        print(f"{matched}/{len(report['incidents'])} expected verdicts matched")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed the synthetic SafetyNet demo set")
    parser.add_argument("--fixtures", default=str(DEFAULT_FIXTURES))
    parser.add_argument("--contract", default=str(DEFAULT_CONTRACT))
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--validators", type=int, default=DEFAULT_VALIDATORS)
    parser.add_argument("--no-adjudicate", action="store_true")
    parser.add_argument("--network", default="sim")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    if args.network != "sim":
        print(
            "E3001: public-network seeding is not enabled. The seed set is "
            "simulator-only until an allowlisted HTTPS host serves the exact "
            "policy text and the owner approves a permanent synthetic dataset.",
            file=sys.stderr,
        )
        return 4
    try:
        report = run_seed(
            args.fixtures,
            contract=args.contract,
            seed=args.seed,
            validators=args.validators,
            adjudicate=not args.no_adjudicate,
        )
    except SeedError as error:
        print(f"{error.code}: {error.message}", file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        _print_text(report, adjudicate=not args.no_adjudicate)
    if report["matched"] is False:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
