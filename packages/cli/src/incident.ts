// Incident file validation and hashing (CLI-010).
//
// The on-chain contract stores an evidence manifest plus a sha256 hash. This
// module builds the same canonical bundle locally so a reporter can inspect and
// validate it before paying for a transaction. It never fetches evidence URLs.

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJson } from "@safetynet/core";
import {
  type EvidenceManifest,
  type ValidationIssue,
  detectPii,
  validateClaim,
  validateEvidenceManifest,
  validatePolicyVersion,
  validateSystemId,
} from "@safetynet/core/validate";

export const INCIDENT_SCHEMA_VERSION = 1;

/** Default matches the current studionet deployment allowlist. Override with SNET_EVIDENCE_ALLOWLIST. */
export const DEFAULT_EVIDENCE_ALLOWLIST = [
  "example.com",
  "raw.githubusercontent.com",
];

const ALLOWED_KEYS = new Set([
  "schemaVersion",
  "system_id",
  "policy_version",
  "claim",
  "evidence_manifest",
  "evidence_hash",
  "canonical_manifest_json",
  "incident_hash",
  "synthetic",
]);

export interface IncidentFile {
  schemaVersion: number;
  system_id: string;
  policy_version: string;
  claim: string;
  evidence_manifest: EvidenceManifest;
  evidence_hash: string;
  canonical_manifest_json: string;
  incident_hash: string;
  synthetic?: boolean;
}

export interface IncidentValidation {
  ok: boolean;
  issues: ValidationIssue[];
  warnings: ValidationIssue[];
  incident?: IncidentFile;
}

function issue(code: string, message: string, path?: string): ValidationIssue {
  return path ? { code, message, path } : { code, message };
}

