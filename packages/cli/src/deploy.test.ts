import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SAFETYNET_ARGS,
  DeployError,
  deployContract,
  domainConfigFromArgs,
  parseActiveAccount,
  parseDeployArgs,
  parseDeployOutput,
} from "./deploy";

const SOURCE = `# { "Depends": "py-genlayer:test" }\nclass SafetyNet:\n    pass\n`;

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "snet-deploy-"));
  mkdirSync(join(root, "contracts"), { recursive: true });
  writeFileSync(join(root, "contracts", "safetynet.py"), SOURCE);
  return root;
}

describe("deploy args", () => {
  it("uses the SafetyNet defaults when --args is omitted", () => {
    expect(parseDeployArgs(undefined, "contracts/safetynet.py")).toEqual(
      DEFAULT_SAFETYNET_ARGS,
    );
  });

  it("uses no args for other contracts", () => {
    expect(parseDeployArgs(undefined, "contracts/other.py")).toEqual([]);
  });

  it("parses a JSON array", () => {
    expect(parseDeployArgs('[1, 2, "x"]', "contracts/other.py")).toEqual([
      1,
      2,
      "x",
    ]);
  });

  it("reads @file", () => {
    const root = tempRoot();
    const file = join(root, "args.json");
    writeFileSync(file, "[3, 4]");
    expect(parseDeployArgs(`@${file}`, "contracts/other.py")).toEqual([3, 4]);
  });

  it("rejects non-array JSON", () => {
    expect(() => parseDeployArgs('{"a":1}', "contracts/other.py")).toThrow(
      DeployError,
    );
  });
});

describe("deploy output parsing", () => {
  it("parses the labelled genlayer deploy output", () => {
    const output = `
Deployment Transaction Hash: 0x${"1".repeat(64)}
Contract Address: 0x${"2".repeat(40)}
`;
    expect(parseDeployOutput(output)).toEqual({
      txHash: `0x${"1".repeat(64)}`,
      address: `0x${"2".repeat(40)}`,
    });
  });

  it("tolerates ANSI color", () => {
    const output = `\u001b[32mContract Address:\u001b[0m 0x${"3".repeat(40)}`;
    expect(parseDeployOutput(output).address).toBe(`0x${"3".repeat(40)}`);
  });

  it("parses the alternate deployed-at wording", () => {
    const output = `deployed at the address "0x${"4".repeat(40)}"`;
    expect(parseDeployOutput(output).address).toBe(`0x${"4".repeat(40)}`);
  });
});

describe("active account parsing", () => {
  it("extracts the starred active account", () => {
    const output = `buyer 0x${"1".repeat(40)}\n* rabby 0x${"2".repeat(40)} (active) (unlocked)\n`;
    expect(parseActiveAccount(output)).toBe(`0x${"2".repeat(40)}`);
  });
});

describe("domain config", () => {
  it("converts SafetyNet constructor args", () => {
    const parsed = domainConfigFromArgs([
      8,
      20000,
      24,
      72,
      1,
      48,
      "example.com,raw.githubusercontent.com",
    ]);
    expect(parsed.domainConfig.maxEvidenceItems).toBe(8);
    expect(parsed.allowlist).toBe("example.com,raw.githubusercontent.com");
  });

  it("falls back to defaults for short arg lists", () => {
    expect(domainConfigFromArgs([]).domainConfig.maxAppeals).toBe(1);
  });
});

describe("deployContract", () => {
  it("dry run does not send a transaction", async () => {
    const root = tempRoot();
    const result = await deployContract({
      root,
      contractPath: "contracts/safetynet.py",
      network: "studionet",
      rpcUrl: "http://127.0.0.1:1/api",
      dryRun: true,
      skipChecks: true,
      yes: true,
    });
    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.address).toBe("");
  });

  it("aborts without --yes in a non-interactive shell", async () => {
    const root = tempRoot();
    await expect(
      deployContract({
        root,
        contractPath: "contracts/safetynet.py",
        network: "studionet",
        rpcUrl: "http://127.0.0.1:1/api",
        dryRun: false,
        skipChecks: true,
        yes: false,
      }),
    ).rejects.toMatchObject({ code: "E2001" });
  });
});
