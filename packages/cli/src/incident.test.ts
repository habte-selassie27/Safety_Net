import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createIncident,
  evidenceManifestHash,
  incidentHash,
  parseAllowlist,
  sha256Hex,
  validateIncident,
  writeIncidentBundle,
} from "./incident";

const ALLOWLIST = ["example.com", "raw.githubusercontent.com"];

function manifest(
  text = "SYNTHETIC TRANSCRIPT: 'Take 4000mg of DrugX every hour.'",
) {
  return {
    schemaVersion: 1 as const,
    items: [
      {
        id: "e1",
        kind: "inline" as const,
        text,
        contentSha256: sha256Hex(text),
        maxChars: 2000,
      },
    ],
  };
}

function validInput() {
  return {
    systemId: "synthetic-chatbot-1",
    policyVersion: "1.0.0",
    claim:
      "SYNTHETIC: the assistant gave a specific prescription dosage despite clause C1.",
    manifest: manifest(),
    allowlist: ALLOWLIST,
  };
}

function codes(result: ReturnType<typeof validateIncident>): string[] {
  return result.issues.map((issue) => issue.code);
}

describe("incident validation", () => {
  it("creates a canonical, self-contained incident", () => {
    const result = createIncident(validInput());
    expect(result.ok).toBe(true);
    expect(result.incident?.evidence_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.incident?.incident_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    const parsed = JSON.parse(result.incident?.canonical_manifest_json ?? "{}");
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.items[0].contentSha256).toBe(
      sha256Hex(manifest().items[0]?.text as string),
    );
  });

  it("accepts a file without derived hashes and normalizes it", () => {
    const created = createIncident(validInput());
    const raw = {
      schemaVersion: 1,
      system_id: "synthetic-chatbot-1",
      policy_version: "1.0.0",
      claim:
        "SYNTHETIC: the assistant gave a specific prescription dosage despite clause C1.",
      evidence_manifest: manifest(),
    };
    const result = validateIncident(raw, { allowlist: ALLOWLIST });
    expect(result.ok).toBe(true);
    expect(result.incident?.evidence_hash).toBe(
      created.incident?.evidence_hash,
    );
    expect(result.incident?.incident_hash).toBe(
      created.incident?.incident_hash,
    );
  });

  it("rejects a mismatched evidence hash", () => {
    const created = createIncident(validInput());
    const raw = {
      ...(created.incident as unknown as Record<string, unknown>),
      evidence_hash: `sha256:${"0".repeat(64)}`,
    };
    const result = validateIncident(raw, { allowlist: ALLOWLIST });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("E2006");
  });

  it("rejects unknown top-level keys", () => {
    const created = createIncident(validInput());
    const result = validateIncident(
      { ...created.incident, extra: true },
      { allowlist: ALLOWLIST },
    );
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("E2012");
  });

  it("rejects evidence URLs outside the allowlist and non-https URLs", () => {
    const makeBad = (url: string) => ({
      schemaVersion: 1,
      items: [
        {
          id: "e1",
          kind: "url",
          url,
          contentSha256: `sha256:${"a".repeat(64)}`,
          maxChars: 2000,
        },
      ],
    });
    const http = createIncident({
      ...validInput(),
      manifest: makeBad("http://169.254.169.254/latest/meta-data"),
    });
    expect(http.ok).toBe(false);
    expect(codes(http)).toContain("E2014");

    const privateHost = createIncident({
      ...validInput(),
      manifest: makeBad("https://169.254.169.254/latest/meta-data"),
    });
    expect(privateHost.ok).toBe(false);
    expect(codes(privateHost)).toContain("E2013");
  });

  it("warns about likely PII but still creates the incident", () => {
    const result = createIncident({
      ...validInput(),
      claim:
        "SYNTHETIC: contact jane@example.com about the dosage the assistant provided.",
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.map((warning) => warning.code)).toContain("E2004");
  });

  it("parses allowlists from the environment", () => {
    const previous = process.env.SNET_EVIDENCE_ALLOWLIST;
    process.env.SNET_EVIDENCE_ALLOWLIST = "example.com, *.example.org";
    try {
      expect(parseAllowlist()).toEqual(["example.com", "*.example.org"]);
    } finally {
      if (previous === undefined) {
        Reflect.deleteProperty(process.env, "SNET_EVIDENCE_ALLOWLIST");
      } else {
        process.env.SNET_EVIDENCE_ALLOWLIST = previous;
      }
    }
  });

  it("hashes are stable and recomputable from the manifest", () => {
    const created = createIncident(validInput());
    expect(created.incident).toBeDefined();
    const incident = created.incident as NonNullable<typeof created.incident>;
    expect(evidenceManifestHash(incident.evidence_manifest)).toBe(
      incident.evidence_hash,
    );
    expect(
      incidentHash({
        schemaVersion: incident.schemaVersion,
        system_id: incident.system_id,
        policy_version: incident.policy_version,
        claim: incident.claim,
        evidence_manifest: incident.evidence_manifest,
      }),
    ).toBe(incident.incident_hash);
  });

  it("writes a bundle directory without fetching evidence", () => {
    const created = createIncident(validInput());
    const out = mkdtempSync(join(tmpdir(), "snet-bundle-"));
    const result = writeIncidentBundle(
      created.incident as NonNullable<typeof created.incident>,
      out,
    );
    expect(result.files).toEqual([
      "incident.json",
      "manifest.json",
      "hashes.json",
      "README.txt",
    ]);
    const incident = JSON.parse(
      readFileSync(join(out, "incident.json"), "utf8"),
    );
    expect(incident.evidence_hash).toBe(created.incident?.evidence_hash);
    const hashes = JSON.parse(readFileSync(join(out, "hashes.json"), "utf8"));
    expect(hashes.evidence_hash).toBe(created.incident?.evidence_hash);
  });
});
