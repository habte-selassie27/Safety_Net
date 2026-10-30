// Address export (GEN-005): deployments/*.json -> generated address constants.
//
// The web app imports the generated module. `requireAddress()` throws if the
// configured network has no deployed address, so the app fails loudly instead
// of calling `undefined` (§20.10, §23.5).

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface DeploymentFile {
  network?: string;
  contracts?: Record<string, { address?: string; status?: string }>;
}

export interface AddressRegistry {
  networks: Record<string, Record<string, string>>;
  registryHash: string;
}

/** Read every deployments/<network>.json and collect contract addresses. */
export function collectAddresses(deploymentsDir: string): AddressRegistry {
  const networks: Record<string, Record<string, string>> = {};
  const hash = createHash("sha256");
  const files = readdirSync(deploymentsDir)
    .filter((name) => name.endsWith(".json") && !name.includes("verification"))
    .sort();

  for (const file of files) {
    const raw = readFileSync(join(deploymentsDir, file), "utf8");
    hash.update(file).update("\0").update(raw);
    const parsed = JSON.parse(raw) as DeploymentFile;
    const network = parsed.network ?? file.replace(/\.json$/, "");
    const contracts = networks[network] ?? {};
    for (const [name, record] of Object.entries(parsed.contracts ?? {})) {
      if (record?.address) contracts[name] = record.address;
    }
    networks[network] = contracts;
  }

  const sorted: Record<string, Record<string, string>> = {};
  for (const network of Object.keys(networks).sort()) {
    const contracts = networks[network] ?? {};
    const sortedContracts: Record<string, string> = {};
    for (const name of Object.keys(contracts).sort()) {
      sortedContracts[name] = contracts[name] as string;
    }
    sorted[network] = sortedContracts;
  }

  return { networks: sorted, registryHash: `sha256:${hash.digest("hex")}` };
}

function envName(network: string, contract: string): string {
  return `SNET_ADDRESS_${contract.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}_${network
    .replace(/[^A-Za-z0-9]/g, "_")
    .toUpperCase()}`;
}

/** Emit a bare property key when valid, otherwise a quoted one. */
function propertyKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

export type AddressFormat = "ts" | "json" | "env";

/** Render a deterministic addresses module for the requested format. */
export function renderAddresses(
  registry: AddressRegistry,
  format: AddressFormat,
): string {
  if (format === "json") {
    return `${JSON.stringify(
      {
        schemaVersion: 1,
        registryHash: registry.registryHash,
        networks: registry.networks,
      },
      null,
      2,
    )}\n`;
  }

  if (format === "env") {
    const lines: string[] = [];
    for (const network of Object.keys(registry.networks)) {
      for (const [contract, address] of Object.entries(
        registry.networks[network] ?? {},
      )) {
        lines.push(`${envName(network, contract)}=${address}`);
      }
    }
    return `${lines.join("\n")}\n`;
  }

  const entries = Object.entries(registry.networks)
    .map(([network, contracts]) => {
      const inner = Object.entries(contracts)
        .map(
          ([name, address]) =>
            `    ${propertyKey(name)}: ${JSON.stringify(address)},`,
        )
        .join("\n");
      return `  ${propertyKey(network)}: {\n${inner}\n  },`;
    })
    .join("\n");

  return `// AUTO-GENERATED — do not edit. Regenerate with \`snet export addresses\`.
// Registry: ${registry.registryHash}

export const addresses = {
${entries}
} as const;

export type NetworkName = keyof typeof addresses;

/**
 * Fail loudly when a network/contract has no recorded deployment.
 * The web app calls this at startup (§20.10).
 */
export function requireAddress(network: string, contract: string): string {
  const contracts = (addresses as Record<string, Record<string, string>>)[
    network
  ];
  const address = contracts?.[contract];
  if (!address) {
    throw new Error(
      \`E7002: no \${contract} address for network "\${network}". Run \\\`snet export addresses\\\` after deploying.\`,
    );
  }
  return address;
}
`;
}

// Public dataset export (API-001/002/003/004, §24.3): incidents, verdicts, and
// policy-gap reports are rendered from the SYNTHETIC seed fixture (SEED-001).
// Claim text and inline evidence are never included — only hashes.

// ---- neutral exports (CLI-018, neutral on public-facing data) ----

export type ExportedVerdict = {
  verdict: string;
  severity: string;
  confidence: string;
  clauses: string[];
  round: number;
  appeals: number;
};

export type ExportedIncident = {
  incidentId: string;
  systemId: string;
  policyVersion: string;
  status: string;
  filedAt: number;
  claimSha256: string;
  evidenceHash: string;
  evidenceKinds: string[];
  synthetic: true;
  verdict: ExportedVerdict | null;
};

export type ExportedPolicyGap = {
  systemId: string;
  clauseId: string;
  gapCount: number;
  exampleIncidentIds: string[];
};

