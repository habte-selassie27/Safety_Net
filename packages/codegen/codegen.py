"""SafetyNet codegen: contract -> typed TypeScript client.

The contract's view methods return JSON strings, not structs (see
``contracts/safetynet.py``). So the generated module has two layers:

* ``SafetyNetRawAPI``  — exactly what the chain returns (strings/bigint).
* ``SafetyNetAPI``     — parsed records/null/arrays, for app code.
* ``SafetyNetDecoders`` — the parse functions the client applies per method.

Types are extracted from the contract itself (dataclasses + public method
signatures) through the simulator's ``gl`` shim, so a contract change that
alters a param or record field surfaces as a codegen diff. Unknown types are
emitted as ``unknown`` with a loud warning, never guessed.

Usage:
    python packages/codegen/codegen.py [out.ts] [--network studionet]

Exit codes: 0 success, 1 load failure.
"""
from __future__ import annotations

import dataclasses
import hashlib
import inspect
import sys
import typing
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SIM = ROOT / "packages" / "safetynet-sim"
CONTRACT = ROOT / "contracts" / "safetynet.py"

sys.path.insert(0, str(SIM))

WARNINGS: list[str] = []


def warn(message: str) -> None:
    WARNINGS.append(message)
    print(f"⚠ codegen: {message}", file=sys.stderr)


# ---------------------------------------------------------------------------
# type mapping
# ---------------------------------------------------------------------------

SCALARS = {
    "str": "string",
    "bool": "boolean",
    "int": "number",
    "float": "number",
    "u256": "number",
    "i256": "number",
    "Address": "string",
    "None": "void",
    "NoneType": "void",
    "Any": "unknown",
}


def type_name(annotation: object) -> str:
    if annotation is inspect.Parameter.empty:
        return ""
    name = getattr(annotation, "__name__", None)
    if isinstance(name, str):
        return name
    text = str(annotation)
    return text.replace("typing.", "")


def ts_type(annotation: object, context: str, param: str | None = None) -> str:
    """Map a Python annotation to TS. Warn (do not guess) on unknowns."""
    if annotation is inspect.Parameter.empty:
        warn(f"{context}: missing annotation for `{param}` -> unknown")
        return "unknown"

    name = type_name(annotation)
    if name in SCALARS:
        return SCALARS[name]
    if name in {"list", "List", "DynArray"} or name.startswith("DynArray"):
        args = getattr(annotation, "__args__", ())
        if args:
            return f"{ts_type(args[0], context, param)}[]"
        # The contract annotates clause_ids as bare `list`; it is string[].
        if param == "clause_ids":
            return "string[]"
        warn(f"{context}: bare list for `{param}` -> unknown[]")
        return "unknown[]"
    if name in {"dict", "Dict", "TreeMap"} or name.startswith("TreeMap"):
        args = getattr(annotation, "__args__", ())
        if len(args) == 2:
            return f"Record<{ts_type(args[0], context, param)}, {ts_type(args[1], context, param)}>"
        warn(f"{context}: untyped map for `{param}` -> Record<string, unknown>")
        return "Record<string, unknown>"

    warn(f"{context}: unsupported type `{name or annotation}` for `{param}` -> unknown")
    return "unknown"


def quote(values: typing.Iterable[str]) -> str:
    return " | ".join(f'"{value}"' for value in values)


# ---------------------------------------------------------------------------
# extraction
# ---------------------------------------------------------------------------


def load_contract():
    from safetynet_sim.shim import load_contract_class  # local import: needs sys.path

    source = CONTRACT.read_text(encoding="utf-8")
    return load_contract_class(source, str(CONTRACT)), source


def public_methods(cls: type) -> tuple[list[inspect.Signature], list[inspect.Signature]]:
    """Collect public view/write signatures (without `self`)."""
    view_sigs: list[inspect.Signature] = []
    write_sigs: list[inspect.Signature] = []
    for name, member in inspect.getmembers(cls, predicate=inspect.isfunction):
        kind = getattr(member, "__gl_public__", None)
        if kind not in {"view", "write"}:
            continue
        signature = inspect.signature(member)
        signature = signature.replace(
            parameters=[p for p in signature.parameters.values() if p.name != "self"]
        )
        _SIGNATURE_NAMES[id(signature)] = name
        (view_sigs if kind == "view" else write_sigs).append(signature)
    view_sigs.sort(key=lambda s: _SIGNATURE_NAMES[id(s)])
    write_sigs.sort(key=lambda s: _SIGNATURE_NAMES[id(s)])
    return view_sigs, write_sigs


