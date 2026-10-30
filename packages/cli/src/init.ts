import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";

/** Templates accepted by `snet init --template`. */
export const TEMPLATES = ["policy", "incident", "provider-claim"] as const;
export type TemplateName = (typeof TEMPLATES)[number];

export interface InitOptions {
  /** Target directory; defaults to the current working directory. */
  dir?: string | undefined;
  template?: string | undefined;
  name?: string | undefined;
  python?: string | undefined;
  force?: boolean | undefined;
  git?: boolean | undefined;
  install?: boolean | undefined;
  /** Repository root that holds `templates/` and `contracts/`. */
  root: string;
  /** Working directory used to resolve a relative `dir`. */
  cwd: string;
}

export interface InitResult {
  ok: true;
  dir: string;
  template: TemplateName;
  created: string[];
  warnings: string[];
}

/** A scaffold failure with a stable code and process exit code. */
export class InitError extends Error {
  readonly code: string;
  readonly exitCode: number;

  constructor(code: string, message: string, exitCode = 2) {
    super(message);
    this.name = "InitError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

const POLICY_MD = `---
Policy-Version: 1.0.0
Provider: Example Provider
Effective-Date: 2026-01-01
Policy-URL: https://example.com/safety-policy
Clause-Count: 2
---

# Example Policy v1.0.0

## C1 — Medical boundaries
The system must not provide specific prescription dosages.

<!-- mandatory: true -->

## C2 — Uncertainty disclosure
The system must disclose uncertainty when it lacks information.

<!-- mandatory: false -->
`;

const CONFTEST_PY = `import pytest
`;

const POLICY_TEST_PY = `from safetynet_test import policy_text_hash


def test_policy_template_parses(policy):
    pol = (
        policy.version("1.0.0")
        .clause(
            "C1",
            "The system must not provide specific prescription dosages.",
            mandatory=True,
        )
        .clause(
            "C2",
            "The system must disclose uncertainty when it lacks information.",
        )
    )
    assert pol.clause_ids() == ["C1", "C2"]
    assert pol.hash().startswith("sha256:")


def test_example_policy_is_hashed_stably():
    text = open("policies/example-policy.md", encoding="utf-8").read()
    assert policy_text_hash(text) == policy_text_hash(text)
`;

const INCIDENT_TEST_PY = `import json


def test_example_incident_is_synthetic():
    with open("incidents/example-incident.json", encoding="utf-8") as handle:
        incident = json.load(handle)
    assert incident["synthetic"] is True
    assert incident["claim"].startswith("SYNTHETIC")
`;

const PROVIDER_TEST_PY = `import json


def test_example_claim_is_synthetic():
    with open("claims/example-claim.json", encoding="utf-8") as handle:
        claim = json.load(handle)
    assert claim["synthetic"] is True
    assert claim["system_id"]
`;

const SMOKE_PY = `def test_contract_deploys(deploy):
    sn = deploy()
    assert sn.read.get_incident_count() == 0
`;

const DEPLOY_TS = `import { gf } from "@safetynet/deploy";

export default async function main() {
  const sn = await gf.deployOnce("SafetyNet", { tag: "v0.1.0" });
  gf.log.info("Deployed", { address: sn.address });
}
`;

const GITIGNORE = `node_modules
.venv
.snet
deployments/*.json
`;

const GLTEST = `paths:
  contracts: contracts
  artifacts: .snet/gltest-artifacts
`;

function npmName(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "");
  return slug.length > 0 ? slug : "safetynet-project";
}

function writeIfMissing(
  path: string,
  content: string,
  force: boolean,
  created: string[],
  root: string,
): void {
  if (existsSync(path) && !force) return;
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, content);
  created.push(path.slice(root.length + 1));
}

/**
 * Scaffold a SafetyNet integration project entirely from bundled files.
 *
 * No network access is required. Python installation is best-effort and
 * reported as a warning instead of failing the scaffold.
 *
 * @example
 * ```ts
 * const result = scaffoldProject({ dir: "my-policy", root, cwd: process.cwd() });
 * result.created.includes("policies/example-policy.md"); // true
 * ```
 */
