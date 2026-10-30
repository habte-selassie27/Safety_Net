// CLI-011 / DEP-005..010 — scripted, safe deployment.
//
// This command deliberately wraps the official `genlayer deploy` CLI instead
// of re-implementing the SDK transaction path. It adds the SafetyNet-specific
// safety rails: a plan, an explicit confirmation, a lint gate, an atomic
// registry write, and an optional verification pass.
//
// Secrets never pass through this module. The GenLayer CLI resolves the active
// account itself; we only print its public address.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { getNetwork } from "@safetynet/core/ground-truth";
import {
  type DeploymentRecord,
  type DeploymentRegistry,
  type DomainConfig,
  createHttpRpc,
  evidenceAllowlistHash,
  schemaHash,
  sdkFromSource,
  sourceHash,
  verifyDeployment,
} from "./verify";

export const DEFAULT_SAFETYNET_ARGS: unknown[] = [
  8,
  20_000,
  24,
  72,
  1,
  48,
  "example.com,raw.githubusercontent.com",
];

export const DEFAULT_DOMAIN_CONFIG: DomainConfig = {
  maxEvidenceItems: 8,
  maxEvidenceBytes: 20_000,
  maxPolicyClauses: 24,
  appealWindowHours: 72,
  maxAppeals: 1,
  minProviderResponseHours: 48,
};

export interface DeployPlan {
  contract: string;
  contractPath: string;
  network: string;
  chainId: string;
  rpcUrl: string;
  account: string;
  args: unknown[];
  sourceHash: string;
  schemaHash: string;
  tag: string;
  dryRun: boolean;
}

export interface DeployOptions {
  root: string;
  contractPath: string;
  network: string;
  args?: string;
  tag?: string;
  rpcUrl?: string;
  dryRun?: boolean;
  yes?: boolean;
  skipChecks?: boolean;
  verify?: boolean;
  json?: boolean;
  python?: string;
  pythonPath?: string;
  now?: () => string;
  onPlan?: (plan: DeployPlan) => void;
}

export interface DeployResult {
  ok: boolean;
  network: string;
  chainId: string;
  contract: string;
  address: string;
  txHash: string;
  sourceHash: string;
  schemaHash: string;
  registryPath: string;
  dryRun: boolean;
  verified?: string;
}

export class DeployError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly exitCode = 1,
  ) {
    super(message);
    this.name = "DeployError";
  }
}

