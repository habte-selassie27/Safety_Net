// DEP-020..024 — deployment verification.
//
// Levels implemented here:
//   L0 registry   deployment entry exists and the address/status are consistent
//   L1 schema     local source schema hash == on-chain schema hash
//   L2 source     normalized local source hash == on-chain code hash
//   L3 probes     read-only probes return the expected shapes
//   L4 config     get_config() domain values + evidence allowlist hash match
//
// The on-chain facts come from the GenLayer JSON-RPC surface documented in
// docs/ground-truth.md (`gen_getContractCode`, `gen_getContractSchema`,
// `gen_getContractSchemaForCode`). Reads use the `genlayer call` CLI so we do
// not duplicate the SDK calldata encoder here. No secrets are touched.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { canonicalJson } from "@safetynet/core";
import { getNetwork } from "@safetynet/core/ground-truth";

export interface DomainConfig {
  maxEvidenceItems: number;
  maxEvidenceBytes: number;
  maxPolicyClauses: number;
  appealWindowHours: number;
  maxAppeals: number;
  minProviderResponseHours: number;
}

export interface DeploymentRecord {
  address: string;
  txHash?: string;
  deployer?: string;
  sourcePath: string;
  sourceHash: string;
  schemaHash: string;
  normalizer: number;
  sdk?: string;
  safetyNetVersion?: string;
  domainConfig: DomainConfig;
  evidenceAllowlistHash: string;
  status?: string;
  [key: string]: unknown;
}

export interface DeploymentRegistry {
  schemaVersion: number;
  network: string;
  chainId: string;
  updatedAt?: string;
  contracts: Record<string, DeploymentRecord>;
  [key: string]: unknown;
}

export type ProbeExpectation = "object" | "integer" | "objectOrEmpty" | "empty";

export interface ProbeResult {
  name: string;
  method: string;
  args: string[];
  ok: boolean;
  expected: ProbeExpectation;
  observed: string;
  detail?: string;
}

export interface VerificationLevel {
  id: "L0" | "L1" | "L2" | "L3" | "L4";
  title: string;
  status: "pass" | "fail" | "skip";
  detail: string;
  warning?: string;
  hashes?: Record<string, string>;
  probes?: ProbeResult[];
  config?: Record<string, unknown>;
}

export type VerificationResult = "VERIFIED" | "PARTIAL" | "FAILED";

export interface VerificationReport {
  schemaVersion: 1;
  network: string;
  chainId: string;
  contract: string;
  address: string;
  verifiedAt: string;
  normalizer: 1;
  levels: VerificationLevel[];
  result: VerificationResult;
  ok: boolean;
  sourceHash: string;
  schemaHash: string;
  evidenceAllowlistHash: string;
  registryHash: string;
}

export interface VerifyOptions {
  root: string;
  network: string;
  /** Registry key, e.g. "SafetyNet". */
  contractName?: string;
  /** Local source path. Defaults to the registry's sourcePath. */
  contractPath?: string;
  address?: string;
  rpcUrl?: string;
  strict?: boolean;
  updateRegistry?: boolean;
  publish?: boolean;
  now?: () => string;
}

export interface RpcTransport {
  request(method: string, params: unknown[]): Promise<unknown>;
}

export interface ReadCaller {
  call(address: string, method: string, args: string[]): string;
}

export interface VerifyDependencies {
  rpc?: RpcTransport;
  caller?: ReadCaller;
}

export class VerificationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "VerificationError";
  }
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const SHA256_RE = /^sha256:[0-9a-f]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Normalize source text exactly once, before hashing (normalizer: 1). */
export function normalizeSource(text: string): string {
  const lf = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  return `${lf.replace(/\s+$/u, "")}\n`;
}

