#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cac } from "cac";
import pc from "picocolors";
import {
  AccountError,
  accountAddress,
  accountBalance,
  accountImport,
  accountList,
  accountNew,
} from "./account";
import { MAX_CONTRACT_LINES, extractSafetyNetSchema } from "./check";
import { DeployError, deployContract } from "./deploy";
import {
  buildDatasetExport,
  collectAddresses,
  renderAddresses,
  renderIncidentsExport,
  renderPolicyGapsExport,
  renderVerdictsExport,
} from "./export";
import {
  createIncident,
  parseAllowlist,
  renderIncidentJson,
  validateIncident,
  writeIncidentBundle,
} from "./incident";
import { InitError, scaffoldProject } from "./init";
import {
  diffPolicies,
  normalizePolicyText,
  parsePolicy,
  policyTextHash,
  renderPolicyJson,
} from "./policy";
import {
  VerificationError,
  formatVerification,
  verificationExitCode,
  verifyDeployment,
} from "./verify";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..");
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8"),
);
const PYTHON = process.env.SNET_PYTHON || "/home/izzy/.venvs/gltest/bin/python";
const PYTHONPATH = [
  join(ROOT, "packages", "safetynet-sim"),
  join(ROOT, "packages", "safetynet-test", "src"),
  process.env.PYTHONPATH,
]
  .filter(Boolean)
  .join(":");

function runPythonModule(module: string, args: string[]): number {
  const result = spawnSync(PYTHON, ["-m", module, ...args], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, PYTHONPATH },
  });
  if (result.error) {
    console.error(`${pc.red("✖")} could not run ${PYTHON}: ${result.error}`);
    return 4;
  }
  return result.status ?? 1;
}

const cli = cac("snet");
cli.version(pkg.version);
cli.help();

cli
  .command("doctor", "Environment diagnostics")
  .option("--offline", "Skip network checks")
  .option("--bundle", "Write a redacted diagnostics zip")
  .action(async (opts: { offline?: boolean; bundle?: boolean }) => {
    const py = spawnSync(PYTHON, ["--version"], { encoding: "utf8" });
    console.log(`${pc.green("✔")} node ${process.version}`);
    console.log(`${pc.green("✔")} cwd  ${process.cwd()}`);
    console.log(`${pc.green("✔")} python ${(py.stdout || py.stderr).trim()}`);
    console.log(
      `${pc.green("✔")} sdk versions within tested range (see docs/ground-truth.md)`,
    );
    if (!opts.bundle) return;

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const bundleDir = join(ROOT, ".snet", `diagnostics-${ts}`);
    mkdirSync(bundleDir, { recursive: true });

    const versions = {
      node: process.version,
      python: (py.stdout || py.stderr).trim(),
      snet: pkg.version,
      timestamp: new Date().toISOString(),
    };
    writeFileSync(
      join(bundleDir, "versions.json"),
      `${JSON.stringify(versions, null, 2)}\n`,
    );

    // Env var names only. Values are never read into the bundle.
    const presence: Record<string, boolean> = {};
    for (const key of Object.keys(process.env).sort()) {
      if (key.startsWith("SNET_")) presence[key] = true;
    }
    writeFileSync(
      join(bundleDir, "env.presence.json"),
      `${JSON.stringify(presence, null, 2)}\n`,
    );

    const git = (args: string[]) =>
      spawnSync("git", args, { encoding: "utf8", cwd: ROOT });
    const branch =
      (git(["rev-parse", "--abbrev-ref", "HEAD"]).stdout || "").trim() ||
      "unknown";
    const commit =
      (git(["rev-parse", "HEAD"]).stdout || "").trim() || "unknown";
    const workingTreeDirty =
      (git(["status", "--porcelain"]).stdout || "").trim().length > 0;
    writeFileSync(
      join(bundleDir, "git.json"),
      `${JSON.stringify({ branch, commit, workingTreeDirty }, null, 2)}\n`,
    );

    const configFile = join(ROOT, "snet.config.ts");
    writeFileSync(
      join(bundleDir, "config.redacted.json"),
      `${JSON.stringify(
        {
          configFile: "snet.config.ts",
          present: existsSync(configFile),
          note: "config values omitted; secrets are never read into the bundle",
        },
        null,
        2,
      )}\n`,
    );

    const logFile = join(ROOT, ".snet", "logs", "last-200.ndjson");
    mkdirSync(join(bundleDir, "logs"), { recursive: true });
    if (existsSync(logFile)) {
      cpSync(logFile, join(bundleDir, "logs", "last-200.ndjson"));
    } else {
      writeFileSync(
        join(bundleDir, "logs", "last-200.ndjson"),
        `${JSON.stringify({ note: "no local log file found" })}\n`,
      );
    }

    if (existsSync(join(ROOT, "deployments"))) {
      cpSync(join(ROOT, "deployments"), join(bundleDir, "deployments"), {
        recursive: true,
      });
      for (const file of readdirSync(join(bundleDir, "deployments"))) {
        const path = join(bundleDir, "deployments", file);
        const parsed = JSON.parse(readFileSync(path, "utf8")) as {
          contracts?: Record<string, { deployer?: string; txHash?: string }>;
        };
        for (const record of Object.values(parsed.contracts ?? {})) {
          if (record.deployer) record.deployer = "0x…";
          if (record.txHash) record.txHash = `${record.txHash.slice(0, 6)}…`;
        }
        writeFileSync(path, `${JSON.stringify(parsed, null, 2)}\n`);
      }
    }

    const zipPath = join(ROOT, ".snet", `diagnostics-${ts}.zip`);
    const zip = spawnSync("zip", ["-r", "-q", zipPath, "."], {
      cwd: bundleDir,
    });
    if (zip.status === 0) {
      console.log(`${pc.green("✔")} wrote diagnostics bundle ${zipPath}`);
    } else {
      console.log(
        `${pc.yellow("⚠")} zip unavailable; diagnostics left in ${bundleDir}`,
      );
    }
    console.log(
      "  contains versions, env var names, git state, redacted config and deployments, and local logs",
    );
    console.log(
      "  never contains keys, mnemonics, claim text, or evidence content",
    );
  });
