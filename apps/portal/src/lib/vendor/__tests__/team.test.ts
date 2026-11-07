import { describe, expect, it } from "vitest";
import {
  addableBusinesses,
  allowedBookingActions,
  allowedOrderActions,
  defaultPermissions,
  deskAccessKey,
  deskCan,
  deskChoices,
  lockedPermissions,
  membersPerBusiness,
  samePermissions,
  staffErrorKey,
  staffPermissionsAt,
  teamPhone,
  togglePermission,
  withRequirements,
  workplaceDesks,
  worksWith,
  type CatalogueEntry,
  type TeamBusiness,
} from "../team";
import { GYM_PRESET_KEYS, isGymCatalogue, matchingPreset, presetPermissions } from "../team";

// The catalogue GET /me/team answers (business-members.rules PERMISSIONS and REQUIRES).
const VENUE: CatalogueEntry[] = [
  { key: "bookings.view", default: true, needs: null },
  { key: "bookings.check_in", default: true, needs: "bookings.view" },
  { key: "bookings.no_show", default: true, needs: "bookings.view" },
  { key: "bookings.extend", default: true, needs: "bookings.view" },
  { key: "bookings.collect_balance", default: true, needs: "bookings.view" },
  { key: "bookings.walk_in", default: true, needs: "bookings.view" },
  { key: "bookings.move", default: false, needs: "bookings.view" },
  { key: "bookings.cancel", default: false, needs: "bookings.view" },
  { key: "reviews.reply", default: false, needs: null },
];
const SHOP: CatalogueEntry[] = [
  { key: "orders.view", default: true, needs: null },
  { key: "orders.accept", default: true, needs: "orders.view" },
  { key: "orders.ship", default: true, needs: "orders.view" },
  { key: "orders.deliver", default: true, needs: "orders.view" },
  { key: "stock.view", default: true, needs: null },
  { key: "stock.adjust", default: true, needs: "stock.view" },
  { key: "orders.reject", default: false, needs: "orders.view" },
];

describe("permission checkboxes", () => {
  it("defaults are the on-by-default keys, optional ones off", () => {
    expect(defaultPermissions(VENUE)).toEqual(["bookings.check_in", "bookings.collect_balance", "bookings.extend", "bookings.no_show", "bookings.view", "bookings.walk_in"]);
    expect(defaultPermissions(SHOP)).not.toContain("orders.reject");
    expect(defaultPermissions([])).toEqual([]);
  });

  it("ticking an action also ticks what it needs (bookings.view)", () => {
    expect(togglePermission(VENUE, [], "bookings.check_in", true)).toEqual(["bookings.check_in", "bookings.view"]);
    expect(togglePermission(SHOP, ["stock.view"], "orders.reject", true)).toEqual(["orders.reject", "orders.view", "stock.view"]);
    // Ticking something already on changes nothing.
    expect(togglePermission(VENUE, ["bookings.view"], "bookings.view", true)).toEqual(["bookings.view"]);
  });

  it("unticking a requirement takes off everything that needs it", () => {
    expect(togglePermission(VENUE, defaultPermissions(VENUE), "bookings.view", false)).toEqual([]);
    expect(togglePermission(SHOP, defaultPermissions(SHOP), "stock.view", false)).toEqual(["orders.accept", "orders.deliver", "orders.ship", "orders.view"]);
    expect(togglePermission(VENUE, ["bookings.view", "reviews.reply"], "reviews.reply", false)).toEqual(["bookings.view"]);
  });

  it("a requirement is locked while a ticked permission needs it", () => {
    expect([...lockedPermissions(VENUE, ["bookings.view", "bookings.check_in"])]).toEqual(["bookings.view"]);
    expect(lockedPermissions(VENUE, ["bookings.view"]).size).toBe(0);
    expect(lockedPermissions(VENUE, ["reviews.reply"]).size).toBe(0);
    expect([...lockedPermissions(SHOP, defaultPermissions(SHOP))].sort()).toEqual(["orders.view", "stock.view"]);
  });

  it("withRequirements drops unknown and never-grantable keys and adds what is needed", () => {
    expect(withRequirements(VENUE, ["bookings.move", "pricing", "listing", "bookings.move"])).toEqual(["bookings.move", "bookings.view"]);
    // A chain of needs is followed to the end.
    const chain: CatalogueEntry[] = [
      { key: "a", default: false, needs: null },
      { key: "b", default: false, needs: "a" },
      { key: "c", default: false, needs: "b" },
    ];
    expect(withRequirements(chain, ["c"])).toEqual(["a", "b", "c"]);
    expect(togglePermission(chain, ["a", "b", "c"], "a", false)).toEqual([]);
  });

  it("samePermissions ignores order and repeats", () => {
    expect(samePermissions(["b", "a"], ["a", "b"])).toBe(true);
    expect(samePermissions(["a", "a"], ["a"])).toBe(true);
    expect(samePermissions(["a"], ["a", "b"])).toBe(false);
    expect(samePermissions(["a", "c"], ["a", "b"])).toBe(false);
  });
});

