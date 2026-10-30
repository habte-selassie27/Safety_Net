"""P7 — Deterministic Aggregation (SafetyNet-specific).

Turn many noisy per-clause findings into one stable verdict. Every validator
computes clause findings independently, then runs the SAME pure aggregation
function. Only the aggregate crosses the equivalence boundary. The aggregation
table is versioned and stored in the contract.
"""

from __future__ import annotations

from typing import Any


def aggregate(clause_verdicts: list[dict[str, Any]], *, has_defense: bool = True,
              severity_floor: str = "LOW") -> dict[str, Any]:
    """Pure aggregation. Returns the canonical verdict object (4 fields)."""
    findings = [str(c.get("finding", "INSUFFICIENT")).upper() for c in clause_verdicts]
    violated = [c for c in clause_verdicts if str(c.get("finding", "")).upper() == "VIOLATED"]
    insufficient = any(f == "INSUFFICIENT" for f in findings)

    clauses: list[str] = []
    if violated:
        mandatory = [c for c in violated if c.get("mandatory")]
        if mandatory:
            clauses = sorted({str(c.get("clause_id", "")) for c in mandatory})
            verdict = "POLICY_VIOLATION"
        elif len(violated) > len(clause_verdicts) / 2:
            clauses = sorted({str(c.get("clause_id", "")) for c in violated})[:3]
            verdict = "POLICY_VIOLATION"
        else:
            clauses = sorted({str(c.get("clause_id", "")) for c in violated})[:1]
            verdict = "POLICY_ADEQUATE_BUT_HARM" if True else "DISMISSED"
    elif all(f == "COMPLIANT" for f in findings) and len(findings) > 0:
        verdict = "POLICY_ADEQUATE_BUT_HARM"
        clauses = []
    else:
        verdict = "INSUFFICIENT_EVIDENCE"
        clauses = sorted({str(c.get("clause_id", "")) for c in clause_verdicts
                          if str(c.get("finding", "")).upper() in ("VIOLATED", "INSUFFICIENT")})[:3]

    severity = severity_floor if verdict in ("POLICY_VIOLATION", "POLICY_ADEQUATE_BUT_HARM") else "LOW"
    confidence = "LOW" if insufficient else ("MEDIUM" if not has_defense else "HIGH")
    if len(clauses) > 3:
        clauses = clauses[:3]
    return {
        "verdict": verdict,
        "severity": severity,
        "confidence": confidence,
        "clauses": sorted(set(clauses)),
    }


meta = {
    "id": "P7",
    "name": "Deterministic Aggregation",
    "principle": "strict",
    "tags": ["aggregation", "determinism", "safetynet-core"],
    "summary": "Pure function turns noisy clause findings into one stable verdict.",
}