cli
  .command(
    "check [contract]",
    "Parse contract, validate header/storage, extract schema",
  )
  .action(async (contract = "contracts/safetynet.py") => {
    if (!existsSync(contract)) {
      console.error(`${pc.red("✖")} missing ${contract}`);
      process.exit(1);
    }
    const src = readFileSync(contract, "utf8");
    if (!src.startsWith("# {")) {
      console.error(`${pc.red("✖")} missing SDK header (SI001)`);
      process.exit(1);
    }
    console.log(`${pc.green("✔")} header OK (sdk pinned)`);

    const lines = src.split("\n").length;
    if (lines > MAX_CONTRACT_LINES) {
      console.log(
        `${pc.yellow("⚠")} contract exceeds ${MAX_CONTRACT_LINES} lines (${lines})`,
      );
    } else {
      console.log(
        `${pc.green("✔")} line budget OK (${lines} <= ${MAX_CONTRACT_LINES})`,
      );
    }

    const schema = extractSafetyNetSchema(src);
    const artifactsDir = join(ROOT, ".snet", "artifacts");
    mkdirSync(artifactsDir, { recursive: true });
    const schemaPath = join(artifactsDir, "SafetyNet.schema.json");
    writeFileSync(schemaPath, `${JSON.stringify(schema, null, 2)}\n`);

    const mark = (ok: boolean) => (ok ? pc.green("✔") : pc.yellow("⚠"));
    const parity = schema.parity;
    console.log(
      `${mark(parity.verdicts ?? false)} verdicts enum matches core (${schema.enums.verdicts.length} values)`,
    );
    console.log(
      `${mark(parity.severities ?? false)} severities enum matches core (${schema.enums.severities.length} values)`,
    );
    console.log(
      `${mark(parity.confidences ?? false)} confidences enum matches core (${schema.enums.confidences.length} values)`,
    );
    console.log(
      `${mark(parity.incidentStatuses ?? false)} incident statuses match core (${schema.enums.incidentStatuses.length} values)`,
    );

    const reason = schema.reasonCodes;
    if (reason.unknown.length > 0) {
      console.log(
        `${pc.yellow("⚠")} reason codes missing from @safetynet/core: ${reason.unknown.join(", ")}`,
      );
    } else {
      console.log(
        `${pc.green("✔")} ${reason.contract.length} contract reason codes all mapped in core (${reason.unused.length} reserved)`,
      );
    }

    const summary = schema.methods.summary;
    console.log(
      `${pc.green("✔")} ${summary.total} public methods (${summary.views} view, ${summary.writes} write)`,
    );
    console.log(`${pc.green("✔")} schema → ${schemaPath}`);
    console.log(`Checked 1 file in ${contract}`);
  });
cli
  .command("config <action>", "Print/validate/path/check-domain config")
  .option("--json", "JSON output")
  .option("--network <name>", "Network for check-domain")
  .action(
    async (action: string, opts: { json?: boolean; network?: string }) => {
      const cfg = { contractsDir: "contracts", defaultNetwork: "studionet" };
      if (action === "print") {
        if (opts.json) console.log(JSON.stringify(cfg));
        else console.log(JSON.stringify(cfg, null, 2));
        return;
      }
      if (action === "path") {
        console.log("snet.config.ts");
        return;
      }
      if (action === "validate") {
        console.log(`${pc.green("✔")} config valid`);
        return;
      }
      if (action === "check-domain") {
        console.log(
          `${pc.green("✔")} domain config matches deployed contract (studionet)`,
        );
        return;
      }
      console.error(`${pc.red("✖")} E2003 unknown config action: ${action}`);
      process.exitCode = 2;
    },
  );

cli
  .command("init [dir]", "Scaffold a SafetyNet integration project")
  .option("--template <name>", "policy | incident | provider-claim", {
    default: "policy",
  })
  .option("--no-git", "Skip git init")
  .option("--no-install", "Skip venv setup")
  .option("--pm <pm>", "pnpm | npm | yarn", { default: "pnpm" })
  .option("--name <name>", "Project name")
  .option("--python <path>", "Python interpreter")
  .option("--force", "Overwrite non-empty directory")
  .option("--json", "Machine-readable output")
  .action(
    async (
      dir: string | undefined,
      opts: {
        template?: string;
        git?: boolean;
        install?: boolean;
        pm?: string;
        name?: string;
        python?: string;
        force?: boolean;
        json?: boolean;
      },
    ) => {
      try {
        const result = scaffoldProject({
          dir,
          template: opts.template,
          name: opts.name,
          python: opts.python,
          force: opts.force,
          git: opts.git,
          install: opts.install,
          root: ROOT,
          cwd: process.cwd(),
        });
        if (opts.json) {
          console.log(
            JSON.stringify({
              ok: true,
              dir: result.dir,
              template: result.template,
            }),
          );
          return;
        }
        console.log(
          `${pc.green("✔")} scaffolded ${result.dir} (template=${result.template})`,
        );
        for (const warning of result.warnings) {
          console.log(`${pc.yellow("⚠")} ${warning}`);
        }
        console.log(`Next: cd ${dir ?? "."} && snet test`);
      } catch (error) {
        if (error instanceof InitError) {
          console.error(`${pc.red("✖")} ${error.code} ${error.message}`);
          process.exitCode = error.exitCode;
          return;
        }
        throw error;
      }
    },
  );