describe("the add form", () => {
  it("accepts Bangladesh mobile numbers in the usual forms", () => {
    for (const input of ["01712345678", "+8801712345678", "8801712345678", " 017-1234 5678 ", "+880 1712 345678"]) expect(teamPhone(input)).toBe("+8801712345678");
    for (const bad of ["", "0171234567", "01212345678", "abc", "+441712345678"]) expect(teamPhone(bad)).toBeNull();
  });

  it("counts active members per business and keeps full or removed businesses out of the picker", () => {
    const counts = membersPerBusiness([
      { businessType: "venue", businessId: "g1", status: "active" },
      { businessType: "venue", businessId: "g1", status: "active" },
      { businessType: "venue", businessId: "g1", status: "removed" },
      { businessType: "shop", businessId: "s1", status: "active" },
    ]);
    expect(counts.get("venue:g1")).toBe(2);
    expect(counts.get("shop:s1")).toBe(1);
    const businesses: TeamBusiness[] = [
      { businessType: "venue", id: "g1", name: "Turf", status: "live" },
      { businessType: "shop", id: "s1", name: "Shop", status: "live" },
      { businessType: "gym", id: "y1", name: "Gym", status: "removed" },
    ];
    expect(addableBusinesses(businesses, counts, 2).map((b) => b.id)).toEqual(["s1"]);
    expect(addableBusinesses(businesses, counts, 10).map((b) => b.id)).toEqual(["g1", "s1"]);
  });
});

describe("error mapping", () => {
  it("names every B3 code and falls back to failed", () => {
    for (const code of ["MEMBER_NOT_FOUND", "MEMBER_IS_OWNER", "MEMBER_IS_STAFF", "PHONE_NOT_VERIFIED", "TEAM_FULL", "ALREADY_MEMBER", "PERMISSIONS_INVALID", "PERMISSION_REQUIRED", "BUSINESS_REQUIRED", "PHONE_REQUIRED", "RATE_LIMITED"]) {
      expect(staffErrorKey(code)).toBe(code);
    }
    expect(staffErrorKey("SOMETHING_ELSE")).toBe("failed");
    expect(staffErrorKey(undefined)).toBe("failed");
    expect(staffErrorKey(null)).toBe("failed");
  });

  it("desks explain access answers themselves and leave the rest to the desk", () => {
    expect(deskAccessKey("PERMISSION_REQUIRED")).toBe("PERMISSION_REQUIRED");
    expect(deskAccessKey("PHONE_REQUIRED")).toBe("PHONE_REQUIRED");
    expect(deskAccessKey("BUSINESS_REQUIRED")).toBe("BUSINESS_REQUIRED");
    expect(deskAccessKey("NOT_OWNER")).toBeNull();
    expect(deskAccessKey(undefined)).toBeNull();
  });
});

