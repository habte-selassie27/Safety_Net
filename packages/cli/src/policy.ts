// Policy document parsing, validation, hashing, and diffing (POL-001..005).
//
// The policy is the standard SafetyNet holds a provider to. The parser is
// deliberately strict: front matter is required, clause IDs are sequential, and
// the canonical hash is over a normalized text so CRLF/whitespace changes do not
// silently create a new policy version.

import { createHash } from "node:crypto";

export const POLICY_MAX_BYTES = 100_000;
export const MIN_CLAUSE_CHARS = 50;
export const MAX_CLAUSE_CHARS = 2_000;
export const MAX_CLAUSES = 24;

export interface PolicyClause {
  id: string;
  title: string;
  text: string;
  mandatory: boolean;
  startLine: number;
  endLine: number;
}

export interface PolicyDocument {
  version: string;
  provider: string;
  effectiveDate: string;
  url?: string;
  clauseCount?: number;
  clauses: PolicyClause[];
  /** The normalized text the hash is computed over. */
  normalizedText: string;
  /** sha256 over normalizedText. */
  textHash: string;
}

export interface PolicyIssue {
  code: string;
  message: string;
  line?: number;
  clauseId?: string;
}

export interface PolicyParseResult {
  ok: boolean;
  document?: PolicyDocument;
  errors: PolicyIssue[];
  warnings: PolicyIssue[];
}

export interface PolicyDiff {
  from: { version: string; textHash: string };
  to: { version: string; textHash: string };
  added: PolicyClause[];
  removed: PolicyClause[];
  changed: Array<{
    id: string;
    titleChanged: boolean;
    textChanged: boolean;
    mandatoryChanged: boolean;
    before: PolicyClause;
    after: PolicyClause;
  }>;
}

const FRONT_MATTER_RE = /^---\n([\s\S]*?)\n---(?:\n|$)/;
const CLAUSE_HEADER_RE = /^##\s+(C[1-9][0-9]?)\s*(?:—|–|-)\s*(.+?)\s*$/;
const MANDATORY_RE = /<!--\s*mandatory\s*:\s*(true|false)\s*-->/i;
const VERSION_RE = /^[0-9A-Za-z.-]{1,32}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalize policy text before hashing:
 * - remove a UTF-8 BOM
 * - CRLF/CR to LF
 * - strip trailing spaces and tabs on each line
 * - trim leading/trailing blank lines and end with exactly one LF
 */
export function normalizePolicyText(text: string): string {
  const body = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
  return `${body}\n`;
}

export function policyTextHash(text: string): string {
  const digest = createHash("sha256")
    .update(normalizePolicyText(text), "utf8")
    .digest("hex");
  return `sha256:${digest}`;
}

function parseFrontMatter(raw: string): {
  values: Map<string, string>;
  errors: PolicyIssue[];
  warnings: PolicyIssue[];
  body: string;
  bodyStartLine: number;
} {
  const errors: PolicyIssue[] = [];
  const warnings: PolicyIssue[] = [];
  const match = FRONT_MATTER_RE.exec(raw);
  if (!match) {
    return {
      values: new Map(),
      errors: [
        {
          code: "E2024",
          message:
            "Policy front matter is missing. Start the file with --- and Policy-Version, Provider, Effective-Date.",
          line: 1,
        },
      ],
      warnings,
      body: raw,
      bodyStartLine: 1,
    };
  }
  const values = new Map<string, string>();
  const front = match[1] ?? "";
  const lines = front.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? "").trim();
    if (!line || line.startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon <= 0) {
      errors.push({
        code: "E2024",
        message: `Front matter line ${index + 2} must be Key: value.`,
        line: index + 2,
      });
      continue;
    }
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    values.set(key, value);
  }
  const body = raw.slice(match[0].length);
  const bodyStartLine = match[0].split("\n").length;
  const known = new Set([
    "policy-version",
    "provider",
    "effective-date",
    "policy-url",
    "clause-count",
  ]);
  for (const key of values.keys()) {
    if (!known.has(key)) {
      warnings.push({
        code: "E2024",
        message: `Unknown front matter key "${key}" (ignored).`,
      });
    }
  }
  return { values, errors, warnings, body, bodyStartLine };
}