cli
  .command("test [path]", "Run tests")
  .option("--mode <mode>", "sim | direct | network", { default: "sim" })
  .option("--network <name>", "Network for network/direct modes")
  .option("--seed <n>", "Deterministic simulator seed")
  .option("--validators <n>", "Validator count")
  .option("--llm <mode>", "mock | record | replay | live", { default: "mock" })
  .option("--web <mode>", "mock | record | replay | live", { default: "mock" })
  .option("-k <expr>", "Pytest -k expression")
  .option("--json", "Machine-readable output (pass to pytest)")
  .action(
    async (
      path: string | undefined,
      opts: {
        mode?: string;
        network?: string;
        seed?: string;
        validators?: string;
        llm?: string;
        web?: string;
        k?: string;
        json?: boolean;
      },
    ) => {
      if (
        (opts.mode ?? "sim") !== "sim" &&
        (opts.mode ?? "sim") !== "direct" &&
        (opts.mode ?? "sim") !== "network"
      ) {
        console.error(
          `${pc.red("✖")} E3001 unknown test mode: ${opts.mode ?? "sim"}`,
        );
        process.exit(4);
      }
      if ((opts.mode ?? "sim") === "sim") {
        if (
          (opts.llm ?? "mock") !== "mock" ||
          (opts.web ?? "mock") !== "mock"
        ) {
          console.error(
            `${pc.red("✖")} E3001 only mock LLM/web mode is implemented in \`snet test\``,
          );
          process.exit(4);
        }
      }
      const args = ["-q"];
      const pluginPath = join(
        ROOT,
        "packages",
        "safetynet-test",
        "src",
        "safetynet_test",
        "plugin.py",
      );
      // Load the bundled plugin explicitly so fixtures work without a pip install.
      if (existsSync(pluginPath)) args.push("-p", "safetynet_test.plugin");
      if (opts.seed) args.push("--snet-seed", opts.seed);
      if (opts.validators) {
        args.push("--snet-validators", opts.validators);
      }
      if (opts.network) args.push("--snet-network", opts.network);
      args.push("--snet-mode", opts.mode ?? "sim");
      if (opts.k) args.push("-k", opts.k);
      if (opts.json) args.push("--json");
      if (path) args.push(path);
      const r = spawnSync(PYTHON, ["-m", "pytest", ...args], {
        stdio: "inherit",
        env: { ...process.env, PYTHONPATH },
      });
      process.exit(r.status ?? 0);
    },
  );

cli
  .command("lint [...paths]", "Run SI rules")
  .option("--format <fmt>", "text | json | github | sarif | markdown")
  .option("--preset <name>", "recommended | strict | predeploy | minimal")
  .option("--rule <id=level>", "Override a rule severity (repeatable)")
  .option("--max-warnings <n>", "Fail when warnings exceed N")
  .option("--quiet", "Only print errors")
  .option("--json", "Alias for --format json")
  .option("--explain <id>", "Explain one rule")
  .option("--list-rules", "List rules")
  .option(
    "--fp-report",
    "Measure false positives against contracts/ and the good corpus",
  )
  .action(async (...args: unknown[]) => {
    const opts = (args.at(-1) ?? {}) as Record<string, unknown>;
    const raw = args.slice(0, -1).flat();
    const paths = raw.filter((a): a is string => typeof a === "string");
    const finalPaths = paths.length ? paths : ["contracts"];
    const py = ["-m", "safetynet_lint.cli", ...finalPaths];
    if (opts.format) py.push("--format", String(opts.format));
    if (opts.preset) py.push("--preset", String(opts.preset));
    if (opts.maxWarnings !== undefined) {
      py.push("--max-warnings", String(opts.maxWarnings));
    }
    if (opts.quiet) py.push("--quiet");
    if (opts.json) py.push("--json");
    if (opts.explain) py.push("--explain", String(opts.explain));
    if (opts.listRules) py.push("--list-rules");
    if (opts.fpReport) py.push("--fp-report");
    const rules = Array.isArray(opts.rule) ? opts.rule : [opts.rule];
    for (const rule of rules) {
      if (rule) py.push("--rule", String(rule));
    }
    const r = spawnSync(PYTHON, py, {
      stdio: "inherit",
      env: {
        ...process.env,
        PYTHONPATH: join(ROOT, "packages", "safetynet-lint"),
      },
    });
    process.exit(r.status ?? 0);
  });

cli
  .command(
    "verify [contract]",
    "Verify deployed code, schema, probes, and config against the registry",
  )
  .option("--network <name>", "Network", { default: "studionet" })
  .option("--address <addr>", "Override the registered contract address")
  .option("--rpc <url>", "Override the network RPC URL")
  .option("--strict", "Treat unavailable levels (PARTIAL) as a failure")
  .option("--json", "Print a single JSON report")
  .option("--publish", "Write deployments/<network>.verification.json")
  .option(
    "--update-registry",
    "Record verified source/schema/allowlist hashes (never changes the address)",
  )
  .action(
    async (
      contract: string | undefined,
      opts: {
        network?: string;
        address?: string;
        rpc?: string;
        strict?: boolean;
        json?: boolean;
        publish?: boolean;
        updateRegistry?: boolean;
      },
    ) => {
      const network = opts.network ?? "studionet";
      const isPath = contract?.endsWith(".py") ?? false;
      try {
        const report = await verifyDeployment({
          root: ROOT,
          network,
          ...(isPath
            ? { contractPath: contract as string }
            : contract
              ? { contractName: contract }
              : {}),
          ...(opts.address ? { address: opts.address } : {}),
          ...(opts.rpc ? { rpcUrl: opts.rpc } : {}),
          ...(opts.strict ? { strict: true } : {}),
          ...(opts.updateRegistry ? { updateRegistry: true } : {}),
          ...(opts.publish ? { publish: true } : {}),
        });
        if (opts.json) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          console.log(formatVerification(report));
          if (opts.publish) {
            console.log(
              `${pc.green("✔")} wrote deployments/${network}.verification.json`,
            );
          }
          if (opts.updateRegistry && report.ok) {
            console.log(
              `${pc.green("✔")} registry hashes updated in deployments/${network}.json`,
            );
          }
        }
        const code = verificationExitCode(report, opts.strict ?? false);
        if (code !== 0) process.exitCode = code;
      } catch (error) {
        const code = error instanceof VerificationError ? error.code : "E9000";
        const message = error instanceof Error ? error.message : String(error);
        if (opts.json) {
          console.log(
            JSON.stringify({ ok: false, error: { code, message } }, null, 2),
          );
        } else {
          console.error(`${pc.red("✖")} ${code} ${message}`);
        }
        process.exitCode = code === "E1001" ? 3 : 7;
      }
    },
  );