describe("workplaces", () => {
  const refs = [
    { businessType: "venue" as const, businessId: "g1", permissions: ["bookings.view", "bookings.check_in"] },
    { businessType: "shop" as const, businessId: "s1", permissions: ["orders.view"] },
  ];

  it("staffPermissionsAt is null where the person is not staff (the owner)", () => {
    expect(staffPermissionsAt(refs, "venue", "g1")).toEqual(["bookings.view", "bookings.check_in"]);
    expect(staffPermissionsAt(refs, "venue", "g2")).toBeNull();
    expect(staffPermissionsAt(refs, "shop", "g1")).toBeNull();
    expect(staffPermissionsAt(undefined, "venue", "g1")).toBeNull();
    expect(staffPermissionsAt(refs, "venue", null)).toBeNull();
  });

  it("deskCan lets owners do everything and staff only what they hold", () => {
    expect(deskCan(null, "bookings.cancel")).toBe(true);
    expect(deskCan(["bookings.view"], "bookings.cancel")).toBe(false);
    expect(deskCan(["bookings.view"], "bookings.view")).toBe(true);
    expect(worksWith(refs, "venue", "bookings.check_in")).toBe(true);
    expect(worksWith(refs, "venue", "bookings.cancel")).toBe(false);
    expect(worksWith(refs, "gym")).toBe(false);
    expect(worksWith(refs, "shop")).toBe(true);
    expect(worksWith(undefined, "shop")).toBe(false);
  });

  it("the desk switcher lists owned businesses first, then workplaces with the permission, once each", () => {
    const named = [
      { businessType: "shop" as const, businessId: "s1", business: { businessType: "shop" as const, id: "s1", name: "Gear Hub", status: "live" }, owner: { id: "o1", displayName: "Rahim" }, permissions: ["orders.view"] },
      { businessType: "shop" as const, businessId: "s2", business: { businessType: "shop" as const, id: "s2", name: "Supps", status: "live" }, owner: { id: "o2", displayName: null }, permissions: ["stock.view"] },
      { businessType: "venue" as const, businessId: "g1", business: { businessType: "venue" as const, id: "g1", name: "Turf", status: "live" }, owner: { id: "o3", displayName: "Karim" }, permissions: ["orders.view"] },
      { businessType: "shop" as const, businessId: "mine", business: { businessType: "shop" as const, id: "mine", name: null, status: "live" }, owner: { id: "o4", displayName: "X" }, permissions: ["orders.view"] },
    ];
    expect(deskChoices("shop", "orders.view", [{ id: "mine", name: "My shop" }], named)).toEqual([
      { value: "mine", label: "My shop", staff: false, owner: null },
      { value: "s1", label: "Gear Hub", staff: true, owner: "Rahim" },
    ]);
    expect(deskChoices("shop", "stock.view", [], named)).toEqual([{ value: "s2", label: "Supps", staff: true, owner: null }]);
    expect(deskChoices("gym", "desk.admit", [], named)).toEqual([]);
    expect(deskChoices("venue", "bookings.view", [{ id: "g9", name: "Own turf" }], undefined)).toEqual([{ value: "g9", label: "Own turf", staff: false, owner: null }]);
  });

  it("each workplace opens the desks its permissions allow", () => {
    expect(workplaceDesks({ businessType: "venue", businessId: "g1", permissions: ["bookings.view", "reviews.reply"] })).toEqual([
      { key: "bookings", href: "/vendor/bookings?groundId=g1" },
      { key: "reviews", href: "/vendor/reviews?type=ground&place=g1" },
    ]);
    expect(workplaceDesks({ businessType: "venue", businessId: "g1", permissions: [] })).toEqual([]);
    expect(workplaceDesks({ businessType: "gym", businessId: "y1", permissions: ["desk.admissions"] })).toEqual([{ key: "frontDesk", href: "/go/gym/manage/y1/desk" }]);
    expect(workplaceDesks({ businessType: "gym", businessId: "y1", permissions: ["passes.view"] })).toEqual([{ key: "passes", href: "/go/gym/manage/y1/passes" }]);
    // M24: attendance.mark opens the front desk for member check-ins.
    expect(workplaceDesks({ businessType: "gym", businessId: "y1", permissions: ["attendance.mark", "fees.collect"] })).toEqual([{ key: "frontDesk", href: "/go/gym/manage/y1/desk" }]);
    expect(workplaceDesks({ businessType: "shop", businessId: "s1", permissions: ["orders.view", "stock.view"] })).toEqual([
      { key: "orders", href: "/vendor/orders?shopId=s1" },
      { key: "inventory", href: "/vendor/inventory?shopId=s1" },
    ]);
  });

  it("booking and order buttons follow the permissions; owners keep every one", () => {
    const all = ["check_in", "no_show", "extend", "collect", "cancel", "move"] as const;
    expect(allowedBookingActions(all, null)).toEqual([...all]);
    expect(allowedBookingActions(all, defaultPermissions(VENUE))).toEqual(["check_in", "no_show", "extend", "collect"]);
    expect(allowedBookingActions(["cancel", "move"], ["bookings.view", "bookings.move"])).toEqual(["move"]);
    expect(allowedOrderActions("placed", null)).toEqual(["accept", "reject"]);
    expect(allowedOrderActions("placed", defaultPermissions(SHOP))).toEqual(["accept"]);
    expect(allowedOrderActions("placed", ["orders.view", "orders.reject"])).toEqual(["reject"]);
    expect(allowedOrderActions("accepted", ["orders.view"])).toEqual([]);
    expect(allowedOrderActions("accepted", ["orders.view", "orders.ship"])).toEqual(["ship"]);
    expect(allowedOrderActions("shipped", ["orders.view", "orders.deliver"])).toEqual(["deliver"]);
    expect(allowedOrderActions("completed", null)).toEqual([]);
  });
});

