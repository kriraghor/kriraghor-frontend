import { describe, expect, it } from "vitest";
import { decisionProblem, REASONS, RUBRIC } from "../admin/kyc";

describe("KYC desk helpers (M02 lite)", () => {
  const full = { nameMatches: true, readable: true, notExpired: true };

  it("approves only with every rubric tick and no failed blocking check", () => {
    expect(decisionProblem("approve", { rubric: full, reason: "", blockingFailed: false })).toBeNull();
    expect(decisionProblem("approve", { rubric: { ...full, readable: false }, reason: "", blockingFailed: false })).toBe("rubric");
    expect(decisionProblem("approve", { rubric: full, reason: "", blockingFailed: true })).toBe("checks");
  });

  it("asks for a reason to request changes or reject", () => {
    expect(decisionProblem("reject", { rubric: full, reason: "", blockingFailed: false })).toBe("reason");
    expect(decisionProblem("changes_requested", { rubric: full, reason: "blurry", blockingFailed: true })).toBeNull();
    expect(REASONS).toContain("duplicate_nid");
    expect(RUBRIC).toHaveLength(3);
  });
});
