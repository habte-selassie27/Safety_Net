// @safetynet/patterns — equivalence pattern metadata (TS side).

export interface PatternMeta {
  id: string;
  name: string;
  principle: "strict" | "comparative" | "non-comparative" | "custom";
  tags: string[];
  summary: string;
}

export const PATTERNS: Record<string, PatternMeta> = {
  P1: {
    id: "P1",
    name: "Enum Verdict",
    principle: "strict",
    tags: ["classification", "enum", "strict-equality"],
    summary: "Classify into a closed set; compare only the enum value.",
  },
  P7: {
    id: "P7",
    name: "Deterministic Aggregation",
    principle: "strict",
    tags: ["aggregation", "determinism", "safetynet-core"],
    summary:
      "Pure function turns noisy clause findings into one stable verdict.",
  },
  P8: {
    id: "P8",
    name: "Pinned Evidence Window",
    principle: "strict",
    tags: ["pinning", "evidence", "ssrf", "safetynet-core"],
    summary: "Pin evidence by hash so validators judge identical bytes.",
  },
};

export function get(id: string): PatternMeta {
  const p = PATTERNS[id];
  if (!p) throw new Error(`unknown pattern: ${id}`);
  return p;
}