function clauseText(lines: string[]): string {
  return lines
    .join("\n")
    .replace(MANDATORY_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isVague(text: string): string | undefined {
  const lower = text.toLowerCase();
  const direct = [
    "be safe",
    "use good judgment",
    "use reasonable judgment",
    "as appropriate",
    "as needed",
    "exercise caution",
    "be careful",
    "reasonable efforts",
  ].find((phrase) => lower.includes(phrase));
  if (direct) {
    return `Phrase "${direct}" is not independently checkable. Name the required or prohibited behavior.`;
  }
  if (
    /\b(appropriate|reasonable|sufficient|adequate)\b/.test(lower) &&
    !/\b(must|must not|shall|may not|is required|is prohibited)\b/.test(lower)
  ) {
    return "The clause uses a subjective standard without a must/must-not rule.";
  }
  if (
    !/\b(must|must not|shall|may not|is required|is prohibited|must disclose)\b/.test(
      lower,
    )
  ) {
    return "The clause does not name a required or prohibited behavior.";
  }
  return undefined;
}

/** Parse and validate a policy document. Warnings do not make the parse fail. */
export function parsePolicy(text: string): PolicyParseResult {
  const raw = normalizePolicyText(text);
  const errors: PolicyIssue[] = [];
  const warnings: PolicyIssue[] = [];

  if (Buffer.byteLength(raw, "utf8") > POLICY_MAX_BYTES) {
    errors.push({
      code: "E2020",
      message: `Policy is over the ${POLICY_MAX_BYTES}-byte cap.`,
    });
  }

  const front = parseFrontMatter(raw);
  errors.push(...front.errors);
  warnings.push(...front.warnings);

  const version = front.values.get("policy-version") ?? "";
  const provider = front.values.get("provider") ?? "";
  const effectiveDate = front.values.get("effective-date") ?? "";
  const url = front.values.get("policy-url");
  const clauseCountRaw = front.values.get("clause-count");
  const clauseCount =
    clauseCountRaw === undefined ? undefined : Number(clauseCountRaw);

  if (!version) {
    errors.push({
      code: "E2024",
      message: "Policy-Version is required.",
      line: 2,
    });
  } else if (!VERSION_RE.test(version)) {
    errors.push({
      code: "E2023",
      message:
        "Policy-Version must be 1–32 characters: letters, digits, dots, hyphens.",
      line: 2,
    });
  }
  if (!provider) {
    errors.push({ code: "E2024", message: "Provider is required.", line: 3 });
  }
  if (!effectiveDate) {
    errors.push({
      code: "E2024",
      message: "Effective-Date is required.",
      line: 4,
    });
  } else if (!DATE_RE.test(effectiveDate)) {
    errors.push({
      code: "E2024",
      message: "Effective-Date must be YYYY-MM-DD.",
      line: 4,
    });
  }
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") {
        errors.push({
          code: "E2014",
          message: "Policy-URL must use https.",
        });
      }
      if (url.length > 300) {
        errors.push({
          code: "E2013",
          message: "Policy-URL must be 300 characters or fewer.",
        });
      }
    } catch {
      errors.push({ code: "E2014", message: "Policy-URL is not a valid URL." });
    }
  }
  if (clauseCountRaw !== undefined && !Number.isInteger(clauseCount)) {
    errors.push({
      code: "E2020",
      message: "Clause-Count must be an integer.",
    });
  }

  const clauses: PolicyClause[] = [];
  const bodyLines = front.body.split("\n");
  let current:
    | {
        id: string;
        title: string;
        lines: string[];
        startLine: number;
      }
    | undefined;

  const close = (endLine: number) => {
    if (!current) return;
    const text = clauseText(current.lines);
    const mandatoryMatch = current.lines.join("\n").match(MANDATORY_RE);
    const mandatory = (mandatoryMatch?.[1] ?? "false").toLowerCase() === "true";
    if (!text) {
      errors.push({
        code: "E2022",
        message: `${current.id} has no clause text.`,
        line: current.startLine,
        clauseId: current.id,
      });
    } else {
      const length = [...text].length;
      if (length < MIN_CLAUSE_CHARS || length > MAX_CLAUSE_CHARS) {
        errors.push({
          code: "E2022",
          message: `${current.id} must be ${MIN_CLAUSE_CHARS}–${MAX_CLAUSE_CHARS} characters (got ${length}).`,
          line: current.startLine,
          clauseId: current.id,
        });
      }
      const vague = isVague(text);
      if (vague) {
        warnings.push({
          code: "E2025",
          message: `${current.id}: ${vague}`,
          line: current.startLine,
          clauseId: current.id,
        });
      }
    }
    clauses.push({
      id: current.id,
      title: current.title,
      text,
      mandatory,
      startLine: current.startLine,
      endLine,
    });
    current = undefined;
  };

  for (let index = 0; index < bodyLines.length; index += 1) {
    const line = bodyLines[index] ?? "";
    const absoluteLine = front.bodyStartLine + index;
    const header = CLAUSE_HEADER_RE.exec(line);
    if (header) {
      close(absoluteLine - 1);
      current = {
        id: header[1] as string,
        title: (header[2] as string).trim(),
        lines: [],
        startLine: absoluteLine,
      };
      continue;
    }
    if (/^##\s+C[0-9]/.test(line)) {
      errors.push({
        code: "E2020",
        message: "Clause header must look like: ## C1 — Short title",
        line: absoluteLine,
      });
      continue;
    }
    if (current) current.lines.push(line);
  }
  close(front.bodyStartLine + bodyLines.length - 1);

  if (clauses.length === 0) {
    errors.push({
      code: "E2020",
      message: "A policy needs at least one clause.",
    });
  }
  if (clauses.length > MAX_CLAUSES) {
    errors.push({
      code: "E2023",
      message: `A policy can have at most ${MAX_CLAUSES} clauses.`,
    });
  }
  for (let index = 0; index < clauses.length; index += 1) {
    const clause = clauses[index];
    if (!clause) continue;
    const expected = `C${index + 1}`;
    if (clause.id !== expected) {
      errors.push({
        code: "E2020",
        message: `Clause ids must be sequential: expected ${expected}, got ${clause.id}.`,
        line: clause.startLine,
        clauseId: clause.id,
      });
    }
    if (!clause.title) {
      errors.push({
        code: "E2020",
        message: `${clause.id} needs a short title.`,
        line: clause.startLine,
        clauseId: clause.id,
      });
    }
  }
  const seen = new Set<string>();
  for (const clause of clauses) {
    if (seen.has(clause.id)) {
      errors.push({
        code: "E2021",
        message: `Duplicate clause id ${clause.id}.`,
        line: clause.startLine,
        clauseId: clause.id,
      });
    }
    seen.add(clause.id);
  }
  if (clauseCount !== undefined && clauseCount !== clauses.length) {
    errors.push({
      code: "E2020",
      message: `Clause-Count is ${clauseCount}, but ${clauses.length} clauses were parsed.`,
    });
  }

  const document: PolicyDocument = {
    version,
    provider,
    effectiveDate,
    ...(url ? { url } : {}),
    ...(clauseCount !== undefined ? { clauseCount } : {}),
    clauses,
    normalizedText: raw,
    textHash: policyTextHash(raw),
  };
  return {
    ok: errors.length === 0,
    ...(errors.length === 0 ? { document } : {}),
    errors,
    warnings,
  };
}