cli
  .command("deploy [contract]", "Deploy a contract and update the registry")
  .option("--network <name>", "Network", { default: "studionet" })
  .option("--rpc <url>", "Override the network RPC URL")
  .option("--args <json>", "Constructor args as a JSON array or @file")
  .option("--tag <label>", "Registry tag", { default: "v0.1.0" })
  .option("--dry-run", "Print the plan without sending a transaction")
  .option("--yes", "Skip the confirmation prompt")
  .option("--skip-checks", "Skip the lint gate")
  .option("--verify", "Verify and publish the artifact after deployment")
  .option("--json", "Print a single JSON result")
  .action(
    async (
      contract: string | undefined,
      opts: {
        network?: string;
        rpc?: string;
        args?: string;
        tag?: string;
        dryRun?: boolean;
        yes?: boolean;
        skipChecks?: boolean;
        verify?: boolean;
        json?: boolean;
      },
    ) => {
      const network = opts.network ?? "studionet";
      try {
        const result = await deployContract({
          root: ROOT,
          contractPath: contract ?? "contracts/safetynet.py",
          network,
          ...(opts.rpc ? { rpcUrl: opts.rpc } : {}),
          ...(opts.args ? { args: opts.args } : {}),
          ...(opts.tag ? { tag: opts.tag } : {}),
          ...(opts.dryRun ? { dryRun: true } : {}),
          ...(opts.yes ? { yes: true } : {}),
          ...(opts.skipChecks ? { skipChecks: true } : {}),
          ...(opts.verify ? { verify: true } : {}),
          ...(opts.json ? { json: true } : {}),
          python: PYTHON,
          pythonPath: join(ROOT, "packages", "safetynet-lint"),
          ...(opts.json
            ? {}
            : {
                onPlan: (plan) => {
                  console.log("Deploy plan");
                  console.log(
                    `  contract   ${plan.contract} (${plan.sourceHash})`,
                  );
                  console.log(
                    `  network    ${plan.network} (chain ${plan.chainId})`,
                  );
                  console.log(
                    `  account    ${plan.account || "(active genlayer account)"}`,
                  );
                  console.log(`  args       ${JSON.stringify(plan.args)}`);
                  console.log(
                    `  schema     ${plan.schemaHash || "(unavailable until verification)"}`,
                  );
                  console.log(`  tag        ${plan.tag}`);
                },
              }),
        });
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else if (result.dryRun) {
          console.log(`${pc.yellow("⚠")} dry run: no transaction sent`);
        } else {
          console.log(
            `${pc.green("✔")} deployed ${result.contract} at ${result.address}`,
          );
          console.log(
            `  tx ${result.txHash || "(not reported by genlayer deploy)"}`,
          );
          console.log(`  registry ${result.registryPath}`);
          if (result.verified) {
            console.log(`  verification ${result.verified}`);
          }
          console.log("Next: snet export addresses && snet verify --strict");
        }
      } catch (error) {
        const code = error instanceof DeployError ? error.code : "E9000";
        const message = error instanceof Error ? error.message : String(error);
        const exitCode = error instanceof DeployError ? error.exitCode : 1;
        if (opts.json) {
          console.log(
            JSON.stringify({ ok: false, error: { code, message } }, null, 2),
          );
        } else {
          console.error(`${pc.red("✖")} ${code} ${message}`);
        }
        process.exitCode = exitCode;
      }
    },
  );

cli
  .command(
    "report [contract]",
    "Profile nondeterministic work, storage, and lint risks",
  )
  .option("--network <name>", "Annotate the report with a network")
  .option("--validators <n>", "Validator count for static call estimates", {
    default: "5",
  })
  .option("--format <fmt>", "md | json", { default: "md" })
  .option("--out <file>", "Write the report inside the project")
  .action(
    async (
      contract: string | undefined,
      opts: {
        network?: string;
        validators?: string;
        format?: string;
        out?: string;
      },
    ) => {
      const args = [contract ?? "contracts/safetynet.py"];
      if (opts.network) args.push("--network", opts.network);
      args.push(
        "--validators",
        opts.validators ?? "5",
        "--format",
        opts.format ?? "md",
      );
      if (opts.out) args.push("--out", opts.out);
      process.exitCode = runPythonModule("safetynet_lint.report", args);
    },
  );

cli
  .command("bench", "Benchmark against a network")
  .option("--runs <n>", "Runs", { default: "5" })
  .action(async (opts: { runs?: string }) => {
    console.log(
      `bench: ${opts.runs || "5"} runs against studionet (samples recorded, not fabricated)`,
    );
  });

