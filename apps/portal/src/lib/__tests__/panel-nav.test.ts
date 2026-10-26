import { describe, expect, it } from "vitest";
import { ADMIN_SECTIONS, GYMS_HREF, VENDOR_SECTIONS, adminSections, businessView, staffSections, vendorSections } from "../panel-nav";

const hrefs = (sections: { items: { href: string }[] }[]) => sections.flatMap((s) => s.items.map((i) => i.href));

describe("adminSections, the admin sidebar", () => {
  it("a master sees every desk", () => {
    expect(hrefs(adminSections({ isMaster: true, permissions: [] }))).toEqual(hrefs(ADMIN_SECTIONS));
  });

  it("staff see the desks their permissions open, and no master-only desk", () => {
    const got = hrefs(adminSections({ isMaster: false, permissions: ["enter_results"] }));
    expect(got).toContain("/admin");
    expect(got).toContain("/admin/esports");
    expect(got).toContain("/admin/sports-events"); // any staff member
    expect(got).not.toContain("/admin/esports/showcases"); // manage_esports only
    expect(got).not.toContain("/admin/finance");
    expect(got).not.toContain("/admin/audit");
  });

  it("drops a section with nothing left in it, and shows nothing before /admin/me loads", () => {
    const keys = adminSections({ isMaster: false, permissions: ["view_payouts"] }).map((s) => s.key);
    expect(keys).toContain("money");
    expect(keys).not.toContain("system");
    expect(adminSections(undefined)).toEqual([]);
  });

  it("the gym system desk (M24 §4.4) opens with manage_gyms or view_payouts", () => {
    expect(hrefs(adminSections({ isMaster: false, permissions: ["manage_gyms"] }))).toContain("/admin/gym-manage");
    expect(hrefs(adminSections({ isMaster: false, permissions: ["view_payouts"] }))).toContain("/admin/gym-manage");
    expect(hrefs(adminSections({ isMaster: false, permissions: ["manage_users"] }))).not.toContain("/admin/gym-manage");
  });
});

describe("vendorSections, the business sidebar", () => {
  it("someone with no business role sees only the overview", () => {
    expect(vendorSections([], "all").map((s) => s.key)).toEqual(["overview"]);
  });

  it("shows each business held, plus the shared business tools", () => {
    expect(vendorSections(["ground_owner", "shop_owner"], "all").map((s) => s.key)).toEqual(["overview", "grounds", "shop", "business"]);
  });

  it("the switcher narrows to one business; a role not held falls back to all", () => {
    expect(vendorSections(["ground_owner", "shop_owner"], "shop_owner").map((s) => s.key)).toEqual(["overview", "shop", "business"]);
    expect(vendorSections(["ground_owner"], "gym_owner").map((s) => s.key)).toEqual(["overview", "grounds", "business"]);
  });

  it("settlement belongs to shops; venues keep venues and bookings", () => {
    const shop = hrefs(vendorSections(["shop_owner"], "all"));
    expect(shop).toContain("/vendor/settlement");
    expect(shop).toContain("/vendor/disputes");
    const venue = hrefs(vendorSections(["ground_owner"], "all"));
    expect(venue).toEqual(expect.arrayContaining(["/vendor/venues", "/vendor/bookings", "/vendor/analytics", "/vendor/reviews"]));
    expect(venue).not.toContain("/vendor/settlement");
  });

  it("analytics shows once for every business, organisers included (Round B2)", () => {
    for (const role of ["ground_owner", "shop_owner", "gym_owner", "organiser"] as const) {
      expect(hrefs(vendorSections([role], "all")).filter((h) => h === "/vendor/analytics")).toHaveLength(1);
    }
    expect(hrefs(vendorSections(["ground_owner", "shop_owner", "gym_owner", "organiser"], "all")).filter((h) => h === "/vendor/analytics")).toHaveLength(1);
    // It sits with the shared business tools, so narrowing to one business keeps it.
    expect(hrefs(vendorSections(["ground_owner", "organiser"], "organiser"))).toContain("/vendor/analytics");
    expect(vendorSections(["gym_owner"], "all").find((s) => s.items.some((i) => i.href === "/vendor/analytics"))?.key).toBe("business");
    // Someone with no business yet has no analytics.
    expect(hrefs(vendorSections([], "all"))).not.toContain("/vendor/analytics");
  });

  it("reviews show once for venue, shop and gym owners, not for organisers (Round B1)", () => {
    for (const role of ["ground_owner", "shop_owner", "gym_owner"] as const) expect(hrefs(vendorSections([role], "all")).filter((h) => h === "/vendor/reviews")).toHaveLength(1);
    expect(hrefs(vendorSections(["ground_owner", "shop_owner", "gym_owner"], "all")).filter((h) => h === "/vendor/reviews")).toHaveLength(1);
    expect(hrefs(vendorSections(["organiser"], "all"))).not.toContain("/vendor/reviews");
    // The switcher on the organiser business hides it; on the shop it shows.
    expect(hrefs(vendorSections(["organiser", "shop_owner"], "organiser"))).not.toContain("/vendor/reviews");
    expect(hrefs(vendorSections(["organiser", "shop_owner"], "shop_owner"))).toContain("/vendor/reviews");
  });

  it("organisers get sports events only: no esports console (21 Oct 2026)", () => {
    const got = hrefs(vendorSections(["organiser"], "all"));
    expect(got).toContain("/vendor/events");
    expect(got.some((h) => h.startsWith("/vendor/esports"))).toBe(false);
    expect(hrefs(VENDOR_SECTIONS).some((h) => h.startsWith("/vendor/esports"))).toBe(false);
  });
});

