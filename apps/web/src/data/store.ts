// Local demo store. This is NOT the chain: it lets the public UI exercise the
// filing, response, claim, appeal, and policy-publish flows without a wallet.
// Every record it creates is synthetic and labelled. Chain mode will replace
// this store with @safetynet/client reads/writes.
import { useSyncExternalStore } from "react";

import {
  evidenceHash,
  sha256Text,
  validateClaim,
  validateDefense,
  validateEvidenceManifest,
  validatePolicyVersion,
} from "@safetynet/core/validate";

import { aggregate, severityFloorFor } from "../lib/aggregate";
import {
  allegesHarm,
  claimFlags,
  demoClauseFindings,
} from "../lib/demo-clause-findings";

import {
  APPEAL_WINDOW_HOURS,
  DEMO_ACCOUNT,
  EVIDENCE_ALLOWLIST,
  MAX_APPEALS,
  SEED_INCIDENTS,
  SYSTEMS,
} from "./seed";
import type {
  DemoState,
  EvidenceManifestView,
  IncidentView,
  PolicyGapGroup,
  PolicyView,
  ReporterStatsView,
  ResponseView,
  SystemView,
  VerdictRecord,
} from "./types";

export interface IncidentFilters {
  system?: string;
  verdict?: string;
  severity?: string;
  status?: string;
  query?: string;
}

export interface FileIncidentInput {
  system_id: string;
  policy_version: string;
  claim: string;
  evidence: EvidenceManifestView;
}

export type StoreResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { value: T }))
  | { ok: false; code: string; message: string };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function initialState(): DemoState {
  return {
    incidents: clone(SEED_INCIDENTS),
    systems: clone(SYSTEMS),
    nextIncident: SEED_INCIDENTS.length + 1,
  };
}

