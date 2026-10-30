import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type ReadCaller,
  type RpcTransport,
  evidenceAllowlistHash,
  normalizeSource,
  parseCallOutput,
  schemaHash,
  sourceHash,
  verifyDeployment,
} from "./verify";

const SOURCE = `# { "Depends": "py-genlayer:test" }\nclass SafetyNet:\n    pass\n`;
const SCHEMA = {
  ctor: { params: [], kwparams: {} },
  methods: {
    get_config: { params: [], kwparams: {}, readonly: true, ret: "string" },
    get_incident: {
      params: [["incident_id", "string"]],
      kwparams: {},
      readonly: true,
      ret: "string",
    },
  },
};
const CONFIG = {
  max_evidence_items: 8,
  max_evidence_bytes: 20000,
  max_policy_clauses: 24,
  appeal_window_hours: 72,
  max_appeals: 1,
  min_provider_response_hours: 48,
  evidence_allowlist: "example.com, raw.githubusercontent.com",
};

function fixtureRegistry(): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      network: "studionet",
      chainId: "61999",
      updatedAt: "2026-10-27T00:00:00Z",
      contracts: {
        SafetyNet: {
          address: "0x1472fb07454Fca1aC30081aAad659b7adB4A754D",
          txHash: "0xabc",
          deployer: "0x5B3661C576c7001e6d6279C67F3779705d334c89",
          sourcePath: "contracts/safetynet.py",
          sourceHash: sourceHash(SOURCE),
          schemaHash: schemaHash(SCHEMA),
          normalizer: 1,
          sdk: "py-genlayer:test",
          safetyNetVersion: "0.1.0",
          domainConfig: {
            maxEvidenceItems: 8,
            maxEvidenceBytes: 20000,
            maxPolicyClauses: 24,
            appealWindowHours: 72,
            maxAppeals: 1,
            minProviderResponseHours: 48,
          },
          evidenceAllowlistHash: evidenceAllowlistHash(
            CONFIG.evidence_allowlist,
          ),
          status: "ACCEPTED",
          deployedAt: "2026-10-27T00:00:00Z",
          history: [],
        },
      },
    },
    null,
    2,
  );
}

function tempProject(): string {
  const root = mkdtempSync(join(tmpdir(), "snet-verify-"));
  mkdirSync(join(root, "deployments"), { recursive: true });
  mkdirSync(join(root, "contracts"), { recursive: true });
  writeFileSync(join(root, "contracts", "safetynet.py"), SOURCE);
  writeFileSync(join(root, "deployments", "studionet.json"), fixtureRegistry());
  return root;
}

function fakeRpc(
  overrides: Partial<Record<string, unknown>> = {},
): RpcTransport {
  return {
    async request(method) {
      if (method in overrides) return overrides[method];
      if (method === "gen_getContractSchemaForCode") return SCHEMA;
      if (method === "gen_getContractSchema") return SCHEMA;
      if (method === "gen_getContractCode")
        return Buffer.from(SOURCE, "utf8").toString("base64");
      throw new Error(`unexpected RPC method ${method}`);
    },
  };
}

function fakeCaller(): ReadCaller {
  return {
    call(_address, method, args) {
      if (method === "get_config") return JSON.stringify(CONFIG);
      if (method === "get_incident_count") return "0";
      if (method === "get_incident") return "";
      if (method === "get_verdict") return "";
      throw new Error(`unexpected call ${method} ${args.join(",")}`);
    },
  };
}

describe("verification hashing", () => {
  it("normalizes CRLF and trailing EOF whitespace exactly once", () => {
    expect(normalizeSource("a\r\nb\r\n\r\n")).toBe("a\nb\n");
    expect(normalizeSource("a\nb   \n\n")).toBe("a\nb\n");
    expect(normalizeSource("\uFEFFa\r\n")).toBe("a\n");
    expect(normalizeSource("")).toBe("\n");
  });

  it("hashes the allowlist independent of order, case, and duplicates", () => {
    expect(
      evidenceAllowlistHash("example.com, RAW.githubusercontent.com"),
    ).toBe(
      evidenceAllowlistHash(
        "raw.githubusercontent.com,example.com,example.com",
      ),
    );
  });

  it("parses the genlayer call Result section", () => {
    expect(
      parseCallOutput(
        '- Calling method get_config...\n\nResult:\n{"a":1}\n\n✔ Read operation successfully executed\n',
      ),
    ).toBe('{"a":1}');
    expect(parseCallOutput("Result:\n\n✔ done")).toBe("");
  });
});