export function sha256Text(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

/** Normalized local source hash, as recorded in the registry. */
export function sourceHash(text: string): string {
  return sha256Text(normalizeSource(text));
}

/** Canonical schema hash (recursively sorted keys, compact separators). */
export function schemaHash(schema: unknown): string {
  return sha256Text(canonicalJson(schema));
}

/** Canonical evidence-allowlist hash: sorted, lowercase, deduplicated list. */
export function evidenceAllowlistHash(raw: string): string {
  const items = [
    ...new Set(
      raw
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].sort();
  return sha256Text(canonicalJson(items));
}

/** Extract the pinned SDK dependency header from contract source. */
export function sdkFromSource(text: string): string | undefined {
  const match = text.match(/"Depends"\s*:\s*"([^"]+)"/);
  return match?.[1];
}

/** Parse the text printed by `genlayer call` after its `Result:` marker. */
export function parseCallOutput(stdout: string): string {
  const marker = stdout.indexOf("Result:");
  if (marker < 0) {
    throw new VerificationError(
      "E5001",
      `could not find a Result section in genlayer call output: ${stdout
        .trim()
        .slice(0, 300)}`,
    );
  }
  let rest = stdout.slice(marker + "Result:".length);
  rest = rest.replace(/^\r?\n/u, "");
  const success = rest.indexOf("\n✔");
  if (success >= 0) rest = rest.slice(0, success);
  return rest.trim();
}

export function createHttpRpc(rpcUrl: string): RpcTransport {
  return {
    async request(method, params) {
      let response: Response;
      try {
        response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method,
            params,
          }),
          signal: AbortSignal.timeout(30_000),
        });
      } catch (error) {
        throw new VerificationError(
          "E5001",
          `RPC unreachable at ${rpcUrl}: ${errorMessage(error)}`,
        );
      }
      if (!response.ok) {
        throw new VerificationError(
          "E5001",
          `RPC HTTP ${response.status} from ${rpcUrl}`,
        );
      }
      const body = (await response.json()) as {
        result?: unknown;
        error?: { code?: number; message?: string };
      };
      if (body.error) {
        throw new VerificationError(
          "E5001",
          `${method}: ${body.error.message ?? "RPC error"}`,
        );
      }
      return body.result;
    },
  };
}

export function createGenlayerCaller(rpcUrl: string): ReadCaller {
  const binary = process.env.SNET_GENLAYER || "genlayer";
  return {
    call(address, method, args) {
      const argv = [
        "call",
        address,
        method,
        "--rpc",
        rpcUrl,
        ...(args.length > 0 ? ["--args", ...args] : []),
      ];
      const result = spawnSync(binary, argv, {
        encoding: "utf8",
        timeout: 60_000,
        maxBuffer: 4 * 1024 * 1024,
      });
      if (result.error) {
        throw new VerificationError(
          "E4003",
          `could not run ${binary}: ${result.error.message}. Install the GenLayer CLI or set SNET_GENLAYER.`,
        );
      }
      if (result.status !== 0) {
        throw new VerificationError(
          "E5001",
          `${method} failed (exit ${result.status ?? "?"}): ${(
            result.stderr ||
            result.stdout ||
            ""
          )
            .trim()
            .slice(0, 500)}`,
        );
      }
      return parseCallOutput(result.stdout ?? "");
    },
  };
}

/** Human-readable one-line summary of a verification report. */
export function formatVerification(report: VerificationReport): string {
  const lines = [
    `Verify ${report.contract} @ ${report.address || "(no address)"} (${report.network})`,
  ];
  for (const level of report.levels) {
    const icon =
      level.status === "pass" ? "✔" : level.status === "fail" ? "✖" : "—";
    const label = `${level.id} ${level.title}`.padEnd(15, " ");
    lines.push(`  ${label} ${icon} ${level.detail}`);
    if (level.warning) lines.push(`  ${" ".repeat(15)} ⚠ ${level.warning}`);
  }
  lines.push("");
  lines.push(
    `Result: ${report.result}${report.result === "PARTIAL" ? " (some levels unavailable)" : ""}`,
  );
  if (report.result === "FAILED") {
    lines.push("  one or more verification levels failed (E7001)");
  }
  return lines.join("\n");
}

interface ParsedProbeValue {
  kind: "empty" | "json" | "text";
  value?: unknown;
  raw: string;
}

function parseProbeValue(raw: string): ParsedProbeValue {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { kind: "empty", raw: trimmed };
  try {
    return { kind: "json", value: JSON.parse(trimmed), raw: trimmed };
  } catch {
    return { kind: "text", raw: trimmed };
  }
}

