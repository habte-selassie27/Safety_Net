// Single source of truth for domain enums. Must match contracts/safetynet.py.
export const VERDICTS = [
  "POLICY_VIOLATION",
  "POLICY_ADEQUATE_BUT_HARM",
  "INSUFFICIENT_EVIDENCE",
  "OUT_OF_SCOPE",
  "DISMISSED",
] as const;
export type Verdict = (typeof VERDICTS)[number];

export const SEVERITIES = ["LOW", "MODERATE", "SERIOUS", "CRITICAL"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CONFIDENCES = ["LOW", "MEDIUM", "HIGH"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const INCIDENT_STATUSES = [
  "OPEN",
  "RESPONDED",
  "DECIDED",
  "APPEALED",
  "FINAL",
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const REASON_CODES = [
  "UNKNOWN_SYSTEM",
  "UNKNOWN_POLICY_VERSION",
  "UNKNOWN_INCIDENT",
  "BAD_SYSTEM_ID",
  "BAD_POLICY_VERSION",
  "BAD_POLICY_HASH",
  "BAD_CLAIM",
  "BAD_EVIDENCE_HASH",
  "BAD_EVIDENCE_MANIFEST",
  "DISALLOWED_EVIDENCE_HOST",
  "REPORTER_RATE_LIMIT",
  "DUPLICATE_INCIDENT",
  "SYSTEM_ALREADY_CLAIMED",
  "NOT_PROVIDER",
  "INCIDENT_NOT_OPEN",
  "BAD_DEFENSE",
  "NOT_ADJUDICABLE",
  "ALREADY_DECIDED",
  "POLICY_DRIFT",
  "NOT_APPEALABLE",
  "NOT_APPELLANT",
  "APPEAL_WINDOW_CLOSED",
  "APPEAL_WINDOW_OPEN",
  "APPEAL_LIMIT_REACHED",
  "BAD_APPEAL_REASON",
  "EVIDENCE_FETCH_FAILED",
  "EVIDENCE_TOO_LARGE",
  "LLM_OUTPUT_INVALID",
  "CONSENSUS_UNDETERMINED",
  // Constructor domain config outside the hard bounds (AGENTS.md §11.4).
  "E3004",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export interface ConfigRecord {
  maxEvidenceItems: number;
  maxEvidenceBytes: number;
  maxPolicyClauses: number;
  appealWindowHours: number;
  maxAppeals: number;
  minProviderResponseHours: number;
  evidenceAllowlist: string;
}