export type PublicDatasetExport = {
  schemaVersion: 1;
  generatedAt: string;
  network: string;
  contract: string;
  synthetic: true;
  policies: {
    systemId: string;
    version: string;
    textHash: string;
    clauseIds: string[];
    clauseCount: number;
    url: string;
  }[];
  incidents: ExportedIncident[];
  verdicts: ExportedVerdict[];
  policyGaps: ExportedPolicyGap[];
};

export type SeedFileShape = {
  schemaVersion: number;
  synthetic: boolean;
  systems: Array<{
    system_id: string;
    display_name: string;
    provider_id: string;
    policy_version: string;
    policy_url: string;
    clause_ids: string[];
    provider_address: string | null;
    claimed: boolean;
  }>;
  incidents: Array<{
    key: string;
    system_id: string;
    policy_version: string;
    reporter: string;
    claim?: string;
    evidence_items: Array<{
      id: string;
      kind: string;
      url?: string;
      text?: string;
      maxChars?: number;
    }>;
    response: unknown;
    clause_findings: Record<string, { finding: string; reason_code: string }>;
    expected_verdict: ExportedVerdict;
  }>;
};

export function loadSeed(filePath: string): SeedFileShape {
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as SeedFileShape;
  if (raw.synthetic !== true) {
    throw new Error("E9000: seed fixture must be marked synthetic");
  }
  return raw;
}

function sha256Text(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

export function buildDatasetExport(
  seedPath: string,
  meta: { network: string; contract: string; generatedAt?: string },
): PublicDatasetExport {
  const seed = loadSeed(seedPath);
  const policies = seed.systems.map((system) => ({
    systemId: system.system_id,
    version: system.policy_version,
    textHash: sha256Text(`${system.system_id}@${system.policy_version}`),
    clauseIds: system.clause_ids,
    clauseCount: system.clause_ids.length,
    url: system.policy_url,
  }));

  const incidents: ExportedIncident[] = [];
  const verdicts: ExportedVerdict[] = [];
  const gapMap = new Map<string, ExportedPolicyGap>();

  const incidentIds = new Map<string, string>();
  seed.incidents.forEach((incident, index) => {
    incidentIds.set(incident.key, `inc-${String(index + 1).padStart(6, "0")}`);
  });

  for (const incident of seed.incidents) {
    const incidentId = incidentIds.get(incident.key) ?? "inc-unknown";
    const verdict = incident.expected_verdict;
    incidents.push({
      incidentId,
      systemId: incident.system_id,
      policyVersion: incident.policy_version,
      status: "FINAL",
      filedAt: 0,
      claimSha256: sha256Text(incident.claim ?? incident.key),
      evidenceHash: sha256Text(incident.key),
      evidenceKinds: incident.evidence_items.map((item) => item.kind),
      synthetic: true,
      verdict,
    });
    verdicts.push(verdict);
    if (verdict.verdict === "POLICY_ADEQUATE_BUT_HARM") {
      const key = `${incident.system_id}:${verdict.clauses[0] ?? "C?"}`;
      const existing = gapMap.get(key);
      if (existing) {
        existing.gapCount += 1;
        existing.exampleIncidentIds.push(incidentId);
      } else {
        gapMap.set(key, {
          systemId: incident.system_id,
          clauseId: verdict.clauses[0] ?? "C?",
          gapCount: 1,
          exampleIncidentIds: [incidentId],
        });
      }
    }
  }

  const policyGaps = [...gapMap.values()].sort((a, b) =>
    a.systemId === b.systemId
      ? a.clauseId.localeCompare(b.clauseId)
      : a.systemId.localeCompare(b.systemId),
  );

  return {
    schemaVersion: 1,
    generatedAt: meta.generatedAt ?? new Date().toISOString(),
    network: meta.network,
    contract: meta.contract,
    synthetic: true,
    policies,
    incidents,
    verdicts,
    policyGaps,
  };
}

export function renderIncidentsExport(dataset: PublicDatasetExport): string {
  return `${JSON.stringify(dataset.incidents, null, 2)}\n`;
}

export function renderVerdictsExport(dataset: PublicDatasetExport): string {
  return `${JSON.stringify(dataset.verdicts, null, 2)}\n`;
}

export function renderPolicyGapsExport(dataset: PublicDatasetExport): string {
  const lines: string[] = [
    "# Policy Gap Report",
    "",
    "Synthetic seed export (SEED-001). Generated by `snet export policy-gaps`.",
    "",
    "| System | Clause | Gap count | Example incidents |",
    "|---|---|---|---|",
  ];
  for (const gap of dataset.policyGaps) {
    lines.push(
      `| ${gap.systemId} | ${gap.clauseId} | ${gap.gapCount} | ${gap.exampleIncidentIds.join(", ")} |`,
    );
  }
  lines.push("", "## Interpretation");
  lines.push(
    "A gap means the clause did not cover the observed harm. Providers should",
  );
  lines.push(
    "consider tightening the clause; readers should treat the clause as insufficient.",
  );
  lines.push("");
  return `${lines.join("\n")}\n`;
}
