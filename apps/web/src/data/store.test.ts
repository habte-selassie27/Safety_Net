import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_ACCOUNT, SEED_INCIDENTS, SYSTEMS } from "./seed";
import { DemoStore, filterIncidents, policyGaps, reporterStats } from "./store";
import type { EvidenceManifestView } from "./types";

const CHATBOT_PROVIDER = SYSTEMS.find(
  (system) => system.system_id === "synthetic-chatbot-1",
)?.claimed_by as string;

function inlineEvidence(text: string): EvidenceManifestView {
  return {
    schemaVersion: 1,
    items: [
      {
        id: "e1",
        kind: "inline",
        text,
        contentSha256: `sha256:${"a".repeat(64)}`,
        maxChars: 2000,
      },
    ],
  };
}

let store: DemoStore;

beforeEach(() => {
  store = new DemoStore();
});

describe("DemoStore filing", () => {
  it("starts from the synthetic seed set", () => {
    expect(store.getSnapshot().incidents).toHaveLength(SEED_INCIDENTS.length);
    expect(store.getSnapshot().systems).toHaveLength(SYSTEMS.length);
    expect(store.getSnapshot().nextIncident).toBe(SEED_INCIDENTS.length + 1);
  });

  it("files a synthetic incident with a canonical evidence hash", async () => {
    const result = await store.fileIncident({
      system_id: "synthetic-chatbot-1",
      policy_version: "1.0.0",
      claim:
        "SYNTHETIC: The assistant gave a prescription dosage after the policy banned it.",
      evidence: inlineEvidence("SYNTHETIC: take 4000mg every hour."),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe("inc-000007");
    const incident = store.incident(result.value);
    expect(incident?.status).toBe("OPEN");
    expect(incident?.synthetic).toBe(true);
    expect(incident?.reporter).toBe(DEMO_ACCOUNT);
    expect(incident?.evidence_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(incident?.response_deadline).toBeGreaterThan(
      incident?.filed_at ?? 0,
    );
  });

  it("rejects unknown systems, unknown policy versions, and short claims", async () => {
    const base = {
      system_id: "synthetic-chatbot-1",
      policy_version: "1.0.0",
      claim: "SYNTHETIC: enough characters to pass the minimum.",
      evidence: inlineEvidence("SYNTHETIC evidence."),
    };
    expect(
      (await store.fileIncident({ ...base, system_id: "missing" })).ok,
    ).toBe(false);
    expect(
      (await store.fileIncident({ ...base, policy_version: "9.9.9" })).ok,
    ).toBe(false);
    const short = await store.fileIncident({ ...base, claim: "too short" });
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.code).toBe("BAD_CLAIM");
  });

  it("rejects an evidence URL outside the allowlist", async () => {
    const result = await store.fileIncident({
      system_id: "synthetic-chatbot-1",
      policy_version: "1.0.0",
      claim: "SYNTHETIC: the assistant gave a dosage instruction.",
      evidence: {
        schemaVersion: 1,
        items: [
          {
            id: "e1",
            kind: "url",
            url: "https://127.0.0.1/transcript",
            contentSha256: `sha256:${"a".repeat(64)}`,
            maxChars: 4000,
          },
        ],
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("E2013");
  });
});

describe("DemoStore provider actions", () => {
  it("only lets the claimed provider respond", async () => {
    const wrong = await store.respond(
      "inc-000006",
      "We are investigating the refusal path and will publish an update.",
      undefined,
      DEMO_ACCOUNT,
    );
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.code).toBe("NOT_PROVIDER");

    const right = await store.respond(
      "inc-000006",
      "We are investigating the refusal path and will publish an update.",
      undefined,
      CHATBOT_PROVIDER,
    );
    expect(right.ok).toBe(true);
    expect(store.incident("inc-000006")?.status).toBe("RESPONDED");
    expect(store.incident("inc-000006")?.response?.provider).toBe(
      CHATBOT_PROVIDER,
    );
  });

  it("rejects a late response once the incident is decided", async () => {
    const result = await store.respond(
      "inc-000001",
      "This incident is already decided, so this defense must be rejected.",
      undefined,
      CHATBOT_PROVIDER,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INCIDENT_NOT_OPEN");
  });

  it("appeals once within the window and then enforces the limit", () => {
    const reason =
      "The transcript retention log now exists and should be considered.";
    const first = store.appeal("inc-000005", reason, CHATBOT_PROVIDER);
    expect(first.ok).toBe(true);
    expect(store.incident("inc-000005")?.status).toBe("APPEALED");
    expect(store.incident("inc-000005")?.appeals).toHaveLength(1);

    const second = store.appeal("inc-000005", reason, CHATBOT_PROVIDER);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("APPEAL_LIMIT_REACHED");
  });

  it("rejects an appeal from an unrelated address", () => {
    const result = store.appeal(
      "inc-000005",
      "An unrelated address should not be able to request another round.",
      `0x${"f".repeat(40)}`,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_APPELLANT");
  });

  it("claims an unclaimed system, then publishes an immutable policy version", async () => {
    const claimed = store.claimSystem("synthetic-codegen-1");
    expect(claimed.ok).toBe(true);
    expect(store.system("synthetic-codegen-1")?.claimed).toBe(true);
    expect(store.claimSystem("synthetic-chatbot-1").ok).toBe(false);

    const clauses = [
      {
        id: "C1",
        title: "SQL construction",
        text: "The system must not emit SQL built by concatenating untrusted user input into a query string.",
        mandatory: true,
      },
      {
        id: "C2",
        title: "Disclosure",
        text: "The system must disclose when it is uncertain and must not assert confidence it cannot support.",
        mandatory: false,
      },
    ];
    const published = await store.publishPolicy(
      "synthetic-codegen-1",
      "1.1.0",
      "https://example.com/codegen-policy-1.1.0",
      clauses,
      "1.0.0",
    );
    expect(published.ok).toBe(true);
    const system = store.system("synthetic-codegen-1");
    expect(system?.current_policy).toBe("1.1.0");
    expect(system?.policies).toHaveLength(2);
    expect(system?.policies[1]?.text_hash).toMatch(/^sha256:[0-9a-f]{64}$/);

    const duplicate = await store.publishPolicy(
      "synthetic-codegen-1",
      "1.1.0",
      "https://example.com/again",
      clauses,
      "1.0.0",
    );
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.code).toBe("BAD_POLICY_VERSION");

    const invalidClauses = [{ ...clauses[0], text: "too short" }];
    const invalid = await store.publishPolicy(
      "synthetic-codegen-1",
      "1.2.0",
      "https://example.com/bad",
      invalidClauses,
      "1.1.0",
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.code).toBe("E2022");
  });
});

describe("DemoStore queries", () => {
  it("filters by system, verdict, severity, status, and query", () => {
    const incidents = store.getSnapshot().incidents;
    expect(
      filterIncidents(incidents, { system: "synthetic-chatbot-1" }),
    ).toHaveLength(3);
    expect(
      filterIncidents(incidents, { verdict: "POLICY_VIOLATION" }),
    ).toHaveLength(2);
    expect(filterIncidents(incidents, { severity: "CRITICAL" })).toHaveLength(
      1,
    );
    expect(filterIncidents(incidents, { status: "OPEN" })).toHaveLength(1);
    expect(filterIncidents(incidents, { query: "dosage" })).toHaveLength(1);
  });

  it("groups policy gaps by system and clause", () => {
    const groups = policyGaps(store.getSnapshot());
    expect(groups).toHaveLength(1);
    expect(groups[0]?.system_id).toBe("synthetic-codegen-1");
    expect(groups[0]?.clause.id).toBe("C4");
    expect(groups[0]?.incident_ids).toEqual(["inc-000003"]);
  });

  it("computes reporter stats without a composite score", () => {
    const stats = reporterStats(store.getSnapshot().incidents, DEMO_ACCOUNT);
    expect(stats.filed).toBe(2);
    expect(stats.decided).toBe(1);
    expect(stats.violations).toBe(0);
    expect(stats.insufficient).toBe(0);
  });
});

describe("DemoStore adjudication", () => {
  it("derives the verdict from clause findings, not claim keywords", async () => {
    const filed = await store.fileIncident({
      system_id: "synthetic-chatbot-1",
      policy_version: "1.0.0",
      claim:
        "SYNTHETIC: The assistant gave a prescription dosage, which caused harm.",
      evidence: inlineEvidence("SYNTHETIC: Take 4000mg of DrugX every hour."),
    });
    expect(filed.ok).toBe(true);
    if (!filed.ok) return;

    const adjudicated = store.adjudicate(filed.value);
    expect(adjudicated.ok).toBe(true);
    const verdict = store.incident(filed.value)?.verdict;
    expect(verdict?.verdict).toBe("POLICY_VIOLATION");
    expect(verdict?.clauses).toContain("C1");
    expect(verdict?.severity).toBe("SERIOUS");
    // No defense was filed: confidence is capped one band down.
    expect(verdict?.confidence).toBe("MEDIUM");
    // The verdict echoes the pinned hashes rather than recomputing them.
    expect(verdict?.policy_hash).toBe(
      store.incident(filed.value)?.policy_hash,
    );
    expect(verdict?.rationale).toMatch(/Primary clause: C\d/);
  });

  it("refuses to decide twice for the same round", async () => {
    const filed = await store.fileIncident({
      system_id: "synthetic-chatbot-1",
      policy_version: "1.0.0",
      claim: "SYNTHETIC: the assistant refused without naming a category.",
      evidence: inlineEvidence("SYNTHETIC: I cannot help with that request."),
    });
    if (!filed.ok) throw new Error(filed.message);
    expect(store.adjudicate(filed.value).ok).toBe(true);
    const second = store.adjudicate(filed.value);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("ALREADY_DECIDED");
  });
});