/** Clause-level diff. Both documents must already be parsed and valid. */
export function diffPolicies(
  before: PolicyDocument,
  after: PolicyDocument,
): PolicyDiff {
  const beforeById = new Map(
    before.clauses.map((clause) => [clause.id, clause]),
  );
  const afterById = new Map(after.clauses.map((clause) => [clause.id, clause]));
  const ids = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort(
    (a, b) => Number(a.slice(1)) - Number(b.slice(1)),
  );
  const added: PolicyClause[] = [];
  const removed: PolicyClause[] = [];
  const changed: PolicyDiff["changed"] = [];
  for (const id of ids) {
    const left = beforeById.get(id);
    const right = afterById.get(id);
    if (!left && right) added.push(right);
    else if (left && !right) removed.push(left);
    else if (left && right) {
      const titleChanged = left.title !== right.title;
      const textChanged = left.text !== right.text;
      const mandatoryChanged = left.mandatory !== right.mandatory;
      if (titleChanged || textChanged || mandatoryChanged) {
        changed.push({
          id,
          titleChanged,
          textChanged,
          mandatoryChanged,
          before: left,
          after: right,
        });
      }
    }
  }
  return {
    from: { version: before.version, textHash: before.textHash },
    to: { version: after.version, textHash: after.textHash },
    added,
    removed,
    changed,
  };
}

export function renderPolicyJson(document: PolicyDocument): string {
  return JSON.stringify(
    {
      version: document.version,
      provider: document.provider,
      effectiveDate: document.effectiveDate,
      ...(document.url ? { url: document.url } : {}),
      ...(document.clauseCount !== undefined
        ? { clauseCount: document.clauseCount }
        : {}),
      textHash: document.textHash,
      clauses: document.clauses.map((clause) => ({
        id: clause.id,
        title: clause.title,
        text: clause.text,
        mandatory: clause.mandatory,
      })),
    },
    null,
    2,
  );
}
