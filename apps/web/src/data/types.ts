// View models for the public database. These mirror the contract's JSON
// records (see apps/web/src/generated/SafetyNet.ts) plus the fields the UI
// needs (system display name, parsed evidence, appeal history).
import type {
  AppealRecord,
  Confidence,
  IncidentStatus,
  PolicyRecord,
  ResponseRecord,
  SafetyNetVerdict,
  Severity,
  SystemRecord,
  VerdictRecord,
} from "../generated/SafetyNet";

export type {
  AppealRecord,
  Confidence,
  IncidentStatus,
  Severity,
  SafetyNetVerdict,
  VerdictRecord,
};

export interface Clause {
  id: string;
  title: string;
  text: string;
  mandatory: boolean;
}

export interface PolicyView extends PolicyRecord {
  clauses: Clause[];
}

export interface SystemView extends SystemRecord {
  claimed: boolean;
  policies: PolicyView[];
  current_policy: string;
}

export interface EvidenceItemView {
  id: string;
  kind: "url" | "inline";
  url?: string;
  text?: string;
  retrievedAt?: string;
  contentSha256: string;
  maxChars: number;
  note?: string;
  /** Set by the simulator/verdict rationale when a URL could not be fetched. */
  unavailable?: boolean;
  tampered?: boolean;
}

export interface EvidenceManifestView {
  schemaVersion: 1;
  items: EvidenceItemView[];
}

export interface ResponseView
  extends Omit<ResponseRecord, "evidence_manifest"> {
  evidence?: EvidenceManifestView;
  late: boolean;
  response_missing: boolean;
}

export interface IncidentView {
  incident_id: string;
  system_id: string;
  system_name: string;
  policy_version: string;
  policy_hash: string;
  reporter: string;
  claim: string;
  evidence_hash: string;
  evidence: EvidenceManifestView;
  status: IncidentStatus;
  filed_at: number;
  response_deadline: number;
  response: ResponseView | null;
  verdict: VerdictRecord | null;
  appeals: AppealRecord[];
  synthetic?: boolean;
}

export interface PolicyGapGroup {
  system_id: string;
  system_name: string;
  clause: Clause;
  incident_ids: string[];
}

export interface ReporterStatsView {
  filed: number;
  decided: number;
  violations: number;
  dismissed: number;
  insufficient: number;
}

export interface DemoState {
  incidents: IncidentView[];
  systems: SystemView[];
  nextIncident: number;
}
