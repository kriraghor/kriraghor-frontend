import { describe, expect, it } from "vitest";
import { heldOf } from "../admin/gym";

// The owner's gym desk helpers moved to gym.kriraghor.com with the desks (apps/gym/src/lib/__tests__/manage.test.ts).
describe("admin gym desk (M20)", () => {
  it("shows staff what a platform cancel would refund", () => {
    expect(heldOf({ money: { price: 300000, fee: 15000, net: 285000, released: 0, refunded: 0 } })).toBe(300000);
    expect(heldOf({ money: { price: 300000, fee: 15000, net: 285000, released: 300000, refunded: 0 } })).toBe(0); // released is gross (the fee leaves the hold too)
  });
});
