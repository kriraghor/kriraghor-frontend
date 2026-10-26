import { describe, expect, it } from "vitest";
import { gymPayBack, PAYMENTS_HREF } from "../pay-links";

describe("gym result page next steps (M24 prompt 2, M06 §4)", () => {
  it("sends a pass to my passes and a trainer plan to my subscriptions", () => {
    expect(gymPayBack("gym_package", "p1")).toEqual({ href: "/me/passes", labelKey: "backToPasses", testId: "back-to-passes" });
    expect(gymPayBack("trainer_subscription", "s1")).toEqual({ href: "/me/subscriptions", labelKey: "backToSubscriptions", testId: "back-to-subscriptions" });
  });
  it("sends a membership fee to my dues and an owner's invoice to that invoice", () => {
    expect(gymPayBack("gym_membership_fee", "c1")).toEqual({ href: "/me/dues", labelKey: "backToDues", testId: "back-to-dues" });
    expect(gymPayBack("gym_saas_invoice", "0b9e2c1a-7f00-4a1e-9c51-2f7f0f2b6a10")).toEqual({ href: "/manage/billing/invoices/0b9e2c1a-7f00-4a1e-9c51-2f7f0f2b6a10", labelKey: "backToInvoice", testId: "back-to-invoice" });
    expect(gymPayBack("gym_saas_invoice", "a/b")?.href).toBe("/manage/billing/invoices/a%2Fb");
  });
  it("has no next step for kriraghor.com purposes, and My payments goes to kriraghor.com", () => {
    for (const p of ["esports_entry", "ground_booking", "market_order", ""]) expect(gymPayBack(p, "x"), p).toBeNull();
    expect(PAYMENTS_HREF).toBe("/go/web/me/payments");
  });
});
