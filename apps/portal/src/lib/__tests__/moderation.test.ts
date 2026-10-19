import { describe, expect, it } from "vitest";
import { decisionProblem, hardFailures, HEARTBEAT_MS, QUEUE_STATUSES, secondsLeft } from "../admin/moderation";

describe("Moderation desk helpers (M05 lite)", () => {
  const none = { missing: [], failing: [], reason: null, reasonText: "", override: "" };

  it("approves only with every rubric tick, and over a failing hard check only with an override reason", () => {
    expect(decisionProblem("approve", none)).toBeNull();
    expect(decisionProblem("approve", { ...none, missing: ["readable"] })).toBe("rubric");
    expect(decisionProblem("approve", { ...none, failing: ["nid_unique"] })).toBe("checks");
    expect(decisionProblem("approve", { ...none, failing: ["nid_unique"], override: "ok" })).toBe("checks");
    expect(decisionProblem("approve", { ...none, failing: ["nid_unique"], override: "Holder confirmed" })).toBeNull();
  });

  it("asks for a reason, and a note when the reason needs one", () => {
    expect(decisionProblem("reject", none)).toBe("reason");
    expect(decisionProblem("request_changes", { ...none, reason: { requiresText: false } })).toBeNull();
    expect(decisionProblem("reject", { ...none, reason: { requiresText: true } })).toBe("reasonText");
    expect(decisionProblem("reject", { ...none, reason: { requiresText: true }, reasonText: "Not an NID" })).toBeNull();
    // A failing check never blocks changes or a rejection.
    expect(decisionProblem("reject", { ...none, failing: ["nid_unique"], reason: { requiresText: false } })).toBeNull();
  });

  it("finds failing hard checks only; counts lock seconds down to zero", () => {
    const checks = [
      { key: "nid_unique", severity: "hard", result: "fail", detail: null },
      { key: "file_reused", severity: "soft", result: "warn", detail: null },
      { key: "age_ok", severity: "hard", result: "pass", detail: null },
    ] as const;
    expect(hardFailures([...checks])).toEqual(["nid_unique"]);
    expect(secondsLeft("2026-10-16T10:00:30.000Z", Date.parse("2026-10-16T10:00:00.000Z"))).toBe(30);
    expect(secondsLeft("2026-10-16T10:00:00.000Z", Date.parse("2026-10-16T10:05:00.000Z"))).toBe(0);
    expect(QUEUE_STATUSES[0]).toBe("pending_review");
    expect(HEARTBEAT_MS).toBe(60_000);
  });
});