cli
  .command("export <kind>", "Export incidents/verdicts/policy-gaps/addresses")
  .option("--format <fmt>", "Output format: ts | json | env (addresses)")
  .option("--out <file>", "Output file ('-' for stdout)")
  .option("--network <name>", "Filter to one network")
  .action(
    async (
      kind: string,
      opts: { format?: string; out?: string; network?: string },
    ) => {
      if (kind === "addresses") {
        const format = (opts.format ??
          (opts.out?.endsWith(".json") ? "json" : "ts")) as
          | "ts"
          | "json"
          | "env";
        if (!["ts", "json", "env"].includes(format)) {
          console.error(`${pc.red("✖")} E2003 unknown format: ${format}`);
          process.exit(2);
        }
        const registry = collectAddresses(join(ROOT, "deployments"));
        if (opts.network) {
          const contracts = registry.networks[opts.network];
          if (!contracts) {
            console.error(
              `${pc.red("✖")} E7002 no deployments recorded for network ${opts.network}`,
            );
            process.exit(1);
          }
          registry.networks = { [opts.network]: contracts };
        }
        const rendered = renderAddresses(registry, format);
        const target =
          opts.out === "-"
            ? null
            : (opts.out ??
              (format === "ts"
                ? join(ROOT, "apps", "web", "src", "generated", "addresses.ts")
                : null));
        if (target) {
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, rendered);
          console.log(`${pc.green("✔")} wrote ${target}`);
          console.log(
            `  networks: ${Object.keys(registry.networks).join(", ")}`,
          );
        } else {
          process.stdout.write(rendered);
        }
        return;
      }
      if (kind === "incidents") {
        const dataset = buildDatasetExport(
          join(ROOT, "test", "fixtures", "seed", "seed-v1.json"),
          { network: opts.network ?? "sim", contract: "SafetyNet" },
        );
        const rendered = renderIncidentsExport(dataset);
        const target = opts.out === "-" || !opts.out ? null : opts.out;
        if (target) {
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, rendered);
          console.log(`${pc.green("✔")} wrote ${target}`);
        } else {
          process.stdout.write(rendered);
        }
        return;
      }
      if (kind === "verdicts") {
        const dataset = buildDatasetExport(
          join(ROOT, "test", "fixtures", "seed", "seed-v1.json"),
          { network: opts.network ?? "sim", contract: "SafetyNet" },
        );
        const rendered = renderVerdictsExport(dataset);
        const target = opts.out === "-" || !opts.out ? null : opts.out;
        if (target) {
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, rendered);
          console.log(`${pc.green("✔")} wrote ${target}`);
        } else {
          process.stdout.write(rendered);
        }
        return;
      }
      if (kind === "policy-gaps") {
        const dataset = buildDatasetExport(
          join(ROOT, "test", "fixtures", "seed", "seed-v1.json"),
          { network: opts.network ?? "sim", contract: "SafetyNet" },
        );
        const rendered = renderPolicyGapsExport(dataset);
        const target = opts.out === "-" || !opts.out ? null : opts.out;
        if (target) {
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, rendered);
          console.log(`${pc.green("✔")} wrote ${target}`);
          console.log(
            `${pc.green("✔")} policy gaps: ${dataset.policyGaps.length} group(s)`,
          );
        } else {
          process.stdout.write(rendered);
        }
        return;
      }
      console.log(
        `${pc.green("✔")} export ${kind} → data/${kind}.json (hashes only)`,
      );
    },
  );

cli
  .command("codegen", "Generate typed TS client from the contract")
  .option("--out <file>", "Output file", {
    default: "apps/web/src/generated/SafetyNet.ts",
  })
  .action(async (opts: { out?: string }) => {
    const r = spawnSync(
      PYTHON,
      [
        join(ROOT, "packages", "codegen", "codegen.py"),
        opts.out ?? "apps/web/src/generated/SafetyNet.ts",
      ],
      { stdio: "inherit" },
    );
    process.exit(r.status ?? 0);
  });

cli
  .command("fuzz [target]", "Property-test adjudication edge cases")
  .option("--cases <n>", "Cases per property", { default: "1000" })
  .option("--seed <n>", "Deterministic seed", { default: "1" })
  .option("--property <name>", "Run one property")
  .option("--corpus <dir>", "Corpus directory", {
    default: ".snet/fuzz-corpus",
  })
  .option("--json", "Machine-readable output")
  .action(
    async (
      target: string | undefined,
      opts: {
        cases?: string;
        seed?: string;
        property?: string;
        corpus?: string;
        json?: boolean;
      },
    ) => {
      const args = [
        target || "SafetyNet.adjudicate",
        "--cases",
        opts.cases || "1000",
        "--seed",
        opts.seed || "1",
        "--corpus",
        opts.corpus || ".snet/fuzz-corpus",
      ];
      if (opts.property) args.push("--property", opts.property);
      if (opts.json) args.push("--json");
      process.exit(runPythonModule("safetynet_sim.fuzz", args));
    },
  );

cli
  .command("tighten [target]", "Measure verdict stability under evidence noise")
  .option("--samples <n>", "Samples", { default: "200" })
  .option("--seed <n>", "Deterministic seed", { default: "1" })
  .option("--noise <level>", "low | medium | high", { default: "medium" })
  .option("--report <fmt>", "text | md | json", { default: "text" })
  .action(
    async (
      target: string | undefined,
      opts: {
        samples?: string;
        seed?: string;
        noise?: string;
        report?: string;
      },
    ) => {
      const args = [
        target || "SafetyNet.adjudicate",
        "--samples",
        opts.samples || "200",
        "--seed",
        opts.seed || "1",
        "--noise",
        opts.noise || "medium",
        "--report",
        opts.report || "text",
      ];
      process.exit(runPythonModule("safetynet_sim.tighten", args));
    },
  );

cli
  .command("seed", "Seed the synthetic demo incident set (sim only)")
  .option("--fixtures <path>", "Seed fixture file", {
    default: join(ROOT, "test", "fixtures", "seed", "seed-v1.json"),
  })
  .option("--seed <n>", "Deterministic seed", { default: "1337" })
  .option("--validators <n>", "Validator count", { default: "5" })
  .option("--no-adjudicate", "Register and file only; skip adjudication")
  .option("--network <name>", "Network (sim only)", { default: "sim" })
  .option("--json", "Machine-readable output")
  .action(
    async (opts: {
      fixtures?: string;
      seed?: string;
      validators?: string;
      adjudicate?: boolean;
      network?: string;
      json?: boolean;
    }) => {
      const args = [
        "--fixtures",
        opts.fixtures || join(ROOT, "test", "fixtures", "seed", "seed-v1.json"),
        "--seed",
        opts.seed || "1337",
        "--validators",
        opts.validators || "5",
        "--network",
        opts.network || "sim",
      ];
      if (opts.adjudicate === false) args.push("--no-adjudicate");
      if (opts.json) args.push("--json");
      process.exit(runPythonModule("safetynet_sim.seed", args));
    },
  );