describe("businessView, what the vendor home and sidebar follow", () => {
  const roles = [
    { role: "member", status: "active" },
    { role: "shop_owner", status: "active" },
    { role: "ground_owner", status: "active" },
    { role: "gym_owner", status: "in_review" },
  ];

  it("lists the active businesses in sidebar order", () => {
    expect(businessView({ roles, lastPanelRole: null })).toEqual({ active: ["ground_owner", "shop_owner"], view: "all", shown: ["ground_owner", "shop_owner"] });
  });

  it("follows lastPanelRole when it is an active business", () => {
    expect(businessView({ roles, lastPanelRole: "shop_owner" })).toMatchObject({ view: "shop_owner", shown: ["shop_owner"] });
  });

  it("'member', a pending role or nothing saved means all", () => {
    expect(businessView({ roles, lastPanelRole: "member" }).view).toBe("all");
    expect(businessView({ roles, lastPanelRole: "gym_owner" }).view).toBe("all");
    expect(businessView(undefined)).toEqual({ active: [], view: "all", shown: [] });
  });
});

describe("Round B3: the team page and staff desks", () => {
  type W = { businessType: "venue" | "gym" | "shop"; businessId: string; permissions: string[] };
  const venueDefaults: W = { businessType: "venue", businessId: "g1", permissions: ["bookings.check_in", "bookings.collect_balance", "bookings.extend", "bookings.no_show", "bookings.view", "bookings.walk_in"] };
  const OWNER_ONLY = ["/vendor/venues", "/vendor/shop", "/vendor/products", "/vendor/settlement", "/vendor/analytics", "/vendor/payouts", "/vendor/team", "/vendor/disputes", "/vendor/events"];

  it("Team shows once for venue, shop and gym owners, not for organisers", () => {
    for (const role of ["ground_owner", "shop_owner", "gym_owner"] as const) expect(hrefs(vendorSections([role], "all")).filter((h) => h === "/vendor/team")).toHaveLength(1);
    expect(hrefs(vendorSections(["ground_owner", "shop_owner", "gym_owner"], "all")).filter((h) => h === "/vendor/team")).toHaveLength(1);
    expect(hrefs(vendorSections(["organiser"], "all"))).not.toContain("/vendor/team");
    expect(vendorSections(["gym_owner"], "all").find((s) => s.items.some((i) => i.href === "/vendor/team"))?.key).toBe("business");
  });

  it("owners without workplaces see exactly what they saw before", () => {
    for (const roles of [["ground_owner"], ["shop_owner", "gym_owner"], ["organiser"], []] as const) {
      expect(vendorSections([...roles], "all", [])).toEqual(vendorSections([...roles], "all"));
    }
  });

  it("venue staff with the defaults get the bookings desk only, never an owner-only page", () => {
    const got = hrefs(vendorSections([], "all", [venueDefaults]));
    expect(got).toEqual(["/vendor", "/vendor/bookings"]);
    for (const h of OWNER_ONLY) expect(got).not.toContain(h);
    expect(got).not.toContain("/vendor/reviews");
  });

  it("reviews show to venue staff only with reviews.reply", () => {
    const got = hrefs(vendorSections([], "all", [{ ...venueDefaults, permissions: [...venueDefaults.permissions, "reviews.reply"] }]));
    expect(got).toContain("/vendor/reviews");
  });

  it("gym staff get one Gyms link to gym.kriraghor.com/manage by any gym desk permission (M24 §4.3)", () => {
    for (const permissions of [["desk.admissions", "desk.admit"], ["desk.admit"], ["desk.admissions"], ["passes.view"], ["attendance.mark"], ["members.view"], ["members.trainer"], ["members.view", "fees.collect"]]) {
      expect(hrefs(vendorSections([], "all", [{ businessType: "gym", businessId: "y1", permissions }]))).toEqual(["/vendor", "/go/gym/manage"]);
    }
    const two = vendorSections([], "all", [
      { businessType: "gym", businessId: "y1", permissions: ["desk.admit"] },
      { businessType: "gym", businessId: "y2", permissions: ["passes.view"] },
    ]);
    expect(hrefs(two)).toEqual(["/vendor", "/go/gym/manage"]);
    expect(two.find((s) => s.key === "workGym")?.items.map((i) => i.key)).toEqual(["gyms"]);
    // No gym permission at all: no gym link.
    expect(hrefs(vendorSections([], "all", [{ businessType: "gym", businessId: "y1", permissions: [] }]))).toEqual(["/vendor"]);
    // No page of the business panel links to the old gym desks.
    expect(hrefs(staffSections([{ businessType: "gym", businessId: "y1", permissions: ["desk.admit", "desk.admissions", "passes.view"] }])).some((h) => h.startsWith("/vendor/gyms"))).toBe(false);
  });

  it("gym owners get Gyms on gym.kriraghor.com with the shared business tools, once (no gym section)", () => {
    const owner = vendorSections(["gym_owner"], "all");
    expect(owner.map((s) => s.key)).toEqual(["overview", "business"]);
    expect(hrefs(owner).filter((h) => h === GYMS_HREF)).toEqual(["/go/gym/manage"]);
    expect(hrefs(vendorSections(["ground_owner", "shop_owner"], "all"))).not.toContain(GYMS_HREF);
    // An owner who is also staff at another gym sees the link once.
    expect(hrefs(vendorSections(["gym_owner"], "all", [{ businessType: "gym", businessId: "y9", permissions: ["desk.admit"] }])).filter((h) => h === GYMS_HREF)).toHaveLength(1);
    expect(hrefs(VENDOR_SECTIONS).some((h) => h.startsWith("/vendor/gyms"))).toBe(false);
  });

  it("shop staff get orders and inventory by permission", () => {
    expect(hrefs(vendorSections([], "all", [{ businessType: "shop", businessId: "s1", permissions: ["orders.view", "orders.accept"] }]))).toEqual(["/vendor", "/vendor/orders"]);
    expect(hrefs(vendorSections([], "all", [{ businessType: "shop", businessId: "s1", permissions: ["stock.view"] }]))).toEqual(["/vendor", "/vendor/inventory"]);
    expect(hrefs(vendorSections([], "all", [{ businessType: "shop", businessId: "s1", permissions: [] }]))).toEqual(["/vendor"]);
  });

  it("no staff desk ever links to an owner-only page, whatever the permissions", () => {
    const all: W[] = [
      { businessType: "venue", businessId: "g", permissions: ["bookings.view", "bookings.check_in", "bookings.no_show", "bookings.extend", "bookings.collect_balance", "bookings.walk_in", "bookings.move", "bookings.cancel", "reviews.reply"] },
      { businessType: "gym", businessId: "y", permissions: ["desk.admit", "desk.admissions", "passes.view"] },
      { businessType: "shop", businessId: "s", permissions: ["orders.view", "orders.accept", "orders.ship", "orders.deliver", "orders.reject", "stock.view", "stock.adjust"] },
    ];
    const got = hrefs(staffSections(all));
    for (const h of OWNER_ONLY) expect(got).not.toContain(h);
    expect(staffSections(all).map((s) => s.key)).toEqual(["workVenue", "workGym", "workShop"]);
    expect(staffSections(undefined)).toEqual([]);
  });

  it("an owner who also works elsewhere keeps the owner menu and gains the other desks once", () => {
    const shopStaff: W = { businessType: "shop", businessId: "s9", permissions: ["orders.view", "stock.view"] };
    const venueOwner = vendorSections(["ground_owner"], "all", [shopStaff]);
    expect(hrefs(venueOwner)).toEqual([...hrefs(vendorSections(["ground_owner"], "all")), "/vendor/orders", "/vendor/inventory"]);
    // A shop owner already has orders and inventory: nothing repeats.
    const shopOwner = hrefs(vendorSections(["shop_owner"], "all", [shopStaff]));
    expect(shopOwner.filter((h) => h === "/vendor/orders")).toHaveLength(1);
    expect(vendorSections(["shop_owner"], "all", [shopStaff]).some((s) => s.key === "workShop")).toBe(false);
  });
});