export function scaffoldProject(opts: InitOptions): InitResult {
  const template = (opts.template ?? "policy") as TemplateName;
  if (!TEMPLATES.includes(template)) {
    throw new InitError(
      "E1005",
      `unknown template "${opts.template}" (use ${TEMPLATES.join(" | ")})`,
    );
  }

  const target =
    opts.dir === undefined || opts.dir === "."
      ? opts.cwd
      : resolve(opts.cwd, opts.dir);

  if (existsSync(target)) {
    const entries = readdirSync(target);
    if (entries.length > 0 && !opts.force) {
      throw new InitError(
        "E2001",
        `target directory ${target} is not empty (use --force to overwrite)`,
      );
    }
  }

  const created: string[] = [];
  const warnings: string[] = [];
  mkdirSync(target, { recursive: true });

  // 1. Copy a bundled template when one exists (policy has the full tree).
  const templateDir = join(opts.root, "templates", template);
  if (existsSync(templateDir)) {
    cpSync(templateDir, target, {
      recursive: true,
      force: true,
      filter: (source) => {
        const name = basename(source);
        return (
          name !== "__pycache__" &&
          name !== ".pytest_cache" &&
          name !== ".venv" &&
          name !== ".git" &&
          !name.endsWith(".pyc")
        );
      },
    });
    for (const entry of readdirSync(templateDir, { recursive: true })) {
      const text = String(entry);
      if (text.includes("__pycache__") || text.endsWith(".pyc")) continue;
      created.push(text);
    }
  }

  // 2. Fill any missing files with bundled defaults.
  const projectName = npmName(opts.name ?? basename(target) ?? "safetynet");
  const force = opts.force ?? false;
  const write = (relative: string, content: string) =>
    writeIfMissing(join(target, relative), content, force, created, target);

  write("policies/example-policy.md", POLICY_MD);
  write("tests/conftest.py", CONFTEST_PY);
  write(
    "tests/test_policy_compliance.py",
    template === "incident"
      ? INCIDENT_TEST_PY
      : template === "provider-claim"
        ? PROVIDER_TEST_PY
        : POLICY_TEST_PY,
  );
  write("tests/test_contract_smoke.py", SMOKE_PY);
  write("scripts/deploy.ts", DEPLOY_TS);
  write("deployments/.gitkeep", "");
  write("gltest.config.yaml", GLTEST);
  write(".gitignore", GITIGNORE);
  write(
    "snet.config.ts",
    `// SafetyNet config\nexport default { contractsDir: "contracts", defaultNetwork: "studionet" };\n`,
  );
  write(
    "package.json",
    `${JSON.stringify(
      { name: projectName, private: true, type: "module" },
      null,
      2,
    )}\n`,
  );
  write(
    "pyproject.toml",
    `[project]\nname = "${projectName}"\nversion = "0.1.0"\nrequires-python = ">=3.11"\ndependencies = ["safetynet-test"]\n`,
  );
  write(
    "README.md",
    `# ${projectName}\n\nGenerated by \`snet init\` (template: ${template}).\n\n## Next steps\n\n\`\`\`bash\nsnet test\`\`\`\n`,
  );

  if (template === "incident") {
    write(
      "incidents/example-incident.json",
      `${JSON.stringify(
        {
          synthetic: true,
          system_id: "synthetic-chatbot-1",
          policy_version: "1.0.0",
          claim:
            "SYNTHETIC: the assistant gave a dosage despite clause C1 forbidding it.",
          evidence: [
            {
              kind: "inline",
              text: "SYNTHETIC TRANSCRIPT: 'Take 4000mg hourly.'",
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
  }
  if (template === "provider-claim") {
    write(
      "claims/example-claim.json",
      `${JSON.stringify(
        {
          synthetic: true,
          system_id: "synthetic-chatbot-1",
          provider_id: "synthetic-provider",
          policy_version: "1.0.0",
          note: "SYNTHETIC: example claim only, not a real provider.",
        },
        null,
        2,
      )}\n`,
    );
  }

  // 3. Ship the contract so the project can run offline.
  const contractSource = join(opts.root, "contracts", "safetynet.py");
  if (existsSync(contractSource)) {
    const contractTarget = join(target, "contracts", "safetynet.py");
    if (!existsSync(contractTarget) || force) {
      mkdirSync(join(target, "contracts"), { recursive: true });
      cpSync(contractSource, contractTarget);
      created.push("contracts/safetynet.py");
    }
  } else {
    warnings.push("contracts/safetynet.py not found in the CLI bundle");
  }

  // 4. Optional git repository.
  if (opts.git !== false) {
    const git = spawnSync("git", ["init"], { cwd: target, stdio: "ignore" });
    if (git.status !== 0) warnings.push("git init failed; run it manually");
  }

  // 5. Optional Python environment. Offline failures are warnings.
  if (opts.install !== false) {
    const python = opts.python ?? "python3";
    const venvDir = join(target, ".venv");
    if (!existsSync(venvDir)) {
      const venv = spawnSync(python, ["-m", "venv", ".venv"], {
        cwd: target,
        stdio: "ignore",
      });
      if (venv.status !== 0) {
        warnings.push(`could not create .venv; run: ${python} -m venv .venv`);
      }
    }
    if (existsSync(venvDir)) {
      const binDir = process.platform === "win32" ? "Scripts" : "bin";
      const pip = join(
        venvDir,
        binDir,
        process.platform === "win32" ? "pip.exe" : "pip",
      );
      const local = join(opts.root, "packages", "safetynet-test");
      const installArgs = existsSync(local)
        ? ["install", "-e", local]
        : ["install", "safetynet-test"];
      const install = spawnSync(pip, installArgs, {
        cwd: target,
        stdio: "ignore",
      });
      if (install.status !== 0) {
        warnings.push(
          `could not install safetynet-test; run: .venv/${binDir}/pip ${installArgs.join(" ")}`,
        );
      }
    }
  }

  return { ok: true, dir: target, template, created, warnings };
}

/** Read the bundled contract source, used by tests and docs generation. */
export function bundledContract(root: string): string | null {
  const path = join(root, "contracts", "safetynet.py");
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}
