import { createHash } from "node:crypto";
import {
  CONFIDENCES,
  INCIDENT_STATUSES,
  REASON_CODES,
  SEVERITIES,
  VERDICTS,
} from "@safetynet/core";

/**
 * A public method extracted from the contract source.
 *
 * @example
 * ```ts
 * const schema = extractSafetyNetSchema(source);
 * schema.methods.views[0].name; // "get_config"
 * ```
 */
export interface ContractMethod {
  name: string;
  type: "view" | "write";
  args: string[];
  returns: string;
}

/** Canonical schema written to `.snet/artifacts/SafetyNet.schema.json`. */
export interface ContractSchema {
  contract: string;
  sourceHash: string;
  enums: {
    verdicts: string[];
    severities: string[];
    confidences: string[];
    incidentStatuses: string[];
  };
  reasonCodes: {
    contract: string[];
    unknown: string[];
    unused: string[];
  };
  parity: Record<string, boolean>;
  methods: {
    views: ContractMethod[];
    writes: ContractMethod[];
    summary: { total: number; views: number; writes: number };
  };
}

/** Class-body indentation; anything deeper is a nested helper. */
const PUBLIC_METHOD_INDENT = 4;

/** Per AGENTS.md §32.9, the contract should stay at or below this size. */
export const MAX_CONTRACT_LINES = 500;

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const left = [...new Set(a)].sort();
  const right = [...new Set(b)].sort();
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function enumTuple(source: string, name: string): string[] {
  const match = source.match(new RegExp(`^${name}\\s*=\\s*\\(([^)]*)\\)`, "m"));
  if (!match) return [];
  return String(match[1] ?? "")
    .split(",")
    .map((value) => value.trim().replace(/^["']|["']$/g, ""))
    .filter((value) => value.length > 0);
}

function lastUppercaseLiteral(line: string): string | null {
  const re = /"([A-Z][A-Z0-9_]+)"/g;
  let match: RegExpExecArray | null = re.exec(line);
  let last: string | null = null;
  while (match !== null) {
    last = match[1] ?? null;
    match = re.exec(line);
  }
  return last;
}

/**
 * Parse a GenLayer contract into the SafetyNet contract schema.
 *
 * Only class-level public methods are reported: nested helpers such as the
 * `evaluate()` closure inside `adjudicate` are skipped by indentation.
 *
 * @example
 * ```ts
 * const schema = extractSafetyNetSchema(readFileSync("contracts/safetynet.py", "utf8"));
 * schema.methods.summary.total; // 19
 * ```
 */
export function extractSafetyNetSchema(source: string): ContractSchema {
  const lines = source.split("\n");
  const methods: ContractMethod[] = [];
  let kind: "view" | "write" = "view";
  let capture: string | null = null;
  let captureIndent = 0;

  const flush = () => {
    if (capture === null) return;
    const signature = capture;
    const indent = captureIndent;
    capture = null;
    if (indent > PUBLIC_METHOD_INDENT) return; // nested helper, not public API
    const def = signature.match(
      /^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/,
    );
    if (!def) return;
    const name = def[1] ?? "";
    if (!name || name.startsWith("_")) return;
    const args = String(def[2] ?? "")
      .split(",")
      .map((param) => (param.trim().split(":")[0] ?? "").trim())
      .filter((param) => param.length > 0 && param !== "self");
    const arrow = signature.match(/->\s*([A-Za-z_][A-Za-z0-9_]*)/);
    methods.push({ name, type: kind, args, returns: arrow?.[1] ?? "void" });
  };

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (capture !== null) {
      capture = `${capture} ${trimmed}`;
      const opens = (capture.match(/\(/g) ?? []).length;
      const closes = (capture.match(/\)/g) ?? []).length;
      if (opens > closes) continue;
      flush();
      continue;
    }
    if (trimmed.startsWith("@")) {
      if (/\bwrite\b/.test(trimmed)) kind = "write";
      else if (/\bview\b/.test(trimmed)) kind = "view";
      continue;
    }
    if (!/^def\s+/.test(trimmed)) continue;
    capture = trimmed;
    captureIndent = raw.length - raw.trimStart().length;
    const opens = (capture.match(/\(/g) ?? []).length;
    const closes = (capture.match(/\)/g) ?? []).length;
    if (opens <= closes) flush();
  }
  flush();

  const enums = {
    verdicts: enumTuple(source, "VERDICTS"),
    severities: enumTuple(source, "SEVERITIES"),
    confidences: enumTuple(source, "CONFIDENCES"),
    incidentStatuses: enumTuple(source, "INCIDENT_STATUSES"),
  };

  // Join continuation lines so multi-line `_require(...)` calls are scanned
  // as one statement; otherwise the code literal on its own line is missed.
  const statements: string[] = [];
  let buffer = "";
  let depth = 0;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (buffer === "" && trimmed.length === 0) continue;
    buffer = buffer ? `${buffer} ${trimmed}` : trimmed;
    depth += (raw.match(/\(/g) ?? []).length - (raw.match(/\)/g) ?? []).length;
    if (depth <= 0) {
      statements.push(buffer);
      buffer = "";
      depth = 0;
    }
  }
  if (buffer) statements.push(buffer);

  const contractCodes = new Set<string>();
  for (const statement of statements) {
    if (
      !statement.includes("_require(") &&
      !statement.includes("UserError(") &&
      !statement.includes('"reason"')
    ) {
      continue;
    }
    const code = lastUppercaseLiteral(statement);
    if (code) contractCodes.add(code);
  }

  const coreEnums = {
    verdicts: Array.from(VERDICTS),
    severities: Array.from(SEVERITIES),
    confidences: Array.from(CONFIDENCES),
    incidentStatuses: Array.from(INCIDENT_STATUSES),
  };
  const coreCodes = new Set<string>(REASON_CODES);
  const contractReasonCodes = Array.from(contractCodes).sort();
  const unknown = contractReasonCodes.filter((code) => !coreCodes.has(code));
  const unused = Array.from(coreCodes)
    .filter((code) => !contractCodes.has(code))
    .sort();

  const parity = {
    verdicts: sameSet(enums.verdicts, coreEnums.verdicts),
    severities: sameSet(enums.severities, coreEnums.severities),
    confidences: sameSet(enums.confidences, coreEnums.confidences),
    incidentStatuses: sameSet(
      enums.incidentStatuses,
      coreEnums.incidentStatuses,
    ),
    reasonCodes: unknown.length === 0,
  };

  const views = methods.filter((method) => method.type === "view");
  const writes = methods.filter((method) => method.type === "write");

  return {
    contract: "SafetyNet",
    sourceHash: `sha256:${createHash("sha256").update(source, "utf8").digest("hex")}`,
    enums,
    reasonCodes: { contract: contractReasonCodes, unknown, unused },
    parity,
    methods: {
      views,
      writes,
      summary: {
        total: methods.length,
        views: views.length,
        writes: writes.length,
      },
    },
  };
}
