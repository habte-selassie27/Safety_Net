import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  diffPolicies,
  normalizePolicyText,
  parsePolicy,
  policyTextHash,
  renderPolicyJson,
} from "./policy";

const FIXTURES = join(process.cwd(), "test", "fixtures", "policies");

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

function codes(result: ReturnType<typeof parsePolicy>): string[] {
  return result.errors.map((issue) => issue.code);
}

describe("policy parsing", () => {
  it("parses front matter and sequential clauses", () => {
    const result = parsePolicy(fixture("acme-v1.2.0.md"));
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.document?.version).toBe("1.2.0");
    expect(result.document?.provider).toBe("Acme AI");
    expect(result.document?.clauses.map((clause) => clause.id)).toEqual([
      "C1",
      "C2",
      "C3",
      "C4",
    ]);
    expect(result.document?.clauses[0]?.mandatory).toBe(true);
    expect(result.document?.clauses[3]?.mandatory).toBe(false);
    expect(result.document?.textHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("normalizes BOM, CRLF, trailing spaces, and EOF before hashing", () => {
    const base = fixture("acme-v1.2.0.md");
    const noisy = `\uFEFF${base.replace(/\n/g, "   \r\n")}\r\n\r\n`;
    expect(normalizePolicyText(noisy)).toBe(normalizePolicyText(base));
    expect(policyTextHash(noisy)).toBe(policyTextHash(base));
  });

  it("rejects non-sequential clause ids", () => {
    const result = parsePolicy(fixture("non-sequential.md"));
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("E2020");
    expect(result.errors.some((issue) => issue.message.includes("C2"))).toBe(
      true,
    );
  });

  it("warns about vague clauses without failing the parse", () => {
    const result = parsePolicy(fixture("vague-clauses.md"));
    expect(result.ok).toBe(true);
    expect(result.warnings.map((issue) => issue.code)).toEqual([
      "E2025",
      "E2025",
    ]);
    expect(result.warnings[0]?.clauseId).toBe("C1");
  });

  it("requires front matter", () => {
    const result = parsePolicy(
      "## C1 — No front matter\nThis clause is long enough to pass the minimum clause length check.",
    );
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("E2024");
  });

  it("rejects short clauses and clause-count mismatches", () => {
    const short = `---
Policy-Version: 1.0.0
Provider: Tiny AI
Effective-Date: 2026-01-01
Clause-Count: 2
---

## C1 — Too short
Be safe.
`;
    const result = parsePolicy(short);
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("E2022");
    expect(codes(result)).toContain("E2020");
  });

  it("renders a stable export", () => {
    const result = parsePolicy(fixture("acme-v1.2.0.md"));
    expect(result.document).toBeDefined();
    const json = JSON.parse(renderPolicyJson(result.document as never));
    expect(json.version).toBe("1.2.0");
    expect(json.clauses).toHaveLength(4);
    expect(json.clauses[0]).toMatchObject({
      id: "C1",
      mandatory: true,
    });
  });
});

describe("policy diff", () => {
  it("reports changes by clause id", () => {
    const before = parsePolicy(fixture("acme-v1.2.0.md"));
    const after = parsePolicy(fixture("acme-v2.0.0.md"));
    expect(before.document).toBeDefined();
    expect(after.document).toBeDefined();
    const diff = diffPolicies(
      before.document as never,
      after.document as never,
    );
    expect(diff.from.version).toBe("1.2.0");
    expect(diff.to.version).toBe("2.0.0");
    // Renumbering means each C1..C4 slot changed; IDs are the stable key.
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed.map((change) => change.id)).toEqual([
      "C1",
      "C2",
      "C3",
      "C4",
    ]);
    expect(diff.changed[0]?.textChanged).toBe(true);
  });

  it("reports added and removed trailing clauses", () => {
    const make = (version: string, clauses: string) => {
      const text = `---
Policy-Version: ${version}
Provider: Diff AI
Effective-Date: 2026-01-01
---

## C1 — Dosage limits
The system must not provide specific prescription dosages or individualized
medical treatment instructions.

${clauses}`;
      const result = parsePolicy(text);
      expect(result.ok).toBe(true);
      return result.document as never;
    };
    const c2 = `## C2 — Disclosure of limits
The system must disclose uncertainty rather than asserting confidence it cannot
support from the available evidence.
`;
    const c3 = `## C3 — Code safety
The system must not emit code that concatenates untrusted input directly into a
SQL statement, shell command, or HTML sink.
`;
    const withThree = make("1.0.0", `${c2}\n${c3}`);
    const withTwo = make("1.1.0", c2);
    const withFour = make(
      "1.2.0",
      `${c2}\n${c3}\n## C4 — Appeal path
The provider must offer a human review path for any user-visible automated
decision that materially affects access to a service.
`,
    );

    expect(diffPolicies(withThree, withTwo).removed.map((c) => c.id)).toEqual([
      "C3",
    ]);
    expect(diffPolicies(withThree, withFour).added.map((c) => c.id)).toEqual([
      "C4",
    ]);
  });
});