function probeObserved(parsed: ParsedProbeValue): string {
  if (parsed.kind === "empty") return "empty";
  if (parsed.kind === "text") return `text: ${parsed.raw.slice(0, 80)}`;
  if (parsed.value && typeof parsed.value === "object") {
    if (Array.isArray(parsed.value)) return `array(${parsed.value.length})`;
    return `object(${Object.keys(parsed.value as Record<string, unknown>).length} keys)`;
  }
  return `${typeof parsed.value}: ${String(parsed.value)}`;
}

function probeMatches(
  expectation: ProbeExpectation,
  parsed: ParsedProbeValue,
): boolean {
  if (expectation === "empty") return parsed.kind === "empty";
  if (expectation === "object")
    return (
      parsed.kind === "json" &&
      parsed.value !== null &&
      typeof parsed.value === "object" &&
      !Array.isArray(parsed.value)
    );
  if (expectation === "integer")
    return (
      parsed.kind === "json" &&
      typeof parsed.value === "number" &&
      Number.isInteger(parsed.value) &&
      parsed.value >= 0
    );
  return (
    parsed.kind === "empty" ||
    (parsed.kind === "json" &&
      parsed.value !== null &&
      typeof parsed.value === "object" &&
      !Array.isArray(parsed.value))
  );
}

const PROBES: Array<{
  name: string;
  method: string;
  args: string[];
  expect: ProbeExpectation;
}> = [
  { name: "config-readable", method: "get_config", args: [], expect: "object" },
  {
    name: "incident-counter",
    method: "get_incident_count",
    args: [],
    expect: "integer",
  },
  {
    name: "incident-view",
    method: "get_incident",
    args: ["inc-000001"],
    expect: "objectOrEmpty",
  },
  {
    name: "verdict-view",
    method: "get_verdict",
    args: ["inc-000001"],
    expect: "objectOrEmpty",
  },
  {
    name: "unknown-verdict-is-empty",
    method: "get_verdict",
    args: ["inc-does-not-exist"],
    expect: "empty",
  },
];

function runProbes(address: string, caller: ReadCaller): ProbeResult[] {
  return PROBES.map((probe) => {
    try {
      const raw = caller.call(address, probe.method, probe.args);
      const parsed = parseProbeValue(raw);
      const ok = probeMatches(probe.expect, parsed);
      const observed = probeObserved(parsed);
      return {
        name: probe.name,
        method: probe.method,
        args: probe.args,
        ok,
        expected: probe.expect,
        observed,
        ...(ok ? {} : { detail: `expected ${probe.expect}, got ${observed}` }),
      };
    } catch (error) {
      return {
        name: probe.name,
        method: probe.method,
        args: probe.args,
        ok: false,
        expected: probe.expect,
        observed: "error",
        detail: errorMessage(error),
      };
    }
  });
}

const CONFIG_FIELDS: Array<[onChain: string, registry: keyof DomainConfig]> = [
  ["max_evidence_items", "maxEvidenceItems"],
  ["max_evidence_bytes", "maxEvidenceBytes"],
  ["max_policy_clauses", "maxPolicyClauses"],
  ["appeal_window_hours", "appealWindowHours"],
  ["max_appeals", "maxAppeals"],
  ["min_provider_response_hours", "minProviderResponseHours"],
];

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/u.test(value)) return Number(value);
  return undefined;
}

