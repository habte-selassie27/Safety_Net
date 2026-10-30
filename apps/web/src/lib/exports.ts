// Public dataset export. Mirrors the shape in AGENTS.md §24.3: hashes and
// verdicts only, with claim text and inline evidence excluded by default.
import { sha256Text } from "@safetynet/core/validate";

import type { DemoState, PolicyGapGroup } from "../data/types";

export interface DatasetMeta {
  network: string;
  contract: string;
  generatedAt?: string;
}

export interface PublicIncidentExport {
  incidentId: string;
  systemId: string;
  policyVersion: string;
  policyHash: string;
  status: string;
  filedAt: number;
  claimSha256: string;
  evidenceHash: string;
  evidenceKinds: string[];
  synthetic: true;
  verdict: {
    verdict: string;
    severity: string;
    confidence: string;
    clauses: string[];
    rationale: string;
    round: number;
    appeals: number;
    ruledAt: number;
  } | null;
}

export interface PublicDatasetExport {
  schemaVersion: 1;
  generatedAt: string;
  network: string;
  contract: string;
  synthetic: true;
  counts: {
    incidents: number;
    verdicts: number;
    systems: number;
    policyGaps: number;
  };
  policies: {
    systemId: string;
    version: string;
    textHash: string;
    clauseIds: string[];
    clauseCount: number;
    url: string;
  }[];
  incidents: PublicIncidentExport[];
}

/** Deterministic, hashes-only export of the public record. */
export async function buildDataset(
  state: DemoState,
  meta: DatasetMeta,
): Promise<PublicDatasetExport> {
  const incidents: PublicIncidentExport[] = [];
  for (const incident of [...state.incidents].sort((a, b) =>
    a.incident_id.localeCompare(b.incident_id),
  )) {
    incidents.push({
      incidentId: incident.incident_id,
      systemId: incident.system_id,
      policyVersion: incident.policy_version,
      policyHash: incident.policy_hash,
      status: incident.status,
      filedAt: incident.filed_at,
      claimSha256: await sha256Text(incident.claim),
      evidenceHash: incident.evidence_hash,
      evidenceKinds: incident.evidence.items.map((item) => item.kind),
      synthetic: true,
      verdict: incident.verdict
        ? {
            verdict: incident.verdict.verdict,
            severity: incident.verdict.severity,
            confidence: incident.verdict.confidence,
            clauses: [...incident.verdict.clauses].sort(),
            rationale: incident.verdict.rationale,
            round: incident.verdict.round,
            appeals: incident.verdict.appeals,
            ruledAt: incident.verdict.ruled_at,
          }
        : null,
    });
  }

  const policies = state.systems
    .flatMap((system) =>
      system.policies.map((policy) => ({
        systemId: policy.system_id,
        version: policy.version,
        textHash: policy.text_hash,
        clauseIds: [...policy.clause_ids],
        clauseCount: policy.clauses.length,
        url: policy.url,
      })),
    )
    .sort((a, b) =>
      `${a.systemId}@${a.version}`.localeCompare(`${b.systemId}@${b.version}`),
    );

  return {
    schemaVersion: 1,
    generatedAt: meta.generatedAt ?? new Date().toISOString(),
    network: meta.network,
    contract: meta.contract,
    synthetic: true,
    counts: {
      incidents: incidents.length,
      verdicts: incidents.filter((incident) => incident.verdict).length,
      systems: state.systems.length,
      policyGaps: incidents.filter(
        (incident) => incident.verdict?.verdict === "POLICY_ADEQUATE_BUT_HARM",
      ).length,
    },
    policies,
    incidents,
  };
}

/** Human-readable policy gap report (AGENTS.md §24.4). */
export function gapReport(groups: PolicyGapGroup[], meta: DatasetMeta): string {
  const lines = [
    "# Policy Gap Report — SafetyNet",
    "",
    `Generated: ${meta.generatedAt ?? new Date().toISOString()}`,
    `Network: ${meta.network}`,
    `Contract: ${meta.contract}`,
    "",
    "SYNTHETIC DEMO DATA. These are illustrative records, not real incidents.",
    "",
    "Incidents where the AI system complied with its own policy but harm still occurred.",
    "",
    "| System | Clause | Gap count | Example incident |",
    "|---|---|---|---|",
  ];
  for (const group of groups) {
    lines.push(
      `| ${group.system_name} | ${group.clause.id} — ${group.clause.title} | ${group.incident_ids.length} | ${group.incident_ids[0]} |`,
    );
  }
  lines.push(
    "",
    "## Interpretation",
    "",
    "A gap means the clause did not cover the observed harm. Providers should consider",
    "tightening the clause; readers should treat the clause as insufficient.",
    "",
  );
  return lines.join("\n");
}

/** Trigger a browser download without any dependency. */
export function downloadText(name: string, text: string, type: string): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
