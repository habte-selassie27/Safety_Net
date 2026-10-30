import { describe, expect, it } from "vitest";

import {
  canonicalManifest,
  detectPii,
  evidenceHash,
  hostAllowed,
  isIpLiteralHost,
  parseHttpsUrl,
  sha256Text,
  validateClaim,
  validateDefense,
  validateEvidenceManifest,
  validatePolicyVersion,
  validateSystemId,
} from "./validate";

const ALLOWLIST = ["example.com", "*.githubusercontent.com"];

function issueCodes(
  result: ReturnType<typeof validateEvidenceManifest>,
): string[] {
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe("canonical hashing", () => {
  it("sorts object keys recursively but preserves array order", () => {
    expect(canonicalManifest({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(
      '{"a":[{"c":3,"d":2}],"b":1}',
    );
    expect(canonicalManifest(["b", "a"])).toBe('["b","a"]');
  });

  it("matches the Python canonical JSON hash for a mixed manifest", async () => {
    const manifest = {
      items: [
        {
          id: "e1",
          kind: "inline",
          text: 'héllo "quote"\nsecond line',
          contentSha256: `sha256:${"0".repeat(64)}`,
          maxChars: 2000,
        },
        {
          id: "e2",
          kind: "url",
          url: "https://example.com/a",
          retrievedAt: "2026-10-28T00:00:00Z",
          contentSha256: `sha256:${"1".repeat(64)}`,
          maxChars: 4000,
        },
      ],
      schemaVersion: 1,
    };
    expect(await evidenceHash(manifest)).toBe(
      "sha256:fc1de8274577123e15d7356bd2771b4b5e1a7d2e71361b017f55d717abc27216",
    );
  });

  it("hashes text with sha256", async () => {
    expect(await sha256Text("hello")).toBe(
      "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});

describe("claim and identity validation", () => {
  it("enforces claim length boundaries", () => {
    expect(validateClaim("x".repeat(19)).ok).toBe(false);
    expect(validateClaim("x".repeat(20)).ok).toBe(true);
    expect(validateClaim("x".repeat(2001)).ok).toBe(false);
  });

  it("enforces defense length boundaries", () => {
    expect(validateDefense("x".repeat(19)).ok).toBe(false);
    expect(validateDefense("x".repeat(20)).ok).toBe(true);
    expect(validateDefense("x".repeat(4001)).ok).toBe(false);
  });

  it("accepts lowercase slugs and rejects unsafe ids", () => {
    expect(validateSystemId("synthetic-chatbot-1").ok).toBe(true);
    expect(validateSystemId("Synthetic Chatbot").ok).toBe(false);
    expect(validateSystemId("ab").ok).toBe(false);
    expect(validatePolicyVersion("1.2.0").ok).toBe(true);
    expect(validatePolicyVersion("v 1").ok).toBe(false);
  });

  it("finds emails, phone numbers, and handles without duplicates", () => {
    const hits = detectPii(
      "Contact alice@example.com or +1 (555) 123-4567 or @alice — also alice@example.com.",
    );
    expect(hits.filter((hit) => hit.kind === "email")).toHaveLength(1);
    expect(hits.some((hit) => hit.kind === "phone")).toBe(true);
    expect(hits.some((hit) => hit.kind === "handle")).toBe(true);
  });
});

describe("evidence host rules", () => {
  it("matches exact hosts and wildcard subdomains only", () => {
    expect(hostAllowed("example.com", ALLOWLIST)).toBe(true);
    expect(hostAllowed("raw.githubusercontent.com", ALLOWLIST)).toBe(true);
    expect(hostAllowed("githubusercontent.com", ALLOWLIST)).toBe(false);
    expect(hostAllowed("example.com.evil.test", ALLOWLIST)).toBe(false);
  });

  it("rejects IP literals and localhost names", () => {
    for (const host of [
      "127.0.0.1",
      "10.0.0.1",
      "169.254.169.254",
      "2130706433",
      "0x7f000001",
      "localhost",
      "[::1]",
    ]) {
      expect(isIpLiteralHost(host), host).toBe(true);
    }
    expect(isIpLiteralHost("example.com")).toBe(false);
  });

  it("rejects http, credentials, non-443 ports, and hosts off the allowlist", () => {
    expect(parseHttpsUrl("http://example.com/a", ALLOWLIST).ok).toBe(false);
    expect(parseHttpsUrl("https://user:pass@example.com/a", ALLOWLIST).ok).toBe(
      false,
    );
    expect(parseHttpsUrl("https://example.com:8443/a", ALLOWLIST).ok).toBe(
      false,
    );
    expect(parseHttpsUrl("https://127.0.0.1/a", ALLOWLIST).ok).toBe(false);
    expect(parseHttpsUrl("https://evil.test/a", ALLOWLIST).ok).toBe(false);
    expect(parseHttpsUrl("https://example.com/a", ALLOWLIST).ok).toBe(true);
  });

  it("accepts a valid manifest and rejects hostile variants", () => {
    const valid = {
      schemaVersion: 1,
      items: [
        {
          id: "e1",
          kind: "inline",
          text: "The model said: take 4000mg.",
          contentSha256: `sha256:${"a".repeat(64)}`,
          maxChars: 2000,
        },
        {
          id: "e2",
          kind: "url",
          url: "https://example.com/transcript",
          retrievedAt: "2026-10-28T00:00:00Z",
          contentSha256: `sha256:${"b".repeat(64)}`,
          maxChars: 4000,
        },
      ],
    };
    expect(validateEvidenceManifest(valid, { allowlist: ALLOWLIST }).ok).toBe(
      true,
    );

    const http = {
      schemaVersion: 1,
      items: [
        {
          id: "e1",
          kind: "url",
          url: "http://example.com/a",
          contentSha256: `sha256:${"a".repeat(64)}`,
          maxChars: 4000,
        },
      ],
    };
    expect(
      issueCodes(validateEvidenceManifest(http, { allowlist: ALLOWLIST })),
    ).toContain("E2014");

    const unknownKey = {
      schemaVersion: 1,
      items: [
        {
          id: "e1",
          kind: "inline",
          text: "hello",
          contentSha256: `sha256:${"a".repeat(64)}`,
          maxChars: 2000,
          extra: true,
        },
      ],
    };
    expect(
      issueCodes(
        validateEvidenceManifest(unknownKey, { allowlist: ALLOWLIST }),
      ),
    ).toContain("E2012");

    const tooMany = {
      schemaVersion: 1,
      items: Array.from({ length: 9 }, (_, index) => ({
        id: `e${index + 1}`,
        kind: "inline",
        text: "hello",
        contentSha256: `sha256:${"a".repeat(64)}`,
        maxChars: 2000,
      })),
    };
    expect(
      issueCodes(validateEvidenceManifest(tooMany, { allowlist: ALLOWLIST })),
    ).toContain("E2011");
  });
});
