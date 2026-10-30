import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractSafetyNetSchema } from "./check";

const source = readFileSync(
  join(process.cwd(), "contracts", "safetynet.py"),
  "utf8",
);

describe("extractSafetyNetSchema", () => {
  it("reports only class-level public methods", () => {
    const schema = extractSafetyNetSchema(source);
    const names = [...schema.methods.views, ...schema.methods.writes].map(
      (method) => method.name,
    );
    expect(names).not.toContain("evaluate");
    expect(names).not.toContain("_require");
    expect(schema.methods.summary).toEqual({
      total: 19,
      views: 11,
      writes: 8,
    });
  });

  it("strips self and annotations from arguments", () => {
    const schema = extractSafetyNetSchema(source);
    const fileIncident = schema.methods.writes.find(
      (method) => method.name === "file_incident",
    );
    expect(fileIncident?.args).toEqual([
      "system_id",
      "policy_version",
      "claim",
      "evidence_hash",
      "evidence_manifest",
    ]);
    expect(fileIncident?.returns).toBe("str");
  });

  it("matches the core enums and reason codes", () => {
    const schema = extractSafetyNetSchema(source);
    expect(schema.parity).toMatchObject({
      verdicts: true,
      severities: true,
      confidences: true,
      incidentStatuses: true,
      reasonCodes: true,
    });
    expect(schema.reasonCodes.unknown).toEqual([]);
    expect(schema.reasonCodes.contract).toContain("DUPLICATE_INCIDENT");
    expect(schema.reasonCodes.contract).toContain("POLICY_DRIFT");
    expect(schema.reasonCodes.contract).toContain("APPEAL_WINDOW_CLOSED");
    expect(schema.reasonCodes.contract).toContain("APPEAL_WINDOW_OPEN");
    expect(schema.reasonCodes.unused).toEqual(["EVIDENCE_TOO_LARGE"]);
  });

  it("skips nested helpers by indentation", () => {
    const nested = [
      "class X:",
      "    @gl.public.write",
      "    def outer(self, a: str) -> str:",
      "        def evaluate():",
      "            return a",
      "        return evaluate()",
      "",
    ].join("\n");
    const schema = extractSafetyNetSchema(nested);
    expect(schema.methods.summary.total).toBe(1);
    expect(schema.methods.writes[0]?.name).toBe("outer");
  });

  it("parses multi-line signatures", () => {
    const multiline = [
      "class X:",
      "    @gl.public.view",
      "    def get_thing(",
      "        self,",
      "        thing_id: str,",
      "        limit: int,",
      "    ) -> str:",
      "        return thing_id",
      "",
    ].join("\n");
    const schema = extractSafetyNetSchema(multiline);
    expect(schema.methods.views[0]).toMatchObject({
      name: "get_thing",
      type: "view",
      args: ["thing_id", "limit"],
      returns: "str",
    });
  });
});
