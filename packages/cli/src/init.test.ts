import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { InitError, scaffoldProject } from "./init";

const ROOT = process.cwd();
const tempDirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "snet-init-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("scaffoldProject", () => {
  it("creates the full policy tree offline", () => {
    const target = join(tempDir(), "my-policy");
    const result = scaffoldProject({
      dir: target,
      root: ROOT,
      cwd: process.cwd(),
      install: false,
      git: false,
    });

    expect(result.ok).toBe(true);
    expect(result.template).toBe("policy");
    for (const file of [
      "policies/example-policy.md",
      "tests/conftest.py",
      "tests/test_policy_compliance.py",
      "tests/test_contract_smoke.py",
      "scripts/deploy.ts",
      "deployments/.gitkeep",
      "gltest.config.yaml",
      "snet.config.ts",
      "package.json",
      "pyproject.toml",
      ".gitignore",
      "README.md",
      "contracts/safetynet.py",
    ]) {
      expect(existsSync(join(target, file)), file).toBe(true);
    }
  });

  it("refuses a non-empty directory with E2001", () => {
    const target = tempDir();
    writeFileSync(join(target, "keep.txt"), "x");

    try {
      scaffoldProject({
        dir: target,
        root: ROOT,
        cwd: process.cwd(),
        install: false,
        git: false,
      });
      throw new Error("expected scaffoldProject to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InitError);
      expect((error as InitError).code).toBe("E2001");
      expect((error as InitError).exitCode).toBe(2);
    }
  });

  it("overwrites a non-empty directory with force", () => {
    const target = tempDir();
    writeFileSync(join(target, "keep.txt"), "x");

    const result = scaffoldProject({
      dir: target,
      root: ROOT,
      cwd: process.cwd(),
      install: false,
      git: false,
      force: true,
    });

    expect(result.ok).toBe(true);
    expect(existsSync(join(target, "keep.txt"))).toBe(true);
  });

  it("rejects an unknown template with E1005", () => {
    try {
      scaffoldProject({
        dir: join(tempDir(), "project"),
        template: "nope",
        root: ROOT,
        cwd: process.cwd(),
        install: false,
        git: false,
      });
      throw new Error("expected scaffoldProject to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InitError);
      expect((error as InitError).code).toBe("E1005");
    }
  });

  it("writes a SYNTHETIC incident for the incident template", () => {
    const target = join(tempDir(), "incident-project");
    const result = scaffoldProject({
      dir: target,
      template: "incident",
      root: ROOT,
      cwd: process.cwd(),
      install: false,
      git: false,
    });

    expect(result.template).toBe("incident");
    const incident = JSON.parse(
      readFileSync(join(target, "incidents/example-incident.json"), "utf8"),
    ) as { synthetic: boolean; claim: string };
    expect(incident.synthetic).toBe(true);
    expect(incident.claim.startsWith("SYNTHETIC")).toBe(true);
  });
});
