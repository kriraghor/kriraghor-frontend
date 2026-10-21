import { describe, expect, it } from "vitest";
import { ADMIN_SECTIONS, VENDOR_SECTIONS, adminSections, businessView, vendorSections } from "../panel-nav";

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

  it("analytics and reviews belong to venue owners only; settlement to shops", () => {
    const shop = hrefs(vendorSections(["shop_owner"], "all"));
    expect(shop).toContain("/vendor/settlement");
    expect(shop).not.toContain("/vendor/analytics");
    expect(shop).not.toContain("/vendor/reviews");
    expect(shop).toContain("/vendor/disputes");
    const venue = hrefs(vendorSections(["ground_owner"], "all"));
    expect(venue).toEqual(expect.arrayContaining(["/vendor/venues", "/vendor/bookings", "/vendor/analytics", "/vendor/reviews"]));
    expect(venue).not.toContain("/vendor/settlement");
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