function checkConfig(
  rawConfig: unknown,
  expected: DomainConfig | undefined,
  expectedAllowlistHash: string | undefined,
): {
  ok: boolean;
  detail: string;
  config?: Record<string, unknown>;
  allowlistHash?: string;
  warning?: string;
} {
  if (!rawConfig || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
    return { ok: false, detail: "get_config did not return an object" };
  }
  const raw = rawConfig as Record<string, unknown>;
  const config: Record<string, unknown> = {};
  const mismatches: string[] = [];
  for (const [onChain, camel] of CONFIG_FIELDS) {
    const value = asNumber(raw[onChain]);
    config[camel] = value;
    if (!expected) continue;
    if (value === undefined || value !== expected[camel]) {
      mismatches.push(
        `${onChain}=${String(raw[onChain])} (registry ${expected[camel]})`,
      );
    }
  }
  const allowlist =
    typeof raw.evidence_allowlist === "string" ? raw.evidence_allowlist : "";
  const allowlistHash = evidenceAllowlistHash(allowlist);
  config.evidence_allowlist = allowlist;
  let warning: string | undefined;
  if (expectedAllowlistHash && SHA256_RE.test(expectedAllowlistHash)) {
    if (allowlistHash !== expectedAllowlistHash) {
      mismatches.push(
        `evidence_allowlist ${allowlistHash} (registry ${expectedAllowlistHash})`,
      );
    }
  } else {
    warning =
      "registry has no evidenceAllowlistHash yet; run with --update-registry";
  }
  if (mismatches.length > 0) {
    return {
      ok: false,
      detail: `domain config mismatch: ${mismatches.join("; ")}`,
      config,
      allowlistHash,
      ...(warning ? { warning } : {}),
    };
  }
  return {
    ok: true,
    detail: `domain config matches registry; allowlist ${allowlistHash}`,
    config,
    allowlistHash,
    ...(warning ? { warning } : {}),
  };
}

function schemaSummary(schema: unknown): {
  methodCount: number;
  methods: string[];
  canonical: string;
} {
  const methods =
    schema && typeof schema === "object" && "methods" in schema
      ? ((schema as { methods?: Record<string, unknown> }).methods ?? {})
      : {};
  const names = Object.keys(methods).sort();
  return {
    methodCount: names.length,
    methods: names,
    canonical: canonicalJson(schema),
  };
}

function schemaDiff(
  local: ReturnType<typeof schemaSummary>,
  chain: ReturnType<typeof schemaSummary>,
): string {
  const localOnly = local.methods.filter((m) => !chain.methods.includes(m));
  const chainOnly = chain.methods.filter((m) => !local.methods.includes(m));
  if (localOnly.length === 0 && chainOnly.length === 0) {
    return "method names match but signatures differ";
  }
  const parts: string[] = [];
  if (localOnly.length > 0) parts.push(`local-only: ${localOnly.join(", ")}`);
  if (chainOnly.length > 0) parts.push(`chain-only: ${chainOnly.join(", ")}`);
  return parts.join("; ");
}

function isUnsupported(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("method not found") ||
    message.includes("not supported") ||
    message.includes("unsupported")
  );
}