export function parseAllowlist(value?: string): string[] {
  const raw = value ?? process.env.SNET_EVIDENCE_ALLOWLIST;
  if (!raw) return [...DEFAULT_EVIDENCE_ALLOWLIST];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function sha256Hex(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

/** Hash the incident fields, excluding the derived hash fields themselves. */
export function incidentHash(incident: {
  schemaVersion: number;
  system_id: string;
  policy_version: string;
  claim: string;
  evidence_manifest: EvidenceManifest;
  synthetic?: boolean;
}): string {
  return sha256Hex(
    canonicalJson({
      schemaVersion: incident.schemaVersion,
      system_id: incident.system_id,
      policy_version: incident.policy_version,
      claim: incident.claim,
      evidence_manifest: incident.evidence_manifest,
      ...(incident.synthetic !== undefined
        ? { synthetic: incident.synthetic }
        : {}),
    }),
  );
}

export function evidenceManifestHash(manifest: EvidenceManifest): string {
  return sha256Hex(canonicalJson(manifest));
}

function normalizeManifest(raw: unknown): EvidenceManifest {
  return raw as EvidenceManifest;
}

export interface CreateIncidentInput {
  systemId: string;
  policyVersion: string;
  claim: string;
  manifest: unknown;
  synthetic?: boolean;
  allowlist?: string[];
}

/**
 * Validate and canonicalize an incident. The evidence manifest is embedded, so
 * the output file is self-contained and can be hashed by anyone.
 */
export function createIncident(input: CreateIncidentInput): {
  ok: boolean;
  issues: ValidationIssue[];
  warnings: ValidationIssue[];
  incident?: IncidentFile;
} {
  const issues: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  for (const check of [
    validateSystemId(input.systemId),
    validatePolicyVersion(input.policyVersion),
    validateClaim(input.claim),
  ]) {
    if (!check.ok) issues.push(...check.issues);
  }
  const manifest = normalizeManifest(input.manifest);
  const manifestCheck = validateEvidenceManifest(manifest, {
    allowlist: input.allowlist ?? parseAllowlist(),
  });
  if (!manifestCheck.ok) issues.push(...manifestCheck.issues);
  const hits = detectPii(input.claim);
  if (hits.length > 0) {
    warnings.push(
      issue(
        "E2004",
        `Claim contains possible PII (${hits
          .map((hit) => hit.kind)
          .join(
            ", ",
          )}). Remove names, emails, handles, and phone numbers unless necessary.`,
        "claim",
      ),
    );
  }
  if (issues.length > 0) return { ok: false, issues, warnings };
  const manifestJson = canonicalJson(manifest);
  const evidenceHash = evidenceManifestHash(manifest);
  const base = {
    schemaVersion: INCIDENT_SCHEMA_VERSION,
    system_id: input.systemId,
    policy_version: input.policyVersion,
    claim: input.claim,
    evidence_manifest: manifest,
    ...(input.synthetic !== undefined ? { synthetic: input.synthetic } : {}),
  };
  const incident: IncidentFile = {
    ...base,
    evidence_hash: evidenceHash,
    canonical_manifest_json: manifestJson,
    incident_hash: incidentHash(base),
  };
  return { ok: true, issues: [], warnings, incident };
}

/**
 * Validate an incident object. Missing derived hashes are tolerated, but a
 * present hash must match the canonical content exactly.
 */
export function validateIncident(
  raw: unknown,
  options: { allowlist?: string[] } = {},
): IncidentValidation {
  const issues: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      issues: [issue("E2012", "Incident file must be a JSON object.")],
      warnings,
    };
  }
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_KEYS.has(key)) {
      issues.push(
        issue("E2012", `Unknown incident key "${key}".`, `incident.${key}`),
      );
    }
  }
  if (record.schemaVersion !== INCIDENT_SCHEMA_VERSION) {
    issues.push(
      issue(
        "E2012",
        `schemaVersion must be ${INCIDENT_SCHEMA_VERSION}.`,
        "schemaVersion",
      ),
    );
  }
  const systemId = typeof record.system_id === "string" ? record.system_id : "";
  const policyVersion =
    typeof record.policy_version === "string" ? record.policy_version : "";
  const claim = typeof record.claim === "string" ? record.claim : "";
  for (const check of [
    validateSystemId(systemId),
    validatePolicyVersion(policyVersion),
    validateClaim(claim),
  ]) {
    if (!check.ok) issues.push(...check.issues);
  }
  if (record.synthetic !== undefined && typeof record.synthetic !== "boolean") {
    issues.push(issue("E2012", "synthetic must be a boolean.", "synthetic"));
  }
  const manifest = normalizeManifest(record.evidence_manifest);
  const manifestCheck = validateEvidenceManifest(manifest, {
    allowlist: options.allowlist ?? parseAllowlist(),
  });
  if (!manifestCheck.ok) issues.push(...manifestCheck.issues);
  const hits = detectPii(claim);
  if (hits.length > 0) {
    warnings.push(
      issue(
        "E2004",
        `Claim contains possible PII (${hits
          .map((hit) => hit.kind)
          .join(
            ", ",
          )}). Remove names, emails, handles, and phone numbers unless necessary.`,
        "claim",
      ),
    );
  }
  const manifestUsable =
    manifestCheck.ok &&
    manifest !== null &&
    typeof manifest === "object" &&
    !Array.isArray(manifest);
  const manifestJson = manifestUsable ? canonicalJson(manifest) : "";
  const computedEvidenceHash = manifestUsable
    ? evidenceManifestHash(manifest)
    : "";
  if (
    manifestUsable &&
    record.evidence_hash !== undefined &&
    record.evidence_hash !== computedEvidenceHash
  ) {
    issues.push(
      issue(
        "E2006",
        "evidence_hash does not match the canonical manifest.",
        "evidence_hash",
      ),
    );
  }
  if (
    manifestUsable &&
    record.canonical_manifest_json !== undefined &&
    record.canonical_manifest_json !== manifestJson
  ) {
    issues.push(
      issue(
        "E2012",
        "canonical_manifest_json does not match the canonical manifest.",
        "canonical_manifest_json",
      ),
    );
  }
  const base = {
    schemaVersion: INCIDENT_SCHEMA_VERSION,
    system_id: systemId,
    policy_version: policyVersion,
    claim,
    evidence_manifest: manifest,
    ...(record.synthetic !== undefined
      ? { synthetic: record.synthetic as boolean }
      : {}),
  };
  const computedIncidentHash = manifestUsable ? incidentHash(base) : "";
  if (
    manifestUsable &&
    record.incident_hash !== undefined &&
    record.incident_hash !== computedIncidentHash
  ) {
    issues.push(
      issue(
        "E2006",
        "incident_hash does not match the canonical incident.",
        "incident_hash",
      ),
    );
  }
  if (issues.length > 0) return { ok: false, issues, warnings };
  return {
    ok: true,
    issues: [],
    warnings,
    incident: {
      ...base,
      evidence_hash: computedEvidenceHash,
      canonical_manifest_json: manifestJson,
      incident_hash: computedIncidentHash,
    },
  };
}

export function renderIncidentJson(incident: IncidentFile): string {
  return `${JSON.stringify(incident, null, 2)}\n`;
}

/**
 * Write a self-contained bundle directory. URL evidence is referenced, not
 * fetched or copied; inline evidence is already in the manifest.
 */
export function writeIncidentBundle(
  incident: IncidentFile,
  outDir: string,
): { files: string[] } {
  mkdirSync(outDir, { recursive: true });
  const files = ["incident.json", "manifest.json", "hashes.json", "README.txt"];
  writeFileSync(
    join(outDir, "incident.json"),
    renderIncidentJson(incident),
    "utf8",
  );
  writeFileSync(
    join(outDir, "manifest.json"),
    `${JSON.stringify(incident.evidence_manifest, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    join(outDir, "hashes.json"),
    `${JSON.stringify(
      {
        evidence_hash: incident.evidence_hash,
        incident_hash: incident.incident_hash,
        canonical_manifest_sha256: evidenceManifestHash(
          incident.evidence_manifest,
        ),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  writeFileSync(
    join(outDir, "README.txt"),
    [
      "SafetyNet incident bundle",
      "",
      "This directory is self-contained. URL evidence is referenced by URL and",
      "hash only; no remote content was fetched. Inline evidence is public and",
      "permanent once filed on-chain. Do not add personal data that is not",
      "necessary to the claim.",
      "",
    ].join("\n"),
    "utf8",
  );
  return { files };
}
