// AUTO-GENERATED — do not edit. Regenerate with `snet codegen`.
// Source: contracts/safetynet.py

export const SafetyNetSchemaHash =
  "sha256:48c86427ed8be52e9783500d8de2cea0f4cda803655ecc72e6c6ebd9274d8891";

export type SafetyNetVerdict =
  | "POLICY_VIOLATION"
  | "POLICY_ADEQUATE_BUT_HARM"
  | "INSUFFICIENT_EVIDENCE"
  | "OUT_OF_SCOPE"
  | "DISMISSED";
export type Severity = "LOW" | "MODERATE" | "SERIOUS" | "CRITICAL";
export type Confidence = "LOW" | "MEDIUM" | "HIGH";
export type IncidentStatus =
  | "OPEN"
  | "RESPONDED"
  | "DECIDED"
  | "APPEALED"
  | "FINAL";

export interface SystemRecord {
  system_id: string;
  display_name: string;
  provider_id: string;
  policy_key: string;
  claimed_by: string;
  created_at: number;
}

export interface PolicyRecord {
  system_id: string;
  version: string;
  text_hash: string;
  clause_ids: string[];
  published_at: number;
  effective_at: number;
  url: string;
  supersedes: string;
}

export interface IncidentRecord {
  incident_id: string;
  system_id: string;
  policy_version: string;
  policy_hash: string;
  reporter: string;
  claim: string;
  evidence_hash: string;
  evidence_manifest: string;
  status: IncidentStatus;
  filed_at: number;
  response_deadline: number;
}

export interface ResponseRecord {
  incident_id: string;
  provider: string;
  defense: string;
  evidence_hash: string;
  evidence_manifest: string;
  responded_at: number;
}

export interface VerdictRecord {
  incident_id: string;
  verdict: SafetyNetVerdict;
  severity: Severity;
  confidence: Confidence;
  clauses: string[];
  rationale: string;
  evidence_hash: string;
  policy_hash: string;
  ruled_at: number;
  round: number;
  appeals: number;
}

export interface AppealRecord {
  round: number;
  appellant: string;
  reason: string;
  prior_verdict: string;
  prior_round: number;
  created_at: number;
}

export interface ConfigRecord {
  max_evidence_items: number;
  max_evidence_bytes: number;
  max_policy_clauses: number;
  appeal_window_hours: number;
  max_appeals: number;
  min_provider_response_hours: number;
  evidence_allowlist: string;
}

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

export interface TrackedTx<T> {
  readonly hash: Promise<string>;
  readonly result: Promise<T>;
  on(
    event: "status",
    listener: (event: {
      hash: string;
      status: string;
      elapsedMs: number;
      round?: number;
    }) => void,
  ): () => void;
  cancelPolling(): void;
}

export interface WriteOpts {
  sender?: string;
  wait?: "ACCEPTED" | "FINALIZED";
}

