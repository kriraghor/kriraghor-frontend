import { describe, expect, it } from "vitest";
import { ADMIN_SECTIONS, adminSections, vendorSections } from "../panel-nav";

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
});
