import { describe, expect, it } from "vitest";
import { PAYMENTS_HREF, webPayBack } from "../pay-links";

describe("kriraghor.com result page next steps (M06 §4)", () => {
  it("sends esports entries back to my matches on the esports site", () => {
    expect(webPayBack("esports_entry", "t1", "https://esports.kriraghor.com/")).toEqual({ href: "https://esports.kriraghor.com/me/matches", labelKey: "backToEsports", testId: "back-to-esports", tone: "amber" });
  });
  it("sends a ground booking to the booking and a shop order to my orders", () => {
    expect(webPayBack("ground_booking", "b1", "x")).toEqual({ href: "/me/bookings/b1", labelKey: "backToBooking", testId: "back-to-booking" });
    expect(webPayBack("market_order", "o1", "x")).toEqual({ href: "/me/orders", labelKey: "backToOrders", testId: "back-to-order" });
  });
  it("has no next step for other purposes, and My payments stays on this site", () => {
    for (const p of ["hire_contract", "gym_package", "test_charge", ""]) expect(webPayBack(p, "x", "x"), p).toBeNull();
    expect(PAYMENTS_HREF).toBe("/me/payments");
  });
});