/** Parse `--args` as a JSON array, or as `@file` containing one. */
export function parseDeployArgs(
  raw: string | undefined,
  contractPath: string,
): unknown[] {
  if (raw === undefined) {
    return basename(contractPath) === "safetynet.py"
      ? [...DEFAULT_SAFETYNET_ARGS]
      : [];
  }
  const text = raw.startsWith("@") ? readFileSync(raw.slice(1), "utf8") : raw;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new DeployError(
      "E2004",
      `--args is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!Array.isArray(parsed)) {
    throw new DeployError("E2004", "--args must be a JSON array");
  }
  return parsed;
}

/** Extract the public active account from `genlayer account list`. */
export function parseActiveAccount(output: string): string | undefined {
  for (const line of output.split("\n")) {
    const match = /^\*\s+\S+\s+(0x[0-9a-fA-F]{40})/u.exec(line.trim());
    if (match?.[1]) return match[1];
  }
  return undefined;
}

function stripAnsi(text: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequences
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}

/** Parse the two labelled values printed by `genlayer deploy`. */
export function parseDeployOutput(output: string): {
  address?: string;
  txHash?: string;
} {
  const text = stripAnsi(output);
  const address =
    /Contract Address:\s*(0x[0-9a-fA-F]{40})/u.exec(text)?.[1] ??
    /deployed at the address\s+"?(0x[0-9a-fA-F]{40})"?/iu.exec(text)?.[1];
  const txHash = /Deployment Transaction Hash:\s*(0x[0-9a-fA-F]{64})/u.exec(
    text,
  )?.[1];
  return {
    ...(address ? { address } : {}),
    ...(txHash ? { txHash } : {}),
  };
}

/** Turn the constructor args into the domain config recorded in the registry. */
export function domainConfigFromArgs(args: unknown[]): {
  domainConfig: DomainConfig;
  allowlist: string;
} {
  if (args.length < 6) {
    return {
      domainConfig: { ...DEFAULT_DOMAIN_CONFIG },
      allowlist: "",
    };
  }
  const numbers = args.slice(0, 6).map((value) => Number(value));
  if (numbers.some((value) => !Number.isInteger(value) || value < 0)) {
    throw new DeployError(
      "E2004",
      "the first six constructor args must be non-negative integers",
    );
  }
  return {
    domainConfig: {
      maxEvidenceItems: numbers[0] as number,
      maxEvidenceBytes: numbers[1] as number,
      maxPolicyClauses: numbers[2] as number,
      appealWindowHours: numbers[3] as number,
      maxAppeals: numbers[4] as number,
      minProviderResponseHours: numbers[5] as number,
    },
    allowlist: typeof args[6] === "string" ? args[6] : "",
  };
}

function activeAccount(): string | undefined {
  const result = spawnSync("genlayer", ["account", "list"], {
    encoding: "utf8",
    timeout: 30_000,
  });
  if (result.status !== 0) return undefined;
  return parseActiveAccount(result.stdout ?? "");
}

function runLint(
  root: string,
  contractPath: string,
  python: string,
  pythonPath: string,
): void {
  const result = spawnSync(
    python,
    ["-m", "safetynet_lint.cli", contractPath, "--preset", "predeploy"],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, PYTHONPATH: pythonPath },
    },
  );
  if (result.status !== 0) {
    throw new DeployError(
      "E7001",
      `lint gate failed:\n${(result.stdout || result.stderr || "").trim().slice(0, 2_000)}`,
    );
  }
}

function writeAtomic(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp-${process.pid}`;
  writeFileSync(temp, text);
  renameSync(temp, path);
}

function registryEntry(
  existing: DeploymentRecord | undefined,
  args: {
    address: string;
    txHash: string;
    deployer: string;
    contractPath: string;
    source: string;
    schemaHash: string;
    domainConfig: DomainConfig;
    allowlist: string;
    tag: string;
    now: string;
  },
): DeploymentRecord {
  const history = Array.isArray(existing?.history)
    ? (existing.history as unknown[]).slice(0, 19)
    : [];
  if (existing?.address && existing.address !== args.address) {
    history.unshift({
      address: existing.address,
      txHash: existing.txHash,
      sourceHash: existing.sourceHash,
      deployedAt: existing.deployedAt,
      tag: existing.tag,
    });
  }
  return {
    ...existing,
    address: args.address,
    txHash: args.txHash,
    deployer: args.deployer,
    sourcePath: args.contractPath,
    sourceHash: sourceHash(args.source),
    schemaHash: args.schemaHash,
    normalizer: 1,
    ...(sdkFromSource(args.source)
      ? { sdk: sdkFromSource(args.source) as string }
      : {}),
    safetyNetVersion: "0.1.0",
    domainConfig: args.domainConfig,
    evidenceAllowlistHash: args.allowlist
      ? evidenceAllowlistHash(args.allowlist)
      : (existing?.evidenceAllowlistHash ?? ""),
    tag: args.tag,
    status: "ACCEPTED",
    deployedAt: args.now,
    seeded: false,
    history,
  };
}

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} (y/N) `);
    return /^y(es)?$/iu.test(answer.trim());
  } finally {
    rl.close();
  }
}

function runDeploy(
  root: string,
  contractPath: string,
  rpcUrl: string,
  args: unknown[],
): { stdout: string; stderr: string; status: number } {
  const argv = ["deploy", "--contract", contractPath, "--rpc", rpcUrl];
  if (args.length > 0) {
    argv.push(
      "--args",
      ...args.map((value) =>
        typeof value === "string" ? value : JSON.stringify(value),
      ),
    );
  }
  const result = spawnSync("genlayer", argv, {
    cwd: root,
    encoding: "utf8",
    timeout: 600_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) {
    throw new DeployError(
      "E4003",
      `could not run genlayer: ${result.error.message}`,
    );
  }
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 1,
  };
}

/**
 * Deploy a contract and update `deployments/<network>.json` atomically.
 *
 * The caller owns presentation; this function returns structured data and
 * throws `DeployError` with a stable code on every failure path.
 */
export async function deployContract(
  options: DeployOptions,
): Promise<DeployResult> {
  const now = options.now ?? (() => new Date().toISOString());
  const descriptor = getNetwork(options.network);
  if (!descriptor) {
    throw new DeployError(
      "E1001",
      `unknown network "${options.network}"; known networks: local, studionet, asimov, bradbury`,
      3,
    );
  }
  const rpcUrl = options.rpcUrl ?? descriptor.rpcUrl;
  const contractInput = options.contractPath;
  const contractPath = isAbsolute(contractInput)
    ? contractInput
    : resolve(options.root, contractInput);
  if (!existsSync(contractPath)) {
    throw new DeployError("E7002", `contract not found: ${contractInput}`);
  }
  const source = readFileSync(contractPath, "utf8");
  if (!/"Depends"\s*:/u.test(source)) {
    throw new DeployError("E7001", "missing SDK dependency header (SI001)");
  }
  if (!options.skipChecks) {
    runLint(
      options.root,
      contractPath,
      options.python ?? process.env.SNET_PYTHON ?? "python3",
      options.pythonPath ?? "",
    );
  }

  const args = parseDeployArgs(options.args, contractPath);
  const { domainConfig, allowlist } = domainConfigFromArgs(args);
  const deployer = activeAccount() ?? "";
  const localSourceHash = sourceHash(source);

  let localSchemaHash = "";
  try {
    const schema = await createHttpRpc(rpcUrl).request(
      "gen_getContractSchemaForCode",
      [`0x${Buffer.from(source, "utf8").toString("hex")}`],
    );
    localSchemaHash = schemaHash(schema);
  } catch {
    // Schema generation is advisory here; the deploy itself can still proceed.
    // `--verify` records the real on-chain schema afterwards.
  }

  const plan: DeployPlan = {
    contract: basename(contractPath).replace(/\.py$/u, ""),
    contractPath: contractInput,
    network: options.network,
    chainId: descriptor.chainId,
    rpcUrl,
    account: deployer,
    args,
    sourceHash: localSourceHash,
    schemaHash: localSchemaHash,
    tag: options.tag ?? "v0.1.0",
    dryRun: options.dryRun ?? false,
  };
  options.onPlan?.(plan);

  if (options.dryRun) {
    return {
      ok: true,
      network: options.network,
      chainId: descriptor.chainId,
      contract: basename(contractPath).replace(/\.py$/u, ""),
      address: "",
      txHash: "",
      sourceHash: localSourceHash,
      schemaHash: localSchemaHash,
      registryPath: join(
        options.root,
        "deployments",
        `${options.network}.json`,
      ),
      dryRun: true,
    };
  }

  if (!options.yes) {
    const ok = await confirm(
      `Deploy ${basename(contractPath)} to ${options.network} (chain ${descriptor.chainId})?`,
    );
    if (!ok) throw new DeployError("E2001", "deployment aborted", 8);
  }

  const deployed = runDeploy(options.root, contractPath, rpcUrl, args);
  const parsed = parseDeployOutput(`${deployed.stdout}\n${deployed.stderr}`);
  if (deployed.status !== 0 || !parsed.address) {
    throw new DeployError(
      "E5002",
      `deployment failed (exit ${deployed.status}):\n${stripAnsi(
        `${deployed.stdout}\n${deployed.stderr}`,
      )
        .trim()
        .slice(0, 2_000)}`,
      6,
    );
  }

  const registryPath = join(
    options.root,
    "deployments",
    `${options.network}.json`,
  );
  let registry: DeploymentRegistry = {
    schemaVersion: 1,
    network: options.network,
    chainId: descriptor.chainId,
    contracts: {},
  };
  if (existsSync(registryPath)) {
    registry = JSON.parse(
      readFileSync(registryPath, "utf8"),
    ) as DeploymentRegistry;
  }
  const contractName = basename(contractPath).replace(/\.py$/u, "");
  const existing = registry.contracts?.[contractName];
  const entry = registryEntry(existing, {
    address: parsed.address,
    txHash: parsed.txHash ?? "",
    deployer,
    contractPath: contractInput,
    source,
    schemaHash: localSchemaHash,
    domainConfig,
    allowlist,
    tag: options.tag ?? "v0.1.0",
    now: now(),
  });
  registry.contracts = {
    ...(registry.contracts ?? {}),
    [contractName]: entry,
  };
  registry.updatedAt = now();
  registry.chainId = descriptor.chainId;
  writeAtomic(registryPath, `${JSON.stringify(registry, null, 2)}\n`);

  let verified: string | undefined;
  if (options.verify) {
    const report = await verifyDeployment({
      root: options.root,
      network: options.network,
      contractName,
      contractPath: contractInput,
      rpcUrl,
      updateRegistry: true,
      publish: true,
      now,
    });
    verified = report.result;
  }

  return {
    ok: true,
    network: options.network,
    chainId: descriptor.chainId,
    contract: contractName,
    address: parsed.address,
    txHash: parsed.txHash ?? "",
    sourceHash: localSourceHash,
    schemaHash: localSchemaHash,
    registryPath,
    dryRun: false,
    ...(verified ? { verified } : {}),
  };
}
