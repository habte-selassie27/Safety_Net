// Demo stand-in for validator clause evaluation.
//
// In chain mode the contract asks independent validators to read each clause
// against the pinned evidence. There is no model in demo mode, so this module
// produces a deterministic clause-finding set and a closed-enum claim
// classifier from the policy text and the claim. The verdict itself is then
// computed by `aggregate()` — the same rules the contract uses — so demo output
// cannot drift from the real decision table (Appendix F, §11.11).
//
// This is not a safety classifier and must never be described as one. Demo
// records carry `synthetic: true` and render the SYNTHETIC badge.

import type { PolicyView, IncidentView } from "../data/types";
import type { ClauseVerdict, ReasonCode } from "./aggregate";

const STOPWORDS = new Set([
  "this",
  "that",
  "with",
  "from",
  "have",
  "been",
  "they",
  "their",
  "which",
  "when",
  "must",
  "should",
  "will",
  "would",
  "into",
  "than",
  "then",
  "there",
  "these",
  "those",
  "such",
  "also",
  "only",
  "more",
  "most",
  "does",
  "doesn",
  "system",
  "policy",
  "synthetic",
]);

const MEDICAL_TERMS = ["dosage", "medication", "prescription", "drug", "clinician"];
const PROTECTED_TERMS = [
  "race",
  "ethnicity",
  "religion",
  "sex",
  "gender",
  "disability",
  "national",
  "origin",
];
const CODE_TERMS = ["sql", "vulnerable", "injection", "shell", "xss", "concatenat"];

/** Lowercase word tokens, plural-folded, stopword-filtered. */
function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .map((word) => (word.length > 4 && word.endsWith("s") ? word.slice(0, -1) : word))
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word));
}

function evidenceText(incident: IncidentView): string {
  return incident.evidence.items
    .map((item) => item.text ?? "")
    .join(" ")
    .trim();
}

/**
 * Produce one finding per clause. Clauses that share at least two content words
 * with the claim plus evidence are treated as implicated; everything else is
 * recorded as not covering the claim. Missing evidence fails closed.
 */
export function demoClauseFindings(
  incident: IncidentView,
  policy: PolicyView | undefined,
): ClauseVerdict[] {
  const clauses = policy?.clauses ?? [];
  if (clauses.length === 0) return [];

  const observed = evidenceText(incident);
  if (!observed) {
    return clauses.map((clause) => ({
      clause_id: clause.id,
      finding: "INSUFFICIENT",
      reason_code: "AMBIGUOUS",
    }));
  }

  const claimTokens = tokens(`${incident.claim} ${observed}`);
  return clauses.map((clause) => {
    const clauseTokens = tokens(`${clause.title} ${clause.text}`);
    const overlap = clauseTokens.filter((word) => claimTokens.includes(word));
    return overlap.length >= 2
      ? {
          clause_id: clause.id,
          finding: "VIOLATED" as const,
          reason_code: "EXPLICIT" as ReasonCode,
        }
      : {
          clause_id: clause.id,
          finding: "COMPLIANT" as const,
          reason_code: "NOT_COVERED" as ReasonCode,
        };
  });
}

/**
 * Claim classifier flags (closed set) used only to pick a deterministic
 * severity floor. Never enters the public verdict object.
 */
export function claimFlags(
  incident: IncidentView,
  policy: PolicyView | undefined,
  findings: readonly ClauseVerdict[],
): string[] {
  const violated = findings
    .filter((item) => item.finding === "VIOLATED")
    .map((item) => item.clause_id);
  const clauseText = (policy?.clauses ?? [])
    .filter((clause) => violated.includes(clause.id))
    .map((clause) => `${clause.title} ${clause.text}`)
    .join(" ");
  const haystack = `${incident.claim} ${evidenceText(incident)} ${clauseText}`.toLowerCase();
  const flags: string[] = [];
  if (MEDICAL_TERMS.some((term) => haystack.includes(term))) flags.push("medical");
  if (PROTECTED_TERMS.some((term) => haystack.includes(term)))
    flags.push("protected_attribute");
  if (CODE_TERMS.some((term) => haystack.includes(term))) flags.push("code_security");
  return flags;
}

/** Deterministic harm signal from the claim text. */
export function allegesHarm(claim: string): boolean {
  return /\b(harm|harmed|injur\w*|damag\w*|loss|lost|unsafe|danger\w*|pain)\b/i.test(
    claim,
  );
}
