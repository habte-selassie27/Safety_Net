// Browser-safe validation shared by the CLI, the web app, and (mirrored by)
// the contract. No node built-ins: this module runs in the browser.
//
// Keep these rules identical to `contracts/safetynet.py` §11.7 and the
// evidence schema §12.2. A drift test compares accept/reject sets.

export const SYSTEM_ID_RE = /^[a-z0-9-]{3,48}$/;
export const POLICY_VERSION_RE = /^[0-9A-Za-z.-]{1,32}$/;
export const SHA256_RE = /^sha256:[0-9a-f]{64}$/;
export const CLAUSE_ID_RE = /^C[1-9][0-9]?$/;

export const MAX_CLAIM = 2000;
export const MIN_CLAIM = 20;
export const MAX_DEFENSE = 4000;
export const MIN_DEFENSE = 20;
export const MAX_INLINE_TEXT = 2000;
export const MAX_NOTE = 300;
export const MAX_URL = 300;
export const MAX_EVIDENCE_ITEMS = 8;
export const MAX_EVIDENCE_BYTES = 20_000;
export const MIN_MAX_CHARS = 200;
export const MAX_MAX_CHARS = 8000;

export interface ValidationIssue {
  code: string;
  message: string;
  path?: string;
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; issues: ValidationIssue[] };

export interface EvidenceItem {
  id: string;
  kind: "url" | "inline";
  url?: string;
  text?: string;
  retrievedAt?: string;
  contentSha256: string;
  maxChars: number;
  note?: string;
}

export interface EvidenceManifest {
  schemaVersion: 1;
  items: EvidenceItem[];
}

const ALLOWED_ITEM_KEYS = new Set([
  "id",
  "kind",
  "url",
  "text",
  "retrievedAt",
  "contentSha256",
  "maxChars",
  "note",
]);

function issue(code: string, message: string, path?: string): ValidationIssue {
  return path ? { code, message, path } : { code, message };
}

function fail(issues: ValidationIssue[]): ValidationResult {
  return { ok: false, issues };
}

export function validateSystemId(value: string): ValidationResult {
  if (!SYSTEM_ID_RE.test(value)) {
    return fail([
      issue(
        "E2002",
        "Use lowercase letters, digits, and hyphens (3–48 characters).",
        "system_id",
      ),
    ]);
  }
  return { ok: true };
}

export function validatePolicyVersion(value: string): ValidationResult {
  if (!POLICY_VERSION_RE.test(value)) {
    return fail([
      issue("E2003", "Use a version like 1.2.0.", "policy_version"),
    ]);
  }
  return { ok: true };
}

export function validateClaim(value: string): ValidationResult {
  const length = [...value].length;
  if (length < MIN_CLAIM || length > MAX_CLAIM) {
    return fail([
      issue(
        "E2004",
        `Claim must be ${MIN_CLAIM}–${MAX_CLAIM} characters.`,
        "claim",
      ),
    ]);
  }
  return { ok: true };
}

export function validateDefense(value: string): ValidationResult {
  const length = [...value].length;
  if (length < MIN_DEFENSE || length > MAX_DEFENSE) {
    return fail([
      issue(
        "E2005",
        `Defense must be ${MIN_DEFENSE}–${MAX_DEFENSE} characters.`,
        "defense",
      ),
    ]);
  }
  return { ok: true };
}

/** Heuristic PII check for the filing form. A hit requires confirmation, not rejection. */
export function detectPii(text: string): { kind: string; value: string }[] {
  const hits: { kind: string; value: string }[] = [];
  const patterns: [string, RegExp][] = [
    ["email", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi],
    ["phone", /\+?\d[\d ()-]{7,}\d/g],
    ["handle", /@[A-Za-z0-9_]{3,}/g],
  ];
  for (const [kind, pattern] of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[0];
      if (value && !hits.some((hit) => hit.value === value))
        hits.push({ kind, value });
    }
  }
  return hits;
}

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/** True when the host is an IP literal (v4, decimal, hex) or localhost name. */
export function isIpLiteralHost(host: string): boolean {
  const lower = host.toLowerCase();
  if (IPV4_RE.test(lower) || lower.startsWith("[") || lower === "localhost")
    return true;
  if (/^\d+$/.test(lower)) return true;
  if (/^0x[0-9a-f]+$/.test(lower)) return true;
  return false;
}