describe("verifyDeployment", () => {
  it("verifies registry, schema, source, probes, and config", async () => {
    const root = tempProject();
    const report = await verifyDeployment(
      { root, network: "studionet", now: () => "2026-11-02T00:00:00.000Z" },
      { rpc: fakeRpc(), caller: fakeCaller() },
    );
    expect(report.result).toBe("VERIFIED");
    expect(report.ok).toBe(true);
    expect(report.levels.map((level) => [level.id, level.status])).toEqual([
      ["L0", "pass"],
      ["L1", "pass"],
      ["L2", "pass"],
      ["L3", "pass"],
      ["L4", "pass"],
    ]);
    expect(report.levels[3]?.probes?.every((probe) => probe.ok)).toBe(true);
    expect(report.sourceHash).toBe(sourceHash(SOURCE));
    expect(report.schemaHash).toBe(schemaHash(SCHEMA));
  });

  it("fails L2 with E7001 when the on-chain source differs", async () => {
    const root = tempProject();
    const report = await verifyDeployment(
      { root, network: "studionet" },
      {
        rpc: fakeRpc({
          gen_getContractCode: Buffer.from(`${SOURCE}\n# changed\n`).toString(
            "base64",
          ),
        }),
        caller: fakeCaller(),
      },
    );
    expect(report.result).toBe("FAILED");
    expect(report.levels.find((level) => level.id === "L2")?.status).toBe(
      "fail",
    );
    expect(report.levels.find((level) => level.id === "L2")?.detail).toContain(
      "E7001",
    );
  });

  it("publishes the artifact without rewriting the registry by default", async () => {
    const root = tempProject();
    const before = readFileSync(
      join(root, "deployments", "studionet.json"),
      "utf8",
    );
    const report = await verifyDeployment(
      {
        root,
        network: "studionet",
        publish: true,
        now: () => "2026-11-02T00:00:00.000Z",
      },
      { rpc: fakeRpc(), caller: fakeCaller() },
    );
    expect(report.result).toBe("VERIFIED");
    expect(
      readFileSync(join(root, "deployments", "studionet.json"), "utf8"),
    ).toBe(before);
    const artifact = JSON.parse(
      readFileSync(
        join(root, "deployments", "studionet.verification.json"),
        "utf8",
      ),
    ) as { result: string; registryHash: string };
    expect(artifact.result).toBe("VERIFIED");
    expect(artifact.registryHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("records verified hashes with --update-registry", async () => {
    const root = tempProject();
    const report = await verifyDeployment(
      {
        root,
        network: "studionet",
        updateRegistry: true,
        now: () => "2026-11-02T00:00:00.000Z",
      },
      { rpc: fakeRpc(), caller: fakeCaller() },
    );
    expect(report.result).toBe("VERIFIED");
    const registry = JSON.parse(
      readFileSync(join(root, "deployments", "studionet.json"), "utf8"),
    ) as {
      updatedAt: string;
      contracts: {
        SafetyNet: {
          sourceHash: string;
          schemaHash: string;
          evidenceAllowlistHash: string;
        };
      };
    };
    expect(registry.updatedAt).toBe("2026-11-02T00:00:00.000Z");
    expect(registry.contracts.SafetyNet.sourceHash).toBe(sourceHash(SOURCE));
    expect(registry.contracts.SafetyNet.schemaHash).toBe(schemaHash(SCHEMA));
    expect(registry.contracts.SafetyNet.evidenceAllowlistHash).toBe(
      evidenceAllowlistHash(CONFIG.evidence_allowlist),
    );
  });
});