export class DemoStore {
  private state: DemoState = initialState();
  private listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): DemoState => this.state;

  private set(state: DemoState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  reset(): void {
    this.set(initialState());
  }

  system(systemId: string): SystemView | undefined {
    return this.state.systems.find((system) => system.system_id === systemId);
  }

  incident(incidentId: string): IncidentView | undefined {
    return this.state.incidents.find(
      (incident) => incident.incident_id === incidentId,
    );
  }

  async fileIncident(input: FileIncidentInput): Promise<StoreResult<string>> {
    const system = this.system(input.system_id);
    if (!system)
      return {
        ok: false,
        code: "UNKNOWN_SYSTEM",
        message: "That AI system isn't registered.",
      };
    const policy = system.policies.find(
      (entry) => entry.version === input.policy_version,
    );
    if (!policy) {
      return {
        ok: false,
        code: "UNKNOWN_POLICY_VERSION",
        message: "That policy version doesn't exist.",
      };
    }
    const claim = validateClaim(input.claim);
    if (!claim.ok)
      return {
        ok: false,
        code: "BAD_CLAIM",
        message: claim.issues[0]?.message ?? "Invalid claim.",
      };
    const manifest = validateEvidenceManifest(input.evidence, {
      allowlist: EVIDENCE_ALLOWLIST,
    });
    if (!manifest.ok) {
      return {
        ok: false,
        code: manifest.issues[0]?.code ?? "BAD_EVIDENCE_MANIFEST",
        message: manifest.issues[0]?.message ?? "Invalid evidence manifest.",
      };
    }
    const hash = await evidenceHash(input.evidence);
    const id = `inc-${String(this.state.nextIncident).padStart(6, "0")}`;
    const now = Date.now();
    const incident: IncidentView = {
      incident_id: id,
      system_id: system.system_id,
      system_name: system.display_name,
      policy_version: policy.version,
      policy_hash: policy.text_hash,
      reporter: DEMO_ACCOUNT,
      claim: input.claim,
      evidence_hash: hash,
      evidence: clone(input.evidence),
      status: "OPEN",
      filed_at: now,
      response_deadline: now + 48 * 3600 * 1000,
      response: null,
      verdict: null,
      appeals: [],
      synthetic: true,
    };
    this.set({
      ...this.state,
      incidents: [incident, ...this.state.incidents],
      nextIncident: this.state.nextIncident + 1,
    });
    return { ok: true, value: id };
  }

  async respond(
    incidentId: string,
    defense: string,
    evidence?: EvidenceManifestView,
    actor: string = DEMO_ACCOUNT,
  ): Promise<StoreResult> {
    const incident = this.incident(incidentId);
    if (!incident)
      return {
        ok: false,
        code: "UNKNOWN_INCIDENT",
        message: "No incident with that id.",
      };
    const system = this.system(incident.system_id);
    if (!system)
      return {
        ok: false,
        code: "UNKNOWN_SYSTEM",
        message: "That AI system isn't registered.",
      };
    if (
      !system.claimed ||
      system.claimed_by.toLowerCase() !== actor.toLowerCase()
    ) {
      return {
        ok: false,
        code: "NOT_PROVIDER",
        message:
          "Only the claimed provider can respond. Claim the system first.",
      };
    }
    if (incident.status !== "OPEN") {
      return {
        ok: false,
        code: "INCIDENT_NOT_OPEN",
        message: "This incident no longer accepts responses.",
      };
    }
    const valid = validateDefense(defense);
    if (!valid.ok) {
      return {
        ok: false,
        code: "BAD_DEFENSE",
        message: valid.issues[0]?.message ?? "Invalid defense.",
      };
    }
    if (evidence) {
      const manifest = validateEvidenceManifest(evidence, {
        allowlist: EVIDENCE_ALLOWLIST,
      });
      if (!manifest.ok) {
        return {
          ok: false,
          code: manifest.issues[0]?.code ?? "BAD_EVIDENCE_MANIFEST",
          message: manifest.issues[0]?.message ?? "Invalid evidence manifest.",
        };
      }
    }
    const hash = evidence ? await evidenceHash(evidence) : "";
    return this.applyResponse(incident, system, defense, evidence, hash, actor);
  }

  private applyResponse(
    incident: IncidentView,
    _system: SystemView,
    defense: string,
    evidence: EvidenceManifestView | undefined,
    evidenceHashValue: string,
    actor: string,
  ): StoreResult {
    const response: ResponseView = {
      incident_id: incident.incident_id,
      provider: actor,
      defense,
      evidence_hash: evidenceHashValue,
      responded_at: Date.now(),
      late: Date.now() > incident.response_deadline,
      response_missing: false,
      ...(evidence ? { evidence: clone(evidence) } : {}),
    };
    this.replaceIncident({ ...incident, response, status: "RESPONDED" });
    return { ok: true };
  }

  appeal(
    incidentId: string,
    reason: string,
    actor: string = DEMO_ACCOUNT,
  ): StoreResult {
    const incident = this.incident(incidentId);
    if (!incident)
      return {
        ok: false,
        code: "UNKNOWN_INCIDENT",
        message: "No incident with that id.",
      };
    if (
      !incident.verdict ||
      (incident.status !== "DECIDED" && incident.status !== "APPEALED")
    ) {
      return {
        ok: false,
        code: "NOT_APPEALABLE",
        message: "Only decided incidents can be appealed.",
      };
    }
    const system = this.system(incident.system_id);
    const provider = system?.claimed ? system.claimed_by.toLowerCase() : "";
    const isReporter = incident.reporter.toLowerCase() === actor.toLowerCase();
    const isProvider = provider === actor.toLowerCase();
    if (!isReporter && !isProvider) {
      return {
        ok: false,
        code: "NOT_APPELLANT",
        message: "Only the reporter or provider can appeal.",
      };
    }
    const windowMs = APPEAL_WINDOW_HOURS * 3600 * 1000;
    if (Date.now() - incident.verdict.ruled_at > windowMs) {
      return {
        ok: false,
        code: "APPEAL_WINDOW_CLOSED",
        message: "The appeal window has closed.",
      };
    }
    if (incident.appeals.length >= MAX_APPEALS) {
      return {
        ok: false,
        code: "APPEAL_LIMIT_REACHED",
        message: "No appeals remaining.",
      };
    }
    if ([...reason].length < 20 || [...reason].length > 500) {
      return {
        ok: false,
        code: "BAD_APPEAL_REASON",
        message: "Appeal reason must be 20–500 characters.",
      };
    }
    const appeal = {
      round: Number(incident.verdict.round) + 1,
      appellant: actor,
      reason,
      prior_verdict: incident.verdict.verdict,
      prior_round: Number(incident.verdict.round),
      created_at: Date.now(),
    };
    this.replaceIncident({
      ...incident,
      appeals: [...incident.appeals, appeal],
      status: "APPEALED",
    });
    return { ok: true };
  }

  adjudicate(incidentId: string): StoreResult<string> {
    const incident = this.incident(incidentId);
    if (!incident)
      return {
        ok: false,
        code: "UNKNOWN_INCIDENT",
        message: "No incident with that id.",
      };
    if (incident.verdict && incident.status !== "APPEALED")
      return {
        ok: false,
        code: "ALREADY_DECIDED",
        message: "This incident already has a verdict for this round.",
      };
    if (
      incident.status !== "OPEN" &&
      incident.status !== "RESPONDED" &&
      incident.status !== "APPEALED"
    )
      return {
        ok: false,
        code: "NOT_ADJUDICABLE",
        message: "This incident can't be adjudicated yet.",
      };
    const system = this.system(incident.system_id);
    const hasDefense = Boolean(incident.response);
    // Demo mode has no model, so a deterministic clause evaluator stands in for
    // validators. The verdict itself comes from the same aggregation rules the
    // contract uses, so demo output cannot invent a decision shape.
    const policy = system?.policies.find(
      (candidate) => candidate.version === incident.policy_version,
    );
    const clauseVerdicts = demoClauseFindings(incident, policy);
    const result = aggregate({
      clauseVerdicts,
      hasDefense,
      severityFloor: severityFloorFor({
        flags: claimFlags(incident, policy, clauseVerdicts),
        hasDefense,
      }),
      harmAlleged: allegesHarm(incident.claim),
    });
    const totalClauses = policy?.clauses.length ?? clauseVerdicts.length;
    const round = incident.appeals.length > 0 ? incident.appeals.length + 1 : 1;
    const verdictRecord: VerdictRecord = {
      incident_id: incident.incident_id,
      verdict: result.verdict,
      severity: result.severity,
      confidence: result.confidence,
      clauses: result.clauses,
      rationale:
        `${result.verdict} for ${system?.display_name ?? incident.system_id} ` +
        `under policy v${incident.policy_version}: ${result.clauses.length} of ` +
        `${totalClauses} clauses cited. Primary clause: ` +
        `${result.clauses[0] ?? "none"} (${result.primaryReasonCode}). ` +
        `Round ${round}.`,
      evidence_hash: incident.evidence_hash,
      policy_hash: incident.policy_hash,
      ruled_at: Date.now(),
      round,
      appeals: incident.appeals.length,
    };
    this.replaceIncident({
      ...incident,
      verdict: verdictRecord,
      status: "DECIDED",
    });
    return { ok: true, value: result.verdict };
  }

  finalize(incidentId: string): StoreResult {
    const incident = this.incident(incidentId);
    if (!incident)
      return {
        ok: false,
        code: "UNKNOWN_INCIDENT",
        message: "No incident with that id.",
      };
    if (!incident.verdict || incident.status !== "DECIDED")
      return {
        ok: false,
        code: "NOT_FINALIZABLE",
        message: "Only decided incidents can be finalized.",
      };
    const windowMs = APPEAL_WINDOW_HOURS * 3600 * 1000;
    if (Date.now() - incident.verdict.ruled_at < windowMs)
      return {
        ok: false,
        code: "APPEAL_WINDOW_OPEN",
        message: "The appeal window is still open.",
      };
    this.replaceIncident({ ...incident, status: "FINAL" });
    return { ok: true };
  }

  registerSystem(input: {
    system_id: string;
    display_name: string;
    provider_id: string;
    policy_version: string;
    policy_text_hash: string;
    clause_ids: string[];
    policy_url: string;
    clauses?: PolicyView["clauses"];
    actor?: string;
  }): StoreResult<string> {
    if (!/^[a-z0-9-]{3,48}$/.test(input.system_id))
      return {
        ok: false,
        code: "BAD_SYSTEM_ID",
        message:
          "System id must be lowercase letters, digits, or hyphens (3–48).",
      };
    if (this.system(input.system_id))
      return {
        ok: false,
        code: "SYSTEM_ALREADY_CLAIMED",
        message: "That system id is already registered.",
      };
    const version = validatePolicyVersion(input.policy_version);
    if (!version.ok)
      return {
        ok: false,
        code: "BAD_POLICY_VERSION",
        message: version.issues[0]?.message ?? "Invalid policy version.",
      };
    if (input.clause_ids.length === 0)
      return {
        ok: false,
        code: "BAD_EVIDENCE_MANIFEST",
        message: "A policy needs at least one clause id.",
      };
    if (!input.policy_text_hash.startsWith("sha256:"))
      return {
        ok: false,
        code: "BAD_POLICY_HASH",
        message: "Policy hash must be a sha256: hash.",
      };

    const now = Date.now();
    const clauseText = new Map(
      (input.clauses ?? []).map((clause) => [clause.id, clause]),
    );
    const policy: PolicyView = {
      system_id: input.system_id,
      version: input.policy_version,
      text_hash: input.policy_text_hash,
      clause_ids: [...input.clause_ids],
      published_at: now,
      effective_at: now,
      url: input.policy_url,
      supersedes: "",
      clauses: input.clause_ids.map((id) =>
        clauseText.has(id)
          ? (clauseText.get(id) as PolicyView["clauses"][number])
          : { id, title: id, text: "", mandatory: false },
      ),
    };
    const system: SystemView = {
      system_id: input.system_id,
      display_name: input.display_name,
      provider_id: input.provider_id,
      policy_key: `${input.system_id}@${input.policy_version}`,
      claimed_by: input.actor ?? "",
      created_at: now,
      claimed: Boolean(input.actor),
      policies: [policy],
      current_policy: input.policy_version,
    };
    this.set({
      ...this.state,
      systems: [...this.state.systems, system],
    });
    return { ok: true, value: input.system_id };
  }

  claimSystem(systemId: string, actor: string = DEMO_ACCOUNT): StoreResult {
    const system = this.system(systemId);
    if (!system)
      return {
        ok: false,
        code: "UNKNOWN_SYSTEM",
        message: "That AI system isn't registered.",
      };
    if (system.claimed) {
      return {
        ok: false,
        code: "SYSTEM_ALREADY_CLAIMED",
        message: "That system is already claimed.",
      };
    }
    this.replaceSystem({ ...system, claimed: true, claimed_by: actor });
    return { ok: true };
  }

  async publishPolicy(
    systemId: string,
    version: string,
    url: string,
    clauses: PolicyView["clauses"],
    supersedes: string,
    actor: string = DEMO_ACCOUNT,
  ): Promise<StoreResult> {
    const system = this.system(systemId);
    if (!system)
      return {
        ok: false,
        code: "UNKNOWN_SYSTEM",
        message: "That AI system isn't registered.",
      };
    if (
      !system.claimed ||
      system.claimed_by.toLowerCase() !== actor.toLowerCase()
    ) {
      return {
        ok: false,
        code: "NOT_PROVIDER",
        message: "Claim the system before publishing a policy.",
      };
    }
    const validVersion = validatePolicyVersion(version);
    if (!validVersion.ok) {
      return {
        ok: false,
        code: "BAD_POLICY_VERSION",
        message: "Use a version like 1.2.0.",
      };
    }
    if (system.policies.some((entry) => entry.version === version)) {
      return {
        ok: false,
        code: "BAD_POLICY_VERSION",
        message: "That version already exists and is immutable.",
      };
    }
    let policyUrl: URL;
    try {
      policyUrl = new URL(url);
    } catch {
      return { ok: false, code: "E2024", message: "Enter a valid policy URL." };
    }
    if (policyUrl.protocol !== "https:" || url.length > 300) {
      return {
        ok: false,
        code: "E2024",
        message: "Policy URL must be https and ≤ 300 characters.",
      };
    }
    if (clauses.length === 0 || clauses.length > 24) {
      return {
        ok: false,
        code: "E2023",
        message: "A policy needs 1–24 clauses.",
      };
    }
    for (const clause of clauses) {
      if (!clause.title.trim()) {
        return {
          ok: false,
          code: "E2020",
          message: `${clause.id} needs a title.`,
        };
      }
      if ([...clause.text].length < 50 || [...clause.text].length > 2000) {
        return {
          ok: false,
          code: "E2022",
          message: `${clause.id} must be 50–2,000 characters and independently checkable.`,
        };
      }
    }
    const ids = clauses.map((entry) => entry.id);
    if (ids.length === 0 || ids.some((id, index) => id !== `C${index + 1}`)) {
      return {
        ok: false,
        code: "E2020",
        message: "Clause ids must be C1..Cn with no gaps.",
      };
    }
    const text = [
      version,
      url,
      ...clauses.map((entry) => `${entry.id} ${entry.title}\n${entry.text}`),
    ].join("\n");
    const textHash = await sha256Text(text);
    const published = Date.now();
    const nextPolicy: PolicyView = {
      system_id: system.system_id,
      version,
      text_hash: textHash,
      clause_ids: ids,
      published_at: published,
      effective_at: published,
      url,
      supersedes,
      clauses: clauses.map((entry) => ({ ...entry })),
    };
    this.replaceSystem({
      ...system,
      policies: [...system.policies, nextPolicy],
      current_policy: version,
      policy_key: `${system.system_id}@${version}`,
    });
    return { ok: true };
  }

  private replaceIncident(next: IncidentView): void {
    this.set({
      ...this.state,
      incidents: this.state.incidents.map((incident) =>
        incident.incident_id === next.incident_id ? next : incident,
      ),
    });
  }

  private replaceSystem(next: SystemView): void {
    this.set({
      ...this.state,
      systems: this.state.systems.map((system) =>
        system.system_id === next.system_id ? next : system,
      ),
    });
  }
}

