import { describe, expect, it } from "vitest";
import { heldOf, removalSummary } from "../admin/gym";

// The owner's gym desk helpers moved to gym.kriraghor.com with the desks (apps/gym/src/lib/__tests__/manage.test.ts).
describe("admin gym desk (M20)", () => {
  it("shows staff what a platform cancel would refund", () => {
    expect(heldOf({ money: { price: 300000, fee: 15000, net: 285000, released: 0, refunded: 0 } })).toBe(300000);
    expect(heldOf({ money: { price: 300000, fee: 15000, net: 285000, released: 300000, refunded: 0 } })).toBe(0); // released is gross (the fee leaves the hold too)
  });

  it("sums what a master's remove refunded and what support settles with the owner (M20-FR-15)", () => {
    expect(removalSummary({ refunded: [], paidToGym: [] })).toEqual({ refundedCount: 0, refundedTotal: 0, paidToGymTotal: 0 });
    expect(
      removalSummary({
        refunded: [
          { code: "GP-26-000001", refunded: 300000 },
          { code: "GP-26-000002", refunded: 150000 },
        ],
        paidToGym: [{ code: "GP-26-000003", paidToGym: 285000, heldBefore: 300000 }],
      }),
    ).toEqual({ refundedCount: 2, refundedTotal: 450000, paidToGymTotal: 285000 });
  });
});