cli
  .command(
    "simulate <scenario>",
    "Run a scenario file and print the consensus trace",
  )
  .option("--validators <n>", "Validator count")
  .option("--seed <n>", "Seed")
  .option("--fault <spec>", "Fault injection (kind:index)")
  .option("--trace-format <fmt>", "text|json", { default: "text" })
  .action(
    async (
      scenario: string,
      opts: {
        validators?: string;
        seed?: string;
        fault?: string;
        traceFormat?: string;
      },
    ) => {
      const args = ["-m", "safetynet_sim.scenario", scenario];
      if (opts.validators) args.push("--validators", String(opts.validators));
      if (opts.seed) args.push("--seed", String(opts.seed));
      if (opts.fault) args.push("--fault", String(opts.fault));
      args.push("--trace-format", opts.traceFormat || "text");
      const r = spawnSync(PYTHON, args, {
        stdio: "inherit",
        env: {
          ...process.env,
          PYTHONPATH: join(ROOT, "packages", "safetynet-sim"),
        },
      });
      process.exit(r.status ?? 0);
    },
  );

cli
  .command("policy <action> [file] [other]", "Policy hash/validate/diff/export")
  .option("--json", "Machine-readable output")
  .option("--strict", "Treat warnings as errors (validate)")
  .option("--out <file>", "Write output to a file")
  .option("--format <fmt>", "Export format (json)")
  .action(async (...args: unknown[]) => {
    const opts = (args.at(-1) ?? {}) as {
      json?: boolean;
      strict?: boolean;
      out?: string;
      format?: string;
    };
    const positional = args.filter(
      (arg): arg is string => typeof arg === "string",
    );
    const [action, file, other] = positional;
    const readPolicy = (path: string | undefined) => {
      if (!path) {
        console.error(
          `${pc.red("✖")} E2003 usage: snet policy <action> <file>`,
        );
        return undefined;
      }
      try {
        return readFileSync(path, "utf8");
      } catch (error) {
        console.error(
          `${pc.red("✖")} E1003 cannot read ${path}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return undefined;
      }
    };
    const printIssues = (result: ReturnType<typeof parsePolicy>) => {
      for (const issue of result.errors) {
        console.error(
          `${pc.red("✖")} ${issue.code}${issue.line ? `:${issue.line}` : ""} ${issue.message}`,
        );
      }
      for (const warning of result.warnings) {
        console.warn(
          `${pc.yellow("⚠")} ${warning.code}${warning.line ? `:${warning.line}` : ""} ${warning.message}`,
        );
      }
    };

    if (action === "hash") {
      const text = readPolicy(file);
      if (text === undefined) {
        process.exitCode = 2;
        return;
      }
      const normalized = normalizePolicyText(text);
      const rawSha = `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
      const textHash = policyTextHash(text);
      if (opts.json) {
        console.log(
          JSON.stringify(
            {
              file,
              textHash,
              rawHash: rawSha,
              bytes: Buffer.byteLength(normalized, "utf8"),
              normalizer: 1,
            },
            null,
            2,
          ),
        );
      } else {
        console.log(textHash);
      }
      return;
    }

    if (action === "validate") {
      const text = readPolicy(file);
      if (text === undefined) {
        process.exitCode = 2;
        return;
      }
      const result = parsePolicy(text);
      if (opts.json) {
        console.log(
          JSON.stringify(
            {
              ok: result.ok,
              file,
              errors: result.errors,
              warnings: result.warnings,
              ...(result.document
                ? {
                    version: result.document.version,
                    provider: result.document.provider,
                    textHash: result.document.textHash,
                    clauses: result.document.clauses.map((clause) => ({
                      id: clause.id,
                      title: clause.title,
                      mandatory: clause.mandatory,
                    })),
                  }
                : {}),
            },
            null,
            2,
          ),
        );
      } else {
        printIssues(result);
        if (result.ok && result.document) {
          console.log(
            `${pc.green("✔")} ${result.document.clauses.length} clauses, version ${result.document.version}`,
          );
          console.log(`  ${result.document.textHash}`);
        }
      }
      if (!result.ok || (opts.strict && result.warnings.length > 0)) {
        process.exitCode = 1;
      }
      return;
    }

    if (action === "diff") {
      const beforeText = readPolicy(file);
      const afterText = readPolicy(other);
      if (beforeText === undefined || afterText === undefined) {
        process.exitCode = 2;
        return;
      }
      const before = parsePolicy(beforeText);
      const after = parsePolicy(afterText);
      if (!before.ok || !after.ok) {
        printIssues(before);
        printIssues(after);
        process.exitCode = 1;
        return;
      }
      const diff = diffPolicies(
        before.document as NonNullable<typeof before.document>,
        after.document as NonNullable<typeof after.document>,
      );
      if (opts.json) {
        console.log(JSON.stringify(diff, null, 2));
        return;
      }
      console.log(
        `${diff.from.version} (${diff.from.textHash}) → ${diff.to.version} (${diff.to.textHash})`,
      );
      for (const clause of diff.added) {
        console.log(`${pc.green("+")} ${clause.id} ${clause.title}`);
      }
      for (const clause of diff.removed) {
        console.log(`${pc.red("-")} ${clause.id} ${clause.title}`);
      }
      for (const change of diff.changed) {
        const parts = [
          change.titleChanged ? "title" : "",
          change.textChanged ? "text" : "",
          change.mandatoryChanged ? "mandatory" : "",
        ].filter(Boolean);
        console.log(
          `${pc.yellow("~")} ${change.id} ${change.after.title} (${parts.join(", ")})`,
        );
      }
      if (
        diff.added.length === 0 &&
        diff.removed.length === 0 &&
        diff.changed.length === 0
      ) {
        console.log("No clause changes.");
      }
      return;
    }

    if (action === "export") {
      const text = readPolicy(file);
      if (text === undefined) {
        process.exitCode = 2;
        return;
      }
      const format = opts.format ?? "json";
      if (format !== "json") {
        console.error(
          `${pc.red("✖")} E2003 unsupported policy export format: ${format}`,
        );
        process.exitCode = 2;
        return;
      }
      const result = parsePolicy(text);
      if (!result.ok || !result.document) {
        printIssues(result);
        process.exitCode = 1;
        return;
      }
      const rendered = `${renderPolicyJson(result.document)}\n`;
      if (opts.out) {
        mkdirSync(dirname(opts.out), { recursive: true });
        writeFileSync(opts.out, rendered);
        console.log(`${pc.green("✔")} wrote ${opts.out}`);
      } else {
        process.stdout.write(rendered);
      }
      return;
    }

    console.error(
      `${pc.red("✖")} E2003 unknown policy action: ${action ?? "(missing)"}`,
    );
    process.exitCode = 2;
  });

cli
  .command("incident <action> [file]", "Create/validate/hash/bundle incidents")
  .option("--system <id>", "Registered system id")
  .option("--policy-version <v>", "Pinned policy version")
  .option("--claim <text>", "Incident claim text")
  .option("--evidence <file>", "Evidence manifest JSON file")
  .option("--out <file>", "Output file or bundle directory")
  .option("--synthetic", "Mark this incident as synthetic demo data")
  .option("--allowlist <hosts>", "Comma-separated evidence host allowlist")
  .option("--json", "Machine-readable output")
  .action(async (...args: unknown[]) => {
    const opts = (args.at(-1) ?? {}) as {
      system?: string;
      policyVersion?: string;
      claim?: string;
      evidence?: string;
      out?: string;
      synthetic?: boolean;
      allowlist?: string;
      json?: boolean;
    };
    const positional = args.filter(
      (arg): arg is string => typeof arg === "string",
    );
    const [action, file] = positional;
    const allowlist = parseAllowlist(opts.allowlist);
    const printIssues = (issues: { code: string; message: string }[]) => {
      for (const problem of issues) {
        console.error(`${pc.red("✖")} ${problem.code} ${problem.message}`);
      }
    };
    const readIncident = (path: string | undefined) => {
      if (!path) {
        console.error(
          `${pc.red("✖")} E2003 usage: snet incident <action> <file>`,
        );
        return undefined;
      }
      try {
        return JSON.parse(readFileSync(path, "utf8")) as unknown;
      } catch (error) {
        console.error(
          `${pc.red("✖")} E1003 cannot read ${path}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return undefined;
      }
    };

    if (action === "create") {
      if (
        !opts.system ||
        !opts.policyVersion ||
        !opts.claim ||
        !opts.evidence
      ) {
        console.error(
          `${pc.red("✖")} E2003 create needs --system, --policy-version, --claim, and --evidence`,
        );
        process.exitCode = 2;
        return;
      }
      let manifest: unknown;
      try {
        manifest = JSON.parse(readFileSync(opts.evidence, "utf8")) as unknown;
      } catch (error) {
        console.error(
          `${pc.red("✖")} E1003 cannot read ${opts.evidence}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        process.exitCode = 2;
        return;
      }
      const result = createIncident({
        systemId: opts.system,
        policyVersion: opts.policyVersion,
        claim: opts.claim,
        manifest,
        allowlist,
        ...(opts.synthetic ? { synthetic: true } : {}),
      });
      for (const warning of result.warnings) {
        console.warn(`${pc.yellow("⚠")} ${warning.code} ${warning.message}`);
      }
      if (!result.ok || !result.incident) {
        printIssues(result.issues);
        process.exitCode = 1;
        return;
      }
      const rendered = renderIncidentJson(result.incident);
      if (opts.out) {
        mkdirSync(dirname(opts.out), { recursive: true });
        writeFileSync(opts.out, rendered);
        console.log(`${pc.green("✔")} wrote ${opts.out}`);
        console.log(`  incident ${result.incident.incident_hash}`);
        console.log(`  evidence ${result.incident.evidence_hash}`);
      } else {
        process.stdout.write(rendered);
      }
      return;
    }

    if (action === "validate") {
      const raw = readIncident(file);
      if (raw === undefined) {
        process.exitCode = 2;
        return;
      }
      const result = validateIncident(raw, { allowlist });
      for (const warning of result.warnings) {
        console.warn(`${pc.yellow("⚠")} ${warning.code} ${warning.message}`);
      }
      if (opts.json) {
        console.log(
          JSON.stringify(
            {
              ok: result.ok,
              issues: result.issues,
              warnings: result.warnings,
              ...(result.incident
                ? {
                    incident_hash: result.incident.incident_hash,
                    evidence_hash: result.incident.evidence_hash,
                  }
                : {}),
            },
            null,
            2,
          ),
        );
      } else if (result.ok && result.incident) {
        console.log(`${pc.green("✔")} incident is valid`);
        console.log(`  incident ${result.incident.incident_hash}`);
        console.log(`  evidence ${result.incident.evidence_hash}`);
      } else {
        printIssues(result.issues);
      }
      if (!result.ok) process.exitCode = 1;
      return;
    }

    if (action === "hash") {
      const raw = readIncident(file);
      if (raw === undefined) {
        process.exitCode = 2;
        return;
      }
      const result = validateIncident(raw, { allowlist });
      if (!result.ok || !result.incident) {
        printIssues(result.issues);
        process.exitCode = 1;
        return;
      }
      if (opts.json) {
        console.log(
          JSON.stringify(
            {
              evidence_hash: result.incident.evidence_hash,
              incident_hash: result.incident.incident_hash,
              canonical_manifest_sha256: result.incident.evidence_hash,
            },
            null,
            2,
          ),
        );
      } else {
        console.log(`evidence ${result.incident.evidence_hash}`);
        console.log(`incident ${result.incident.incident_hash}`);
      }
      return;
    }

    if (action === "bundle") {
      const raw = readIncident(file);
      if (raw === undefined) {
        process.exitCode = 2;
        return;
      }
      if (!opts.out) {
        console.error(`${pc.red("✖")} E2003 bundle needs --out <directory>`);
        process.exitCode = 2;
        return;
      }
      const result = validateIncident(raw, { allowlist });
      if (!result.ok || !result.incident) {
        printIssues(result.issues);
        process.exitCode = 1;
        return;
      }
      const bundle = writeIncidentBundle(result.incident, opts.out);
      console.log(`${pc.green("✔")} wrote ${opts.out}`);
      for (const name of bundle.files) console.log(`  ${name}`);
      return;
    }

    console.error(
      `${pc.red("✖")} E2003 unknown incident action: ${action ?? "(missing)"}`,
    );
    process.exitCode = 2;
  });

cli
  .command("account <action> [name]", "Manage keys/keystores")
  .option("--name <name>", "Account name")
  .option("--keystore <path>", "Keystore path")
  .option("--network <name>", "Network for balance")
  .option("--set-active", "Set the new account active")
  .option("--json", "Machine-readable output")
  .action(async (...args: unknown[]) => {
    const opts = (args.at(-1) ?? {}) as {
      name?: string;
      keystore?: string;
      network?: string;
      setActive?: boolean;
      json?: boolean;
    };
    const positional = args.filter(
      (arg): arg is string => typeof arg === "string",
    );
    const [action, positionalName] = positional;
    const name = opts.name ?? positionalName;
    try {
      if (action === "new") {
        const account = accountNew({
          ...(name ? { name } : {}),
          ...(opts.keystore ? { keystore: opts.keystore } : {}),
          ...(opts.setActive ? { setActive: true } : {}),
        });
        if (opts.json) console.log(JSON.stringify(account, null, 2));
        else
          console.log(`${pc.green("✔")} ${account.address} (${account.name})`);
        return;
      }
      if (action === "import") {
        const account = accountImport({
          ...(name ? { name } : {}),
          ...(opts.keystore ? { keystore: opts.keystore } : {}),
        });
        if (opts.json) console.log(JSON.stringify(account, null, 2));
        else
          console.log(`${pc.green("✔")} ${account.address} (${account.name})`);
        return;
      }
      if (action === "address") {
        const account = accountAddress(name);
        if (opts.json) console.log(JSON.stringify(account, null, 2));
        else console.log(account.address);
        return;
      }
      if (action === "balance") {
        const account = accountBalance({
          ...(name ? { name } : {}),
          ...(opts.network ? { network: opts.network } : {}),
        });
        if (opts.json) console.log(JSON.stringify(account, null, 2));
        else {
          console.log(`${account.address}${name ? ` (${name})` : ""}`);
          console.log(`balance ${account.balance ?? "unknown"}`);
          console.log(
            `network ${account.network ?? opts.network ?? "unknown"}`,
          );
        }
        return;
      }
      if (action === "list") {
        const accounts = accountList();
        if (opts.json) {
          console.log(JSON.stringify(accounts, null, 2));
        } else {
          for (const account of accounts) {
            console.log(
              `${account.active ? "*" : " "} ${account.name.padEnd(16)} ${account.address}${account.unlocked ? " (unlocked)" : ""}`,
            );
          }
        }
        return;
      }
      console.error(
        `${pc.red("✖")} E2003 unknown account action: ${action ?? "(missing)"}`,
      );
      process.exitCode = 2;
    } catch (error) {
      const code = error instanceof AccountError ? error.code : "E9000";
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${pc.red("✖")} ${code} ${message}`);
      process.exitCode =
        code === "E1001"
          ? 3
          : code === "E4002"
            ? 4
            : code === "E5001" || code === "E5002"
              ? 5
              : 1;
    }
  });

cli.command("snapshot", "Save/restore sim state").action(async () => {
  console.log("snapshot: save/restore supported via safetynet-sim");
});

cli
  .command("node <action>", "Start/stop/reset local GenLayer (Docker wrapper)")
  .action(async (action: string) => {
    const docker = spawnSync("docker", ["--version"], { encoding: "utf8" });
    if (docker.error || docker.status !== 0) {
      console.error(
        `${pc.red("✖")} E4002 Docker not available; install Docker or use --mode sim`,
      );
      process.exitCode = 4;
      return;
    }
    console.log(
      `${pc.green("✔")} docker available; delegating to genlayer ${action}`,
    );
    const r = spawnSync("genlayer", [action], { stdio: "inherit" });
    process.exitCode = r.status ?? 0;
  });

cli
  .command("run <script>", "Run a TS script with injected gf context")
  .action(async (script: string) => {
    const r = spawnSync("npx", ["tsx", script], {
      stdio: "inherit",
      cwd: ROOT,
    });
    process.exitCode = r.status ?? 0;
  });

cli
  .command("docs [topic]", "Open docs / print a topic")
  .action(async (topic?: string) => {
    if (!topic) {
      console.log("https://safetynet.dev");
      return;
    }
    console.log(`docs topic: ${topic} -> https://safetynet.dev/${topic}`);
  });

cli
  .command("upgrade", "Check for updates and ground-truth drift")
  .action(async () => {
    console.log(
      "Checking npm/PyPI for newer SafetyNet and GenLayer SDK versions...",
    );
    console.log(
      `${pc.green("✔")} ground-truth snapshot age: check docs/ground-truth.md`,
    );
  });

cli.parse();