export const demoStore = new DemoStore();

export function useDemoState(): DemoState {
  return useSyncExternalStore(
    demoStore.subscribe,
    demoStore.getSnapshot,
    demoStore.getSnapshot,
  );
}

// ---------------------------------------------------------------------------
// queries
// ---------------------------------------------------------------------------

export function filterIncidents(
  incidents: IncidentView[],
  filters: IncidentFilters,
): IncidentView[] {
  const query = filters.query?.trim().toLowerCase() ?? "";
  return incidents.filter((incident) => {
    if (filters.system && incident.system_id !== filters.system) return false;
    if (filters.verdict && incident.verdict?.verdict !== filters.verdict)
      return false;
    if (filters.severity && incident.verdict?.severity !== filters.severity)
      return false;
    if (filters.status && incident.status !== filters.status) return false;
    if (query) {
      const haystack = [
        incident.incident_id,
        incident.system_name,
        incident.claim,
        incident.verdict?.verdict ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function policyGaps(state: DemoState): PolicyGapGroup[] {
  const groups = new Map<string, PolicyGapGroup>();
  for (const incident of state.incidents) {
    if (incident.verdict?.verdict !== "POLICY_ADEQUATE_BUT_HARM") continue;
    const system = state.systems.find(
      (entry) => entry.system_id === incident.system_id,
    );
    const policy = system?.policies.find(
      (entry) => entry.version === incident.policy_version,
    );
    for (const clauseId of incident.verdict.clauses) {
      const clause = policy?.clauses.find((entry) => entry.id === clauseId);
      if (!clause) continue;
      const key = `${incident.system_id}|${clauseId}`;
      const group = groups.get(key) ?? {
        system_id: incident.system_id,
        system_name: incident.system_name,
        clause,
        incident_ids: [],
      };
      group.incident_ids.push(incident.incident_id);
      groups.set(key, group);
    }
  }
  return [...groups.values()].sort((a, b) =>
    `${a.system_name}${a.clause.id}`.localeCompare(
      `${b.system_name}${b.clause.id}`,
    ),
  );
}

export function reporterStats(
  incidents: IncidentView[],
  reporter: string,
): ReporterStatsView {
  const mine = incidents.filter(
    (incident) => incident.reporter.toLowerCase() === reporter.toLowerCase(),
  );
  const decided = mine.filter((incident) => incident.verdict);
  return {
    filed: mine.length,
    decided: decided.length,
    violations: decided.filter(
      (incident) => incident.verdict?.verdict === "POLICY_VIOLATION",
    ).length,
    dismissed: decided.filter(
      (incident) => incident.verdict?.verdict === "DISMISSED",
    ).length,
    insufficient: decided.filter(
      (incident) => incident.verdict?.verdict === "INSUFFICIENT_EVIDENCE",
    ).length,
  };
}

export function headlineStats(state: DemoState): {
  incidents: number;
  verdicts: number;
  gaps: number;
  systems: number;
} {
  return {
    incidents: state.incidents.length,
    verdicts: state.incidents.filter((incident) => incident.verdict).length,
    gaps: state.incidents.filter(
      (incident) => incident.verdict?.verdict === "POLICY_ADEQUATE_BUT_HARM",
    ).length,
    systems: state.systems.length,
  };
}

export function verdictDistribution(
  incidents: IncidentView[],
): { verdict: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const incident of incidents) {
    if (!incident.verdict) continue;
    counts.set(
      incident.verdict.verdict,
      (counts.get(incident.verdict.verdict) ?? 0) + 1,
    );
  }
  return [...counts.entries()]
    .map(([verdict, count]) => ({ verdict, count }))
    .sort((a, b) => b.count - a.count || a.verdict.localeCompare(b.verdict));
}

export function verdictFor(incident: IncidentView): VerdictRecord | null {
  return incident.verdict;
}