/** Exactly what the chain returns. Views are JSON strings. */
export interface SafetyNetRawAPI {
  read: {
    get_appeals(args: [incident_id: string]): Promise<string>;
    get_config(): Promise<string>;
    get_incident(args: [incident_id: string]): Promise<string>;
    get_incident_count(): Promise<bigint | number>;
    get_policy(args: [system_id: string, version: string]): Promise<string>;
    get_reporter_stats(args: [reporter: string]): Promise<string>;
    get_response(args: [incident_id: string]): Promise<string>;
    get_system(args: [system_id: string]): Promise<string>;
    get_verdict(args: [incident_id: string]): Promise<string>;
    get_verdict_history(args: [incident_id: string]): Promise<string>;
    list_incidents_by_system(args: [system_id: string]): Promise<string>;
  };
  write: {
    adjudicate(
      args: [incident_id: string],
      opts?: WriteOpts,
    ): TrackedTx<string>;
    appeal(
      args: [incident_id: string, reason: string],
      opts?: WriteOpts,
    ): TrackedTx<string>;
    claim_system(
      args: [system_id: string],
      opts?: WriteOpts,
    ): TrackedTx<string>;
    file_incident(
      args: [
        system_id: string,
        policy_version: string,
        claim: string,
        evidence_hash: string,
        evidence_manifest: string,
      ],
      opts?: WriteOpts,
    ): TrackedTx<string>;
    finalize(args: [incident_id: string], opts?: WriteOpts): TrackedTx<string>;
    provider_respond(
      args: [
        incident_id: string,
        defense: string,
        evidence_hash: string,
        evidence_manifest: string,
      ],
      opts?: WriteOpts,
    ): TrackedTx<string>;
    publish_policy(
      args: [
        system_id: string,
        version: string,
        policy_text_hash: string,
        clause_ids: string[],
        policy_url: string,
      ],
      opts?: WriteOpts,
    ): TrackedTx<string>;
    register_system(
      args: [
        system_id: string,
        display_name: string,
        provider_id: string,
        policy_version: string,
        policy_text_hash: string,
        clause_ids: string[],
        policy_url: string,
      ],
      opts?: WriteOpts,
    ): TrackedTx<string>;
  };
}

/** Parsed reads (JSON decoded, empty string -> null/[]). */
export interface SafetyNetAPI {
  read: {
    get_appeals(args: [incident_id: string]): Promise<AppealRecord[]>;
    get_config(): Promise<ConfigRecord>;
    get_incident(args: [incident_id: string]): Promise<IncidentRecord | null>;
    get_incident_count(): Promise<number>;
    get_policy(
      args: [system_id: string, version: string],
    ): Promise<PolicyRecord | null>;
    get_reporter_stats(args: [reporter: string]): Promise<ReporterStats>;
    get_response(args: [incident_id: string]): Promise<ResponseRecord | null>;
    get_system(args: [system_id: string]): Promise<SystemRecord | null>;
    get_verdict(args: [incident_id: string]): Promise<VerdictRecord | null>;
    get_verdict_history(
      args: [incident_id: string],
    ): Promise<VerdictHistoryEntry[]>;
    list_incidents_by_system(args: [system_id: string]): Promise<string[]>;
  };
  write: SafetyNetRawAPI["write"];
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined || raw === "") return fallback;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return raw as T;
}

export const SafetyNetDecoders = {
  get_appeals: (raw: unknown): AppealRecord[] =>
    parseJson<AppealRecord[]>(raw, [] as AppealRecord[]),
  get_config: (raw: unknown): ConfigRecord =>
    parseJson<ConfigRecord>(raw, {} as ConfigRecord),
  get_incident: (raw: unknown): IncidentRecord | null =>
    parseJson<IncidentRecord | null>(raw, null as IncidentRecord | null),
  get_incident_count: (raw: unknown): number => Number(raw ?? 0),
  get_policy: (raw: unknown): PolicyRecord | null =>
    parseJson<PolicyRecord | null>(raw, null as PolicyRecord | null),
  get_reporter_stats: (raw: unknown): ReporterStats =>
    parseJson<ReporterStats>(raw, {} as ReporterStats),
  get_response: (raw: unknown): ResponseRecord | null =>
    parseJson<ResponseRecord | null>(raw, null as ResponseRecord | null),
  get_system: (raw: unknown): SystemRecord | null =>
    parseJson<SystemRecord | null>(raw, null as SystemRecord | null),
  get_verdict: (raw: unknown): VerdictRecord | null =>
    parseJson<VerdictRecord | null>(raw, null as VerdictRecord | null),
  get_verdict_history: (raw: unknown): VerdictHistoryEntry[] =>
    parseJson<VerdictHistoryEntry[]>(raw, [] as VerdictHistoryEntry[]),
  list_incidents_by_system: (raw: unknown): string[] =>
    parseJson<string[]>(raw, [] as string[]),
} satisfies Record<string, (raw: unknown) => unknown>;
