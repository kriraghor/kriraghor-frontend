import { describe, expect, it } from "vitest";
import { clampBundles, smsBalanceTone, smsCardState, smsKindsAfter } from "../gym-sms";

describe("the SMS add-on card (M24-FR-96)", () => {
  it("coming soon, off or on", () => {
    expect(smsCardState({ available: false, status: null })).toBe("soon");
    expect(smsCardState({ available: true, status: null })).toBe("off");
    expect(smsCardState({ available: true, status: "ended" })).toBe("off");
    expect(smsCardState({ available: true, status: "active" })).toBe("on");
    // Switched off on the platform after the owner had it on: still shows the balance.
    expect(smsCardState({ available: false, status: "active" })).toBe("on");
  });
  it("bundles between 1 and 20", () => {
    expect(clampBundles(0)).toBe(1);
    expect(clampBundles(3.4)).toBe(3);
    expect(clampBundles(50)).toBe(20);
    expect(clampBundles(Number.NaN)).toBe(1);
  });
  it("the balance tone", () => {
    expect(smsBalanceTone({ balance: 1, lowBalance: 50, reserveUnits: 2 })).toBe("empty");
    expect(smsBalanceTone({ balance: 20, lowBalance: 50, reserveUnits: 2 })).toBe("low");
    expect(smsBalanceTone({ balance: 50, lowBalance: 50, reserveUnits: 2 })).toBe("ok");
  });
});

describe("the kinds that go by SMS (M24-FR-97)", () => {
  const order = ["renewal_due", "ends_today", "overdue", "receipt", "pay_link"] as const;
  it("on and off, in the page's order", () => {
    expect(smsKindsAfter(["receipt"], order, "renewal_due", true)).toEqual(["renewal_due", "receipt"]);
    expect(smsKindsAfter(["renewal_due", "receipt"], order, "receipt", false)).toEqual(["renewal_due"]);
    expect(smsKindsAfter([], order, "receipt", false)).toEqual([]);
  });
});
