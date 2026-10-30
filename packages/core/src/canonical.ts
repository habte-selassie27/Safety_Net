import { createHash } from "node:crypto";

/**
 * Deterministic JSON with recursively sorted object keys and compact
 * separators. Array order is preserved. This matches the Python
 * `json.dumps(obj, sort_keys=True, separators=(",", ":"))` used by the
 * contract and the CLI.
 */
export function canonicalJson(obj: unknown): string {
  return JSON.stringify(sortKeys(obj));
}

export function evidenceHash(manifest: unknown): string {
  return `sha256:${createHash("sha256")
    .update(canonicalJson(manifest), "utf8")
    .digest("hex")}`;
}

export function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort())
      out[k] = sortKeys((v as Record<string, unknown>)[k]);
    return out;
  }
  return v;
}