describe("gym role presets (M27 §3)", () => {
  const gym = [
    { key: "desk.admit", default: true, needs: null },
    { key: "desk.admissions", default: true, needs: null },
    { key: "attendance.mark", default: true, needs: null },
    { key: "members.view", default: true, needs: null },
    { key: "members.edit", default: false, needs: "members.view" },
    { key: "fees.collect", default: false, needs: "members.view" },
    { key: "reports.view", default: false, needs: null },
    { key: "members.trainer", default: false, needs: null },
    { key: "plans.manage", default: false, needs: null },
    { key: "expenses.manage", default: false, needs: null },
    { key: "cash.drawer", default: false, needs: null },
    { key: "pos.sell", default: false, needs: null },
    { key: "stock.manage", default: false, needs: null },
    { key: "lockers.manage", default: false, needs: null },
  ];
  it("fills the boxes for a job, keeps only offered keys, and finds the preset back", () => {
    expect(isGymCatalogue(gym)).toBe(true);
    expect(isGymCatalogue([{ key: "bookings.view", default: true, needs: null }])).toBe(false);
    expect(presetPermissions(gym, "cashier").sort()).toEqual(["cash.drawer", "fees.collect", "members.view", "pos.sell"]);
    expect(presetPermissions(gym, "manager")).toHaveLength(gym.length);
    expect(presetPermissions(gym.filter((p) => p.key !== "pos.sell"), "storekeeper")).toEqual(["stock.manage"]);
    expect(matchingPreset(gym, presetPermissions(gym, "accountant"))).toBe("accountant");
    expect(matchingPreset(gym, ["members.view"])).toBeNull();
    expect(GYM_PRESET_KEYS).toEqual(["receptionist", "cashier", "trainer", "manager", "accountant", "storekeeper"]);
  });
});
