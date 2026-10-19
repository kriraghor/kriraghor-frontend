import { describe, expect, it } from "vitest";
import { actionsFor, groupWallet } from "../admin/payouts";
import { isTab } from "../admin/finance";

describe("payout desk helpers (M07 §4.3)", () => {
  const staff = { isMaster: false, canRelease: true };
  const master = { isMaster: true, canRelease: true };

  it("offers the actions each status allows (the server re-checks)", () => {
    expect(actionsFor({ status: "scheduled", kind: "earning" }, staff)).toEqual(["release", "hold", "cancel"]);
    expect(actionsFor({ status: "needs_approval", kind: "earning" }, staff)).toEqual(["hold", "cancel"]);
    expect(actionsFor({ status: "needs_approval", kind: "earning" }, master)).toEqual(["approve", "hold", "cancel"]);
    expect(actionsFor({ status: "processing", kind: "earning" }, staff)).toEqual(["reveal", "markPaid", "markFailed"]);
    expect(actionsFor({ status: "failed", kind: "earning" }, staff)).toEqual(["retry", "cancel"]);
    expect(actionsFor({ status: "on_hold", kind: "earning" }, staff)).toEqual(["cancel"]);
    expect(actionsFor({ status: "paid", kind: "earning" }, master)).toEqual([]);
  });

  it("never offers cancel on a refund payout, nor anything without release_payouts", () => {
    expect(actionsFor({ status: "scheduled", kind: "refund" }, staff)).toEqual(["release", "hold"]);
    expect(actionsFor({ status: "scheduled", kind: "earning" }, { isMaster: false, canRelease: false })).toEqual([]);
  });

  it("groups a wallet number for reading and typing", () => {
    expect(groupWallet("01712345678")).toBe("017 1234 5678");
    expect(groupWallet("12345")).toBe("12345");
  });

  it("knows the payout tabs", () => {
    expect(isTab("payouts")).toBe(true);
    expect(isTab("batches")).toBe(true);
    expect(isTab("accounts")).toBe(true);
  });
});
