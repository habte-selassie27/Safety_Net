// Deterministic verdict aggregation.
//
// This is a 1:1 port of the contract's `_aggregate` (contracts/safetynet.py).
// Validators compare only the output of that function, so the TypeScript and
// Python implementations must agree exactly (§11.11, §14.1, Appendix F).
// The demo store runs the same rules locally instead of inventing a verdict,
// which keeps demo output consistent with what the contract would store.

import type {
  Confidence,
  SafetyNetVerdict,
  Severity,
} from "../data/types";

export type ClauseFinding = "COMPLIANT" | "VIOLATED" | "INSUFFICIENT";
export type ReasonCode = "EXPLICIT" | "IMPLIED" | "NOT_COVERED" | "AMBIGUOUS";

export interface ClauseVerdict {
  clause_id: string;
  finding: ClauseFinding;
  reason_code: ReasonCode;
}

const SEVERITIES: readonly Severity[] = [
  "LOW",
  "MODERATE",
  "SERIOUS",
  "CRITICAL",
];

/** One band down, never below LOW. */
export function downgradeConfidence(confidence: Confidence): Confidence {
  if (confidence === "HIGH") return "MEDIUM";
  if (confidence === "MEDIUM") return "LOW";
  return "LOW";
}

function isSeverity(value: string): value is Severity {
  return (SEVERITIES as readonly string[]).includes(value);
}

function primaryOf(items: readonly ClauseVerdict[]): {
  clauseId: string;
  reasonCode: ReasonCode;
} {
  const notCovered = items.find((item) => item.reason_code === "NOT_COVERED");
  if (notCovered) {
    return { clauseId: notCovered.clause_id, reasonCode: notCovered.reason_code };
  }
  const first = items[0];
  if (first) {
    return { clauseId: first.clause_id, reasonCode: first.reason_code };
  }
  return { clauseId: "", reasonCode: "AMBIGUOUS" };
}

export interface AggregateInput {
  clauseVerdicts: readonly ClauseVerdict[];
  hasDefense: boolean;
  /** Deterministic floor from structured claim flags (§39.7). */
  severityFloor?: Severity;
  harmAlleged?: boolean;
}

export interface AggregateResult {
  verdict: SafetyNetVerdict;
  severity: Severity;
  confidence: Confidence;
  clauses: string[];
  primaryReasonCode: ReasonCode;
}

/**
 * Reduce clause-level findings to the single canonical verdict object.
 *
 * Pure function: no clock, no randomness, no ordering dependence beyond the
 * caller's clause order.
 *
 * @example
 * aggregate({ clauseVerdicts: [{ clause_id: "C1", finding: "VIOLATED",
 *   reason_code: "EXPLICIT" }], hasDefense: true })
 * // → { verdict: "POLICY_VIOLATION", severity: "MODERATE", ... }
 */
export function aggregate(input: AggregateInput): AggregateResult {
  const findings = input.clauseVerdicts;
  const insufficient = findings.some((item) => item.finding === "INSUFFICIENT");
  const violated = findings.filter((item) => item.finding === "VIOLATED");
  const total = findings.length > 0 ? findings.length : 1;

  let confidence: Confidence = "HIGH";
  if (insufficient) confidence = "MEDIUM";
  if (!input.hasDefense) confidence = downgradeConfidence(confidence);

  const floor = input.severityFloor ?? "LOW";

  // Any violated clause: v1 treats every clause as mandatory (§11.11 rule 2).
  if (violated.length >= 1) {
    let severity: Severity = isSeverity(floor) ? floor : "SERIOUS";
    if (severity === "LOW") {
      severity = input.hasDefense ? "MODERATE" : "SERIOUS";
    }
    return {
      verdict: "POLICY_VIOLATION",
      severity,
      confidence,
      clauses: violated.slice(0, 3).map((item) => item.clause_id),
      primaryReasonCode: violated[0]?.reason_code ?? "AMBIGUOUS",
    };
  }

  // Kept for parity with the contract even though the branch above catches it.
  if (violated.length > total / 2) {
    const severity = isSeverity(floor) ? floor : "MODERATE";
    return {
      verdict: "POLICY_VIOLATION",
      severity,
      confidence,
      clauses: violated.slice(0, 3).map((item) => item.clause_id),
      primaryReasonCode: violated[0]?.reason_code ?? "AMBIGUOUS",
    };
  }

  const allCompliant = findings.every((item) => item.finding === "COMPLIANT");
  if (allCompliant) {
    const primary = primaryOf(findings);
    const clauses = primary.clauseId ? [primary.clauseId] : [];
    if (input.harmAlleged) {
      return {
        verdict: "POLICY_ADEQUATE_BUT_HARM",
        severity: "MODERATE",
        confidence,
        clauses,
        primaryReasonCode: primary.reasonCode,
      };
    }
    return {
      verdict: "DISMISSED",
      severity: "LOW",
      confidence,
      clauses,
      primaryReasonCode: primary.reasonCode,
    };
  }

  const primary = primaryOf(
    findings.filter((item) => item.finding === "INSUFFICIENT"),
  );
  return {
    verdict: "INSUFFICIENT_EVIDENCE",
    severity: "LOW",
    confidence: "LOW",
    clauses: primary.clauseId ? [primary.clauseId] : [],
    primaryReasonCode: primary.reasonCode,
  };
}

/**
 * Severity floor from structured claim flags (Appendix G). Never inferred from
 * model output.
 */
export function severityFloorFor(input: {
  flags?: readonly string[];
  hasDefense: boolean;
}): Severity {
  const flags = input.flags ?? [];
  if (flags.includes("protected_attribute")) return "CRITICAL";
  if (flags.includes("medical")) return "SERIOUS";
  if (flags.includes("code_security")) return "SERIOUS";
  if (!input.hasDefense) return "SERIOUS";
  return "LOW";
}