ENUM_FIELDS = {
    "status": "IncidentStatus",
    "verdict": "SafetyNetVerdict",
    "severity": "Severity",
    "confidence": "Confidence",
}


def record_interfaces(module: typing.Any) -> str:
    """Emit one TS interface per contract dataclass, in definition order."""
    classes = []
    for name, obj in module.__dict__.items():
        if isinstance(obj, type) and dataclasses.is_dataclass(obj) and obj.__module__ == module.__name__:
            classes.append((name, obj))
    lines: list[str] = []
    for name, obj in classes:
        try:
            hints = typing.get_type_hints(obj)
        except Exception as error:  # noqa: BLE001  # pragma: no cover - defensive
            warn(f"{name}: could not resolve field types ({error})")
            hints = {}
        lines.append(f"export interface {name} {{")
        for field in dataclasses.fields(obj):
            annotation = hints.get(field.name, field.type)
            mapped = ENUM_FIELDS.get(field.name) or ts_type(annotation, name, field.name)
            lines.append(f"  {field.name}: {mapped};")
        lines.append("}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


# Views whose JSON shape is a record / array / number. Anything else stays raw.
VIEW_RETURNS: dict[str, str] = {
    "get_system": "SystemRecord | null",
    "get_policy": "PolicyRecord | null",
    "get_incident": "IncidentRecord | null",
    "get_response": "ResponseRecord | null",
    "get_verdict": "VerdictRecord | null",
    "get_appeals": "AppealRecord[]",
    "get_verdict_history": "VerdictHistoryEntry[]",
    "get_reporter_stats": "ReporterStats",
    "list_incidents_by_system": "string[]",
    "get_config": "ConfigRecord",
    "get_incident_count": "number",
}

JSON_FALLBACKS: dict[str, str] = {
    "get_system": "null",
    "get_policy": "null",
    "get_incident": "null",
    "get_response": "null",
    "get_verdict": "null",
    "get_appeals": "[]",
    "get_verdict_history": "[]",
    "get_reporter_stats": "{}",
    "list_incidents_by_system": "[]",
    "get_config": "{}",
}

EXTRA_TYPES = '''
export interface ReporterStats {
  filed: number;
  decided: number;
  violations: number;
  dismissed: number;
  insufficient: number;
}

export type VerdictHistoryEntry =
  | {
      round: number;
      verdict: SafetyNetVerdict;
      severity: Severity;
      confidence: Confidence;
      clauses: string[];
      rationale: string;
    }
  | {
      appeal_round: number;
      appellant: string;
      reason: string;
      prior_verdict: SafetyNetVerdict;
      prior_round: number;
    };
'''


def method_args(signature: inspect.Signature, context: str) -> str:
    parts = []
    for param in signature.parameters.values():
        parts.append(f"{param.name}: {ts_type(param.annotation, context, param.name)}")
    return ", ".join(parts)


def args_clause(signature: inspect.Signature, context: str) -> str:
    args = method_args(signature, context)
    return f"args: [{args}]" if args else ""


def render(contract_module: typing.Any, views: list[inspect.Signature], writes: list[inspect.Signature], source_hash: str) -> str:
    enums = contract_module
    verdicts = enums.VERDICTS
    severities = enums.SEVERITIES
    confidences = enums.CONFIDENCES
    statuses = enums.INCIDENT_STATUSES

    out: list[str] = []
    out.append("// AUTO-GENERATED — do not edit. Regenerate with `snet codegen`.")
    out.append("// Source: contracts/safetynet.py")
    out.append("")
    out.append(f"export const SafetyNetSchemaHash = \"{source_hash}\";")
    out.append("")
    out.append(f"export type SafetyNetVerdict = {quote(verdicts)};")
    out.append(f"export type Severity = {quote(severities)};")
    out.append(f"export type Confidence = {quote(confidences)};")
    out.append(f"export type IncidentStatus = {quote(statuses)};")
    out.append("")
    out.append(record_interfaces(contract_module).rstrip())
    out.append("")
    out.append(EXTRA_TYPES.rstrip())
    out.append("")
    out.append('''export interface TrackedTx<T> {
  readonly hash: Promise<string>;
  readonly result: Promise<T>;
  on(event: "status", listener: (event: {
    hash: string;
    status: string;
    elapsedMs: number;
    round?: number;
  }) => void): () => void;
  cancelPolling(): void;
}

export interface WriteOpts {
  sender?: string;
  wait?: "ACCEPTED" | "FINALIZED";
}''')

    # ---- raw API ----
    out.append("")
    out.append("/** Exactly what the chain returns. Views are JSON strings. */")
    out.append("export interface SafetyNetRawAPI {")
    out.append("  read: {")
    for signature in views:
        method = _method_name(views, signature)
        args = args_clause(signature, method)
        ret = "bigint | number" if method == "get_incident_count" else "string"
        out.append(f"    {method}({args}): Promise<{ret}>;")
    out.append("  };")
    out.append("  write: {")
    for signature in writes:
        method = _method_name(writes, signature)
        args = args_clause(signature, method)
        out.append(f"    {method}({args}, opts?: WriteOpts): TrackedTx<string>;")
    out.append("  };")
    out.append("}")

    # ---- parsed API ----
    out.append("")
    out.append("/** Parsed reads (JSON decoded, empty string -> null/[]). */")
    out.append("export interface SafetyNetAPI {")
    out.append("  read: {")
    for signature in views:
        method = _method_name(views, signature)
        args = args_clause(signature, method)
        ret = VIEW_RETURNS.get(method)
        if ret is None:
            ret = "string"
            warn(f"view `{method}` has no JSON shape mapping; typed as string")
        out.append(f"    {method}({args}): Promise<{ret}>;")
    out.append("  };")
    out.append("  write: SafetyNetRawAPI[\"write\"];")
    out.append("}")

    # ---- decoders ----
    out.append("")
    out.append("""function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined || raw === "") return fallback;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return raw as T;
}""")
    out.append("")
    out.append("export const SafetyNetDecoders = {")
    for signature in views:
        method = _method_name(views, signature)
        ret = VIEW_RETURNS.get(method)
        if ret is None:
            continue
        if method == "get_incident_count":
            out.append(f"  {method}: (raw: unknown): number => Number(raw ?? 0),")
            continue
        fallback = JSON_FALLBACKS.get(method, "null")
        out.append(f"  {method}: (raw: unknown): {ret} => parseJson<{ret}>(raw, {fallback} as {ret}),")
    out.append("} satisfies Record<string, (raw: unknown) => unknown>;")
    out.append("")
    return "\n".join(out)


_SIGNATURE_NAMES: dict[int, str] = {}


def _method_name(signatures: list[inspect.Signature], signature: inspect.Signature) -> str:
    """Recover the method name from its signature (kept during extraction)."""
    return _SIGNATURE_NAMES[id(signature)]


def main() -> int:
    args = [arg for arg in sys.argv[1:] if not arg.startswith("--")]
    out_path = Path(args[0]) if args else ROOT / "apps" / "web" / "src" / "generated" / "SafetyNet.ts"
    if not out_path.is_absolute():
        out_path = (Path.cwd() / out_path).resolve()

    if not CONTRACT.exists():
        print(f"✖ codegen: contract not found at {CONTRACT}", file=sys.stderr)
        return 1

    try:
        cls, source = load_contract()
    except Exception as error:  # noqa: BLE001  # pragma: no cover - defensive
        print(f"✖ codegen: could not load contract: {error}", file=sys.stderr)
        return 1

    view_sigs, write_sigs = public_methods(cls)

    normalized = source.replace("\r\n", "\n").rstrip() + "\n"
    source_hash = "sha256:" + hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    module = cls.__sim_module__
    text = render(module, view_sigs, write_sigs, source_hash)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(text.rstrip() + "\n", encoding="utf-8")

    print(f"generated {out_path.relative_to(ROOT) if out_path.is_relative_to(ROOT) else out_path}")
    print(f"  {len(view_sigs)} views, {len(write_sigs)} writes, schema {source_hash[:19]}…")
    if WARNINGS:
        print(f"  {len(WARNINGS)} warning(s) — unknown types emitted as `unknown`", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