function decodeContractCode(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  if (raw.startsWith("0x")) {
    const decoded = Buffer.from(raw.slice(2), "hex").toString("utf8");
    return decoded.length > 0 ? decoded : undefined;
  }
  const decoded = Buffer.from(raw, "base64").toString("utf8");
  return decoded.length > 0 ? decoded : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resolvePath(root: string, path: string): string {
  return isAbsolute(path) ? path : resolve(root, path);
}

function readRegistry(
  root: string,
  network: string,
): {
  path: string;
  raw: string;
  registry: DeploymentRegistry | undefined;
  error: string | undefined;
} {
  const path = join(root, "deployments", `${network}.json`);
  if (!existsSync(path)) {
    return {
      path,
      raw: "",
      registry: undefined,
      error: `E7002 no deployment registry at deployments/${network}.json`,
    };
  }
  const raw = readFileSync(path, "utf8");
  try {
    return {
      path,
      raw,
      registry: JSON.parse(raw) as DeploymentRegistry,
      error: undefined,
    };
  } catch (error) {
    return {
      path,
      raw,
      registry: undefined,
      error: `E7002 invalid deployment registry: ${errorMessage(error)}`,
    };
  }
}

function writeAtomic(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp-${process.pid}`;
  writeFileSync(temp, text);
  renameSync(temp, path);
}

export async function verifyDeployment(
  options: VerifyOptions,
  dependencies: VerifyDependencies = {},
): Promise<VerificationReport> {
  const now = options.now ?? (() => new Date().toISOString());
  const descriptor = getNetwork(options.network);
  if (!descriptor) {
    throw new VerificationError(
      "E1001",
      `unknown network "${options.network}"; known networks: local, studionet, asimov, bradbury`,
    );
  }
  const rpcUrl = options.rpcUrl ?? descriptor.rpcUrl;
  const rpc = dependencies.rpc ?? createHttpRpc(rpcUrl);
  const caller = dependencies.caller ?? createGenlayerCaller(rpcUrl);
  const contractName = options.contractName ?? "SafetyNet";
  const {
    path: registryPath,
    raw: registryRaw,
    registry,
    error: registryError,
  } = readRegistry(options.root, options.network);

  const levels: VerificationLevel[] = [];
  let entry: DeploymentRecord | undefined;
  let resolvedContractName = contractName;
  let address = options.address ?? "";

  // L0 — registry.
  {
    let status: VerificationLevel["status"] = "pass";
    let detail = "deployment entry found";
    let warning: string | undefined;
    if (registryError || !registry) {
      status = "fail";
      detail = registryError ?? "deployment registry is missing";
    } else {
      const candidates = Object.entries(registry.contracts ?? {});
      const byAddress = options.address
        ? candidates.find(
            ([, record]) =>
              record.address?.toLowerCase() === options.address?.toLowerCase(),
          )
        : undefined;
      if (byAddress) {
        resolvedContractName = byAddress[0];
        entry = byAddress[1];
      } else {
        entry = registry.contracts?.[contractName];
      }
      if (!entry) {
        status = "fail";
        detail = `E7002 no "${contractName}" deployment in deployments/${options.network}.json`;
      } else {
        address = entry.address ?? address;
        if (!ADDRESS_RE.test(address)) {
          status = "fail";
          detail = `E7002 invalid deployed address "${address}"`;
        } else if (
          options.address &&
          entry.address?.toLowerCase() !== options.address.toLowerCase()
        ) {
          status = "fail";
          detail = `E7002 registry address ${entry.address} does not match --address ${options.address}`;
        } else if (
          entry.status &&
          !["ACCEPTED", "FINALIZED"].includes(entry.status)
        ) {
          status = "fail";
          detail = `E7002 deployment status is ${entry.status}, expected ACCEPTED or FINALIZED`;
        } else {
          detail = `address ${address} recorded${entry.txHash ? ` (tx ${entry.txHash.slice(0, 10)}…)` : ""}`;
          const hashesRecorded =
            SHA256_RE.test(entry.sourceHash ?? "") &&
            SHA256_RE.test(entry.schemaHash ?? "") &&
            SHA256_RE.test(entry.evidenceAllowlistHash ?? "");
          if (!hashesRecorded) {
            warning =
              "registry has pending hashes; rerun with --update-registry after checks pass";
          }
        }
      }
    }
    levels.push({
      id: "L0",
      title: "registry",
      status,
      detail,
      ...(warning ? { warning } : {}),
    });
  }

  // Local source is required for L1/L2. Missing source is a verification
  // failure, not a reason to silently claim success.
  const localPathInput =
    options.contractPath ?? entry?.sourcePath ?? "contracts/safetynet.py";
  const localPath = resolvePath(options.root, localPathInput);
  let localSource = "";
  let localSourceRead = false;
  if (existsSync(localPath)) {
    localSource = readFileSync(localPath, "utf8");
    localSourceRead = true;
  } else {
    levels.push({
      id: "L1",
      title: "schema",
      status: "fail",
      detail: `E7002 local source not found at ${localPathInput}`,
    });
    levels.push({
      id: "L2",
      title: "source",
      status: "fail",
      detail: `E7002 local source not found at ${localPathInput}`,
    });
  }

  let localSchema: ReturnType<typeof schemaSummary> | undefined;
  let chainSchema: ReturnType<typeof schemaSummary> | undefined;
  let localSchemaHash = "";
  let chainSchemaHash = "";

  if (localSourceRead) {
    // L1 — schema.
    try {
      const schema = await rpc.request("gen_getContractSchemaForCode", [
        `0x${Buffer.from(localSource, "utf8").toString("hex")}`,
      ]);
      localSchema = schemaSummary(schema);
      localSchemaHash = schemaHash(schema);
    } catch (error) {
      levels.push({
        id: "L1",
        title: "schema",
        status: isUnsupported(error) ? "skip" : "fail",
        detail: isUnsupported(error)
          ? `local schema generation unavailable: ${errorMessage(error)}`
          : `E5001 local schema generation failed: ${errorMessage(error)}`,
      });
    }

    if (localSchema) {
      if (!address) {
        levels.push({
          id: "L1",
          title: "schema",
          status: "fail",
          detail: "cannot compare schema without a deployed address",
        });
      } else {
        try {
          const schema = await rpc.request("gen_getContractSchema", [address]);
          chainSchema = schemaSummary(schema);
          chainSchemaHash = schemaHash(schema);
          const ok = localSchemaHash === chainSchemaHash;
          levels.push({
            id: "L1",
            title: "schema",
            status: ok ? "pass" : "fail",
            detail: ok
              ? `${localSchema.methodCount} methods match (schema ${localSchemaHash})`
              : `E7001 schema mismatch: ${localSchemaHash} vs ${chainSchemaHash} (${schemaDiff(localSchema, chainSchema)})`,
            hashes: {
              local: localSchemaHash,
              chain: chainSchemaHash,
            },
          });
        } catch (error) {
          levels.push({
            id: "L1",
            title: "schema",
            status: isUnsupported(error) ? "skip" : "fail",
            detail: isUnsupported(error)
              ? `on-chain schema unavailable: ${errorMessage(error)}`
              : `E5001 on-chain schema read failed: ${errorMessage(error)}`,
          });
        }
      }
    }

    // L2 — source.
    const localHash = sourceHash(localSource);
    if (!address) {
      levels.push({
        id: "L2",
        title: "source",
        status: "fail",
        detail: "cannot compare source without a deployed address",
      });
    } else {
      try {
        let raw = await rpc.request("gen_getContractCode", [address]);
        if (typeof raw !== "string") {
          raw = await rpc.request("gen_getContractCode", [{ address }]);
        }
        const chainSource = decodeContractCode(raw);
        if (!chainSource) {
          levels.push({
            id: "L2",
            title: "source",
            status: "skip",
            detail: "on-chain source is empty or unavailable",
          });
        } else {
          const chainHash = sourceHash(chainSource);
          const ok = localHash === chainHash;
          levels.push({
            id: "L2",
            title: "source",
            status: ok ? "pass" : "fail",
            detail: ok
              ? `on-chain code hash == local (${localHash})`
              : `E7001 source mismatch: local ${localHash} vs chain ${chainHash}`,
            hashes: { local: localHash, chain: chainHash },
          });
        }
      } catch (error) {
        levels.push({
          id: "L2",
          title: "source",
          status: isUnsupported(error) ? "skip" : "fail",
          detail: isUnsupported(error)
            ? `on-chain source unavailable: ${errorMessage(error)}`
            : `E5001 on-chain source read failed: ${errorMessage(error)}`,
        });
      }
    }
  }

  // L3 — read-only probes. These also feed L4.
  let probes: ProbeResult[] = [];
  if (!address) {
    levels.push({
      id: "L3",
      title: "probes",
      status: "fail",
      detail: "cannot run probes without a deployed address",
    });
  } else {
    probes = runProbes(address, caller);
    const passed = probes.filter((probe) => probe.ok).length;
    const failed = probes.filter((probe) => !probe.ok);
    levels.push({
      id: "L3",
      title: "probes",
      status: failed.length === 0 ? "pass" : "fail",
      detail:
        failed.length === 0
          ? `${passed}/${probes.length} read probes passed`
          : `${failed.length}/${probes.length} probes failed: ${failed
              .map((probe) => probe.name)
              .join(", ")}`,
      probes,
    });
  }

  // L4 — domain config + allowlist.
  if (entry) {
    const configProbe = probes.find((probe) => probe.method === "get_config");
    if (!configProbe?.ok) {
      levels.push({
        id: "L4",
        title: "config",
        status: "fail",
        detail: "get_config probe did not return a usable object",
      });
    } else {
      try {
        const rawConfig = caller.call(address, "get_config", []);
        const parsed = parseProbeValue(rawConfig);
        const checked = checkConfig(
          parsed.kind === "json" ? parsed.value : undefined,
          entry.domainConfig,
          entry.evidenceAllowlistHash,
        );
        levels.push({
          id: "L4",
          title: "config",
          status: checked.ok ? "pass" : "fail",
          detail: checked.detail,
          ...(checked.config ? { config: checked.config } : {}),
          ...(checked.warning ? { warning: checked.warning } : {}),
        });
      } catch (error) {
        levels.push({
          id: "L4",
          title: "config",
          status: "fail",
          detail: `E5001 get_config failed: ${errorMessage(error)}`,
        });
      }
    }
  } else {
    levels.push({
      id: "L4",
      title: "config",
      status: "fail",
      detail: "no registry entry to compare config against",
    });
  }

  const failed = levels.some((level) => level.status === "fail");
  const skipped = levels.some((level) => level.status === "skip");
  const result: VerificationResult = failed
    ? "FAILED"
    : skipped
      ? "PARTIAL"
      : "VERIFIED";

  const l4 = levels.find((level) => level.id === "L4");
  const onChainConfig = l4?.config;
  const finalSourceHash = localSourceRead ? sourceHash(localSource) : "";
  const finalSchemaHash = localSchemaHash;
  const finalAllowlistHash =
    typeof onChainConfig?.evidence_allowlist === "string"
      ? evidenceAllowlistHash(onChainConfig.evidence_allowlist)
      : "";

  let registryHash = registryRaw ? sha256Text(registryRaw) : "";

  // Optional registry update. Only write after every substantive level passes;
  // this never changes the deployed address.
  if (
    options.updateRegistry &&
    entry &&
    registry &&
    !levels
      .filter((level) => ["L1", "L2", "L3", "L4"].includes(level.id))
      .some((level) => level.status !== "pass")
  ) {
    const record = registry.contracts[resolvedContractName];
    if (record) {
      record.sourcePath = localPathInput;
      record.sourceHash = finalSourceHash;
      record.schemaHash = finalSchemaHash;
      record.evidenceAllowlistHash =
        finalAllowlistHash || record.evidenceAllowlistHash;
      record.normalizer = 1;
      record.updatedAt = now();
      const sdk = sdkFromSource(localSource);
      if (sdk) record.sdk = sdk;
      if (onChainConfig) {
        record.domainConfig = {
          maxEvidenceItems: Number(onChainConfig.maxEvidenceItems),
          maxEvidenceBytes: Number(onChainConfig.maxEvidenceBytes),
          maxPolicyClauses: Number(onChainConfig.maxPolicyClauses),
          appealWindowHours: Number(onChainConfig.appealWindowHours),
          maxAppeals: Number(onChainConfig.maxAppeals),
          minProviderResponseHours: Number(
            onChainConfig.minProviderResponseHours,
          ),
        };
      }
      registry.updatedAt = now();
      registry.chainId = descriptor.chainId;
      const text = `${JSON.stringify(registry, null, 2)}\n`;
      writeAtomic(registryPath, text);
      registryHash = sha256Text(text);
    }
  }

  const report: VerificationReport = {
    schemaVersion: 1,
    network: options.network,
    chainId: descriptor.chainId,
    contract: resolvedContractName,
    address,
    verifiedAt: now(),
    normalizer: 1,
    levels,
    result,
    ok: result === "VERIFIED",
    sourceHash: finalSourceHash,
    schemaHash: finalSchemaHash,
    evidenceAllowlistHash: finalAllowlistHash,
    registryHash,
  };

  if (options.publish) {
    const artifactPath = join(
      options.root,
      "deployments",
      `${options.network}.verification.json`,
    );
    writeAtomic(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  return report;
}

/** Advisory string used by the CLI when a report is only partially verified. */
export function verificationExitCode(
  report: VerificationReport,
  strict: boolean,
): number {
  if (report.result === "FAILED") return 7;
  if (strict && report.result === "PARTIAL") return 7;
  return 0;
}

export const VERIFY_ZERO_ADDRESS = ZERO_ADDRESS;