export function hostAllowed(
  host: string,
  allowlist: readonly string[],
): boolean {
  const lower = host.toLowerCase();
  return allowlist.some((entry) => {
    const rule = entry.toLowerCase().trim();
    if (!rule) return false;
    if (rule.startsWith("*.")) {
      const suffix = rule.slice(1); // ".example.com"
      return lower.endsWith(suffix) && lower.length > suffix.length;
    }
    return lower === rule;
  });
}

export function parseHttpsUrl(
  raw: string,
  allowlist: readonly string[],
): { ok: true; url: URL } | { ok: false; issues: ValidationIssue[] } {
  if (raw.length > MAX_URL) {
    return {
      ok: false,
      issues: [issue("E2013", `URL must be ≤ ${MAX_URL} characters.`, "url")],
    };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, issues: [issue("E2013", "Enter a valid URL.", "url")] };
  }
  if (url.protocol !== "https:") {
    return {
      ok: false,
      issues: [issue("E2014", "Evidence URLs must use https.", "url")],
    };
  }
  if (url.username || url.password) {
    return {
      ok: false,
      issues: [issue("E2015", "Remove credentials from the URL.", "url")],
    };
  }
  if (url.port && url.port !== "443") {
    return {
      ok: false,
      issues: [issue("E2013", "Only port 443 is allowed.", "url")],
    };
  }
  if (isIpLiteralHost(url.hostname)) {
    return {
      ok: false,
      issues: [
        issue(
          "E2013",
          "IP addresses are not allowed as evidence hosts.",
          "url",
        ),
      ],
    };
  }
  if (!hostAllowed(url.hostname, allowlist)) {
    return {
      ok: false,
      issues: [
        issue(
          "E2013",
          `Host "${url.hostname}" is not in the evidence allowlist (${allowlist.join(", ")}).`,
          "url",
        ),
      ],
    };
  }
  return { ok: true, url };
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function validateEvidenceManifest(
  manifest: unknown,
  options: {
    allowlist: readonly string[];
    maxItems?: number;
    maxBytes?: number;
  } = {
    allowlist: [],
  },
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const maxItems = options.maxItems ?? MAX_EVIDENCE_ITEMS;
  const maxBytes = options.maxBytes ?? MAX_EVIDENCE_BYTES;

  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return fail([
      issue("E2010", "Evidence manifest must be an object.", "manifest"),
    ]);
  }
  const record = manifest as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== 2 || keys[0] !== "items" || keys[1] !== "schemaVersion") {
    issues.push(
      issue(
        "E2012",
        "Manifest keys must be exactly schemaVersion and items.",
        "manifest",
      ),
    );
  }
  if (record.schemaVersion !== 1) {
    issues.push(
      issue("E2012", "schemaVersion must be 1.", "manifest.schemaVersion"),
    );
  }
  const items = record.items;
  if (!Array.isArray(items) || items.length === 0) {
    issues.push(
      issue("E2010", "Add at least one evidence item.", "manifest.items"),
    );
    return fail(issues);
  }
  if (items.length > maxItems) {
    issues.push(
      issue(
        "E2011",
        `At most ${maxItems} evidence items are allowed.`,
        "manifest.items",
      ),
    );
  }
  const ids = new Set<string>();
  items.forEach((raw, index) => {
    const path = `manifest.items[${index}]`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      issues.push(issue("E2012", "Evidence item must be an object.", path));
      return;
    }
    const item = raw as Record<string, unknown>;
    for (const key of Object.keys(item)) {
      if (!ALLOWED_ITEM_KEYS.has(key)) {
        issues.push(
          issue("E2012", `Unknown evidence key "${key}".`, `${path}.${key}`),
        );
      }
    }
    const id = String(item.id ?? "");
    if (!/^e[1-9][0-9]?$/.test(id)) {
      issues.push(
        issue("E2012", "Evidence id must look like e1, e2, …", `${path}.id`),
      );
    } else if (ids.has(id)) {
      issues.push(
        issue("E2012", `Duplicate evidence id "${id}".`, `${path}.id`),
      );
    } else {
      ids.add(id);
    }
    const kind = item.kind;
    if (kind !== "url" && kind !== "inline") {
      issues.push(
        issue("E2012", 'kind must be "url" or "inline".', `${path}.kind`),
      );
      return;
    }
    const maxChars = Number(item.maxChars);
    if (
      !Number.isInteger(maxChars) ||
      maxChars < MIN_MAX_CHARS ||
      maxChars > MAX_MAX_CHARS
    ) {
      issues.push(
        issue(
          "E2012",
          `maxChars must be ${MIN_MAX_CHARS}–${MAX_MAX_CHARS}.`,
          `${path}.maxChars`,
        ),
      );
    }
    const hash = String(item.contentSha256 ?? "");
    if (!SHA256_RE.test(hash)) {
      issues.push(
        issue(
          "E2006",
          "contentSha256 must be sha256:<64 hex>.",
          `${path}.contentSha256`,
        ),
      );
    }
    if (item.note !== undefined && [...String(item.note)].length > MAX_NOTE) {
      issues.push(
        issue(
          "E2012",
          `note must be ≤ ${MAX_NOTE} characters.`,
          `${path}.note`,
        ),
      );
    }
    if (kind === "url") {
      const url = String(item.url ?? "");
      const parsed = parseHttpsUrl(url, options.allowlist);
      if (!parsed.ok) {
        for (const problem of parsed.issues) {
          issues.push({ ...problem, path: `${path}.url` });
        }
      }
      if (item.text !== undefined) {
        issues.push(
          issue("E2012", "A url item must not include text.", `${path}.text`),
        );
      }
    }
    if (kind === "inline") {
      const text = String(item.text ?? "");
      if (!text) {
        issues.push(
          issue("E2012", "Inline evidence needs text.", `${path}.text`),
        );
      } else if ([...text].length > MAX_INLINE_TEXT) {
        issues.push(
          issue(
            "E2012",
            `Inline text must be ≤ ${MAX_INLINE_TEXT} characters.`,
            `${path}.text`,
          ),
        );
      }
      if (item.url !== undefined) {
        issues.push(
          issue(
            "E2012",
            "An inline item must not include a url.",
            `${path}.url`,
          ),
        );
      }
    }
  });

  const bytes = byteLength(canonicalManifest(record));
  if (bytes > maxBytes) {
    issues.push(
      issue(
        "E2010",
        `Manifest is ${bytes} bytes; the cap is ${maxBytes}.`,
        "manifest",
      ),
    );
  }
  return issues.length ? fail(issues) : { ok: true };
}

