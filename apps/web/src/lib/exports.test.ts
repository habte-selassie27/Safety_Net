import { describe, expect, it } from "vitest";

import { SEED_INCIDENTS, SYSTEMS } from "../data/seed";
import { policyGaps } from "../data/store";
import type { DemoState } from "../data/types";
import { buildDataset, gapReport } from "./exports";

const state: DemoState = {
  incidents: SEED_INCIDENTS,
  systems: SYSTEMS,
  nextIncident: SEED_INCIDENTS.length + 1,
};

const meta = {
  network: "studionet",
  contract: "0x1472fb07454Fca1aC30081aAad659b7adB4A754D",
  generatedAt: "2026-10-28T00:00:00.000Z",
};

describe("public dataset export", () => {
  it("exports hashes and verdicts without claim text or inline evidence", async () => {
    const dataset = await buildDataset(state, meta);
    expect(dataset.schemaVersion).toBe(1);
    expect(dataset.synthetic).toBe(true);
    expect(dataset.counts.incidents).toBe(SEED_INCIDENTS.length);
    expect(dataset.counts.verdicts).toBe(5);
    expect(dataset.counts.systems).toBe(SYSTEMS.length);
    expect(dataset.counts.policyGaps).toBe(1);
    expect(dataset.incidents.map((incident) => incident.incidentId)).toEqual([
      "inc-000001",
      "inc-000002",
      "inc-000003",
      "inc-000004",
      "inc-000005",
      "inc-000006",
    ]);
    for (const incident of dataset.incidents) {
      expect(incident).not.toHaveProperty("claim");
      expect(incident).not.toHaveProperty("evidence");
      expect(incident.claimSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(incident.evidenceHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(incident.evidenceKinds.length).toBeGreaterThan(0);
    }
  });

  it("sorts policies deterministically", async () => {
    const dataset = await buildDataset(state, meta);
    const keys = dataset.policies.map(
      (policy) => `${policy.systemId}@${policy.version}`,
    );
    expect(keys).toEqual([...keys].sort());
    expect(dataset.policies).toHaveLength(4);
  });
});

describe("policy gap report", () => {
  it("renders a synthetic-labelled markdown table", () => {
    const report = gapReport(policyGaps(state), meta);
    expect(report).toContain("SYNTHETIC DEMO DATA");
    expect(report).toContain(
      "| System | Clause | Gap count | Example incident |",
    );
    expect(report).toContain(
      "Synthetic Code Assistant | C4 — Dangerous pattern coverage | 1 | inc-000003",
    );
  });
});
