import { describe, expect, it } from "vitest";
import { contractBody } from "../admin/organisers";
import { contrast, fundState, isHex } from "../vendor/organiser";

describe("organiser console and desk (M22)", () => {
  it("checks WCAG contrast like the server (FR-11)", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrast("#0b7a4b", "#ffffff")).toBeGreaterThan(4.5);
    expect(contrast("#c8f53c", "#ffffff")).toBeLessThan(4.5);
    expect(isHex("#0B7A4B")).toBe(true);
    expect(isHex("0b7a4b")).toBe(false);
  });

  it("says what a draft's prize fund still needs (FR-05)", () => {
    expect(fundState({ required: 200000, deposited: 200000 })).toBe("funded");
    expect(fundState({ required: 200000, deposited: 0 })).toBe("needs");
    expect(fundState({ required: 150000, deposited: 200000 })).toBe("over");
  });

  it("turns the contract form into the API body (FR-02)", () => {
    const base = { pct: "", flatFee: "", billingCycle: "monthly" as const, startsOn: "2026-10-18", endsOn: "" };
    expect(contractBody({ ...base, model: "percentage" })).toEqual({ model: "percentage", pct: null, billingCycle: "per_tournament", startsOn: "2026-10-18", endsOn: null });
    expect(contractBody({ ...base, model: "percentage", pct: "7.5", endsOn: "2027-10-17" })).toMatchObject({ pct: 7.5, endsOn: "2027-10-17" });
    expect(contractBody({ ...base, model: "percentage", pct: "120" })).toBeNull();
    expect(contractBody({ ...base, model: "flat", flatFee: "5000" })).toEqual({ model: "flat", flatFee: 500000, billingCycle: "monthly", startsOn: "2026-10-18", endsOn: null });
    expect(contractBody({ ...base, model: "flat", flatFee: "0" })).toBeNull();
    expect(contractBody({ ...base, model: "flat", flatFee: "5000", billingCycle: "per_tournament" })).toBeNull();
  });
});
