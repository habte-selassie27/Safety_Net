import { describe, expect, it } from "vitest";

import {
  aggregate,
  downgradeConfidence,
  severityFloorFor,
  type ClauseVerdict,
} from "./aggregate";

function finding(
  clause_id: string,
  value: ClauseVerdict["finding"],
  reason_code: ClauseVerdict["reason_code"] = "EXPLICIT",
): ClauseVerdict {
  return { clause_id, finding: value, reason_code };
}

describe("aggregate", () => {
  it("treats any violated clause as a policy violation", () => {
    const result = aggregate({
      clauseVerdicts: [
        finding("C1", "VIOLATED"),
        finding("C2", "COMPLIANT", "NOT_COVERED"),
      ],
      hasDefense: true,
      severityFloor: "MODERATE",
    });
    expect(result.verdict).toBe("POLICY_VIOLATION");
    expect(result.severity).toBe("MODERATE");
    expect(result.clauses).toEqual(["C1"]);
  });

  it("raises severity when no defense was filed", () => {
    const result = aggregate({
      clauseVerdicts: [finding("C1", "VIOLATED")],
      hasDefense: false,
    });
    expect(result.severity).toBe("SERIOUS");
    expect(result.confidence).toBe("MEDIUM");
  });

  it("keeps the deterministic severity floor for protected attributes", () => {
    const result = aggregate({
      clauseVerdicts: [finding("C3", "VIOLATED")],
      hasDefense: true,
      severityFloor: severityFloorFor({ flags: ["protected_attribute"], hasDefense: true }),
    });
    expect(result.severity).toBe("CRITICAL");
  });

  it("caps cited clauses at three", () => {
    const result = aggregate({
      clauseVerdicts: [
        finding("C1", "VIOLATED"),
        finding("C2", "VIOLATED"),
        finding("C3", "VIOLATED"),
        finding("C4", "VIOLATED"),
      ],
      hasDefense: true,
    });
    expect(result.clauses).toHaveLength(3);
  });

  it("calls harm without violation a policy gap", () => {
    const result = aggregate({
      clauseVerdicts: [
        finding("C1", "COMPLIANT"),
        finding("C2", "COMPLIANT", "NOT_COVERED"),
      ],
      hasDefense: true,
      harmAlleged: true,
    });
    expect(result.verdict).toBe("POLICY_ADEQUATE_BUT_HARM");
    expect(result.severity).toBe("MODERATE");
    expect(result.clauses).toEqual(["C2"]);
    expect(result.primaryReasonCode).toBe("NOT_COVERED");
  });

  it("dismisses compliance with no alleged harm", () => {
    const result = aggregate({
      clauseVerdicts: [finding("C1", "COMPLIANT")],
      hasDefense: true,
      harmAlleged: false,
    });
    expect(result.verdict).toBe("DISMISSED");
    expect(result.severity).toBe("LOW");
  });

  it("fails softly to insufficient evidence and drops confidence", () => {
    const result = aggregate({
      clauseVerdicts: [
        finding("C1", "INSUFFICIENT", "AMBIGUOUS"),
        finding("C2", "COMPLIANT"),
      ],
      hasDefense: true,
    });
    expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.confidence).toBe("LOW");
    expect(result.clauses).toEqual(["C1"]);
  });

  it("never reports HIGH confidence when a clause is insufficient", () => {
    const result = aggregate({
      clauseVerdicts: [finding("C1", "INSUFFICIENT", "AMBIGUOUS")],
      hasDefense: true,
    });
    expect(result.confidence).toBe("LOW");
  });
});

describe("downgradeConfidence", () => {
  it("steps down one band and stops at LOW", () => {
    expect(downgradeConfidence("HIGH")).toBe("MEDIUM");
    expect(downgradeConfidence("MEDIUM")).toBe("LOW");
    expect(downgradeConfidence("LOW")).toBe("LOW");
  });
});

describe("severityFloorFor", () => {
  it("orders flags by legal-risk weight", () => {
    expect(severityFloorFor({ flags: ["protected_attribute"], hasDefense: true })).toBe(
      "CRITICAL",
    );
    expect(severityFloorFor({ flags: ["medical"], hasDefense: true })).toBe(
      "SERIOUS",
    );
    expect(severityFloorFor({ flags: [], hasDefense: false })).toBe("SERIOUS");
    expect(severityFloorFor({ flags: [], hasDefense: true })).toBe("LOW");
  });
});