/** Recursively sort object keys, matching the Python canonicalizer. */
export function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Canonical JSON: sorted keys, compact separators, UTF-8. */
export function canonicalManifest(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error(
      "E4001: Web Crypto (crypto.subtle) is unavailable in this environment.",
    );
  }
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return `sha256:${[...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** sha256 of arbitrary bytes (used to hash fetched URL content). */
export async function sha256BytesHex(bytes: Uint8Array): Promise<string> {
  return sha256Bytes(bytes);
}

/** sha256 of raw text/bytes as the reporter saw them. */
export async function sha256Text(text: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(text));
}

/** Normalize policy text exactly as contracts/safetynet.py::_normalize_policy_text does. */
export function normalizePolicyText(text: string): string {
  let out = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (out.startsWith("\ufeff")) out = out.slice(1);
  const lines = out.split("\n").map((line) => line.replace(/[ \t]+$/, ""));
  while (lines.length && !(lines[0] ?? "").trim()) lines.shift();
  while (lines.length && !(lines[lines.length - 1] ?? "").trim()) lines.pop();
  return `${lines.join("\n")}\n`;
}

/** sha256 over normalized policy text, matching the contract's policy_text_hash. */
export async function policyTextHash(text: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(normalizePolicyText(text)));
}

/** Browser+Node sha256 over the canonical manifest. */
export async function evidenceHash(manifest: unknown): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(canonicalManifest(manifest)));
}
