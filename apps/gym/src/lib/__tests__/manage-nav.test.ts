import { describe, expect, it } from "vitest";
import { canManage, canOpen, currentGym, gymFromPath, gymItems, gymSections, manageGroups, staffItems, switchGymHref, workplaceGyms, type ManageGymRef } from "../manage-nav";

const hrefs = (groups: { items: { href: string }[] }[]) => groups.flatMap((g) => g.items.map((i) => i.href));
const own = (id: string, name: string): ManageGymRef => ({ id, name, role: "owner", permissions: null });
const work = (id: string, permissions: string[], name: string | null = null): ManageGymRef => ({ id, name, role: "staff", permissions });
/** A staff member's pages besides Desk mode (my own PIN, for everyone at the gym; tested on its own below). */
const pages = (permissions: string[]) => gymItems("y1", permissions).map((i) => i.key).filter((k) => k !== "deskmode");

describe("/manage sidebar per owner and staff permission (M24 §3.3, §4.1)", () => {
  it("carries each gym's listing status for the dropdown", () => {
    const groups = manageGroups({ gyms: [{ ...own("g1", "Iron House"), listingStatus: "draft" }, own("g2", "Lift")] });
    expect(groups.slice(1).map((g) => g.listingStatus)).toEqual(["draft", null]);
  });

  it("an owner sees My gyms, Billing, Payouts and All-gyms reports, then every page of each gym in menu order", () => {
    const groups = manageGroups({ gyms: [own("g1", "Iron House"), own("g2", "Lift")] });
    expect(groups[0].items.map((i) => i.href)).toEqual(["/manage", "/manage/billing", "/manage/payouts", "/manage/reports"]);
    expect(groups[1].items.map((i) => i.href)).toEqual([
      "/manage/g1",
      "/manage/g1/desk",
      "/manage/g1/entrance",
      "/manage/g1/members",
      "/manage/g1/requests",
      "/manage/g1/plans",
      "/manage/g1/fees",
      "/manage/g1/fees/closing",
      "/manage/g1/offline-items",
      "/manage/g1/reports",
      "/manage/g1/reminders",
      "/manage/g1/packages",
      "/manage/g1/import",
      "/manage/g1/settings",
      "/manage/g1/edit",
      "/manage/g1/passes",
      "/manage/g1/reviews",
      "/manage/g1/expenses",
      "/manage/g1/cash",
      "/manage/g1/pnl",
      "/manage/g1/sell",
      "/manage/g1/stock",
      "/manage/g1/lockers",
      "/manage/g1/classes",
      "/manage/g1/rewards",
      "/manage/g1/notices",
      "/manage/g1/leads",
      "/manage/g1/whatsapp",
      "/manage/g1/staff",
      "/manage/g1/payroll",
      "/manage/g1/equipment",
      "/manage/g1/desk-mode",
    ]);
    expect(groups.map((g) => g.name)).toEqual([null, "Iron House", "Lift"]);
    expect(groups.every((g) => !g.staff)).toBe(true);
  });

  it("staff see the dashboard and only the pages their permissions open, never the owner's pages", () => {
    expect(pages(["attendance.mark"])).toEqual(["dashboard", "desk", "entrance", "classes"]);
    // M27 round 2: classes for whoever runs or marks them; rewards, notices and enquiries each by their own permission.
    expect(pages(["classes.manage"])).toEqual(["dashboard", "classes"]);
    expect(pages(["rewards.redeem", "notices.send", "leads.manage"])).toEqual(["dashboard", "rewards", "notices", "leads"]);
    // M27 round 3: attendance for shifts.manage or reports.view, equipment for assets.manage, My work for clock.in; payroll never for staff.
    expect(pages(["shifts.manage", "assets.manage", "clock.in"])).toEqual(["dashboard", "staff", "equipment", "mywork"]);
    expect(canOpen("payroll", ["shifts.manage", "reports.view", "clock.in"])).toBe(false);
    expect(canOpen("mywork", null)).toBe(false);
    expect(pages(["plans.manage"])).toEqual(["dashboard", "plans"]);
    expect(pages(["desk.admit"])).toEqual(["dashboard", "desk"]);
    expect(pages(["desk.admissions"])).toEqual(["dashboard", "desk"]);
    expect(pages(["members.view"])).toEqual(["dashboard", "members", "requests"]);
    expect(pages(["members.trainer"])).toEqual(["dashboard", "members"]);
    expect(pages(["members.view", "fees.collect"])).toEqual(["dashboard", "members", "requests", "fees", "closing"]);
    expect(pages(["passes.view"])).toEqual(["dashboard", "passes"]);
    expect(pages(["reports.view"])).toEqual(["dashboard", "reports", "expenses", "cash", "pnl", "staff", "equipment"]);
    // M27 round 1: each counter desk on its own permission.
    expect(pages(["cash.drawer", "pos.sell"])).toEqual(["dashboard", "cash", "sell"]);
    expect(pages(["stock.manage"])).toEqual(["dashboard", "stock"]);
    expect(pages(["lockers.manage"])).toEqual(["dashboard", "lockers"]);
    expect(pages(["expenses.manage"])).toEqual(["dashboard", "expenses"]);
    expect(pages(["fees.collect", "reports.view"])).toEqual(["dashboard", "fees", "closing", "reports", "expenses", "cash", "pnl", "staff", "equipment"]);
    expect(gymItems("y1", ["attendance.mark", "members.view", "members.edit", "fees.collect", "fees.adjust", "reports.view", "passes.view"]).some((i) => ["reminders", "packages", "import", "settings", "edit", "reviews"].includes(i.key))).toBe(false);
    for (const page of ["reminders", "packages", "import", "settings", "edit", "reviews"] as const) {
      expect(canOpen(page, ["attendance.mark", "members.edit", "fees.adjust"])).toBe(false);
      expect(canOpen(page, null)).toBe(true);
    }
    expect(staffItems("y1", ["desk.admit", "passes.view"])).toEqual([
      { key: "desk", href: "/manage/y1/desk" },
      { key: "passes", href: "/manage/y1/passes" },
    ]);
    expect(staffItems("y1", [])).toEqual([]);
  });

  it("staff groups: Billing, Payouts and All-gyms reports are owner-only, a gym with no desk besides the dashboard is left out", () => {
    const groups = manageGroups({ gyms: [work("y1", ["attendance.mark", "fees.collect"], "Moushumi's gym"), work("y2", ["passes.view"]), work("y3", [])] });
    expect(groups[0].items.map((i) => i.key)).toEqual(["gyms"]);
    expect(hrefs(groups)).toEqual(["/manage", "/manage/y1", "/manage/y1/desk", "/manage/y1/entrance", "/manage/y1/fees", "/manage/y1/fees/closing", "/manage/y1/classes", "/manage/y1/desk-mode", "/manage/y2", "/manage/y2/passes", "/manage/y2/desk-mode"]);
    expect(groups.slice(1).map((g) => [g.gymId, g.name, g.staff])).toEqual([
      ["y1", "Moushumi's gym", true],
      ["y2", null, true],
    ]);
  });

  it("a gym both owned and worked at shows once, as owned, and owned gyms come first", () => {
    const groups = manageGroups({ gyms: [work("y2", ["desk.admit"]), own("g1", "Iron House"), work("g1", ["desk.admit"])] });
    expect(groups.map((g) => g.key)).toEqual(["overview", "own:g1", "work:y2"]);
  });

  it("falls back to the Round B3 workplaces (gyms only) with their names", () => {
    const gyms = workplaceGyms(
      [
        { businessType: "gym", businessId: "y1", permissions: ["desk.admit"] },
        { businessType: "venue", businessId: "v1", permissions: ["bookings.view"] },
      ],
      new Map([["y1", "PowerHouse"]]),
    );
    expect(gyms).toEqual([{ id: "y1", name: "PowerHouse", role: "staff", permissions: ["desk.admit"] }]);
  });

  it("only gym owners and gym staff with a desk may manage", () => {
    expect(canManage([own("g1", "x")])).toBe(true);
    expect(canManage([work("y1", ["passes.view"])])).toBe(true);
    expect(canManage([work("y1", ["fees.collect"])])).toBe(true);
    expect(canManage([work("y1", [])])).toBe(false);
    expect(canManage([])).toBe(false);
  });
});

describe("desk mode (M24 §21)", () => {
  it("Desk mode is for everyone at the gym, but alone does not make a desk", () => {
    expect(gymItems("y1", []).map((i) => i.key)).toEqual(["dashboard", "deskmode"]);
    expect(gymItems("y1", ["passes.view"]).at(-1)).toEqual({ key: "deskmode", href: "/manage/y1/desk-mode" });
    expect(gymItems("g1", null).at(-1)?.key).toBe("deskmode");
    expect(staffItems("y1", [])).toEqual([]);
    expect(manageGroups({ gyms: [work("y3", [])] }).map((g) => g.key)).toEqual(["overview"]);
  });

  it("a desk device shows its own gym only, without owner-only pages, the owner overview or Desk mode itself", () => {
    const groups = manageGroups({ gyms: [own("g1", "Iron House"), own("g2", "Lift"), work("y1", ["desk.admit"])], deskGymId: "g1" });
    expect(groups.map((g) => g.key)).toEqual(["overview", "own:g1"]);
    expect(groups[0].items.map((i) => i.key)).toEqual(["gyms"]);
    const keys = groups[1].items.map((i) => i.key);
    for (const ownerOnly of ["reminders", "packages", "import", "settings", "edit", "reviews", "payroll", "deskmode"]) expect(keys).not.toContain(ownerOnly);
    expect(keys).toEqual(expect.arrayContaining(["dashboard", "desk", "members", "fees", "closing"]));
    // Staff at the desk keep exactly their own pages.
    const staffDesk = manageGroups({ gyms: [work("y1", ["desk.admit", "fees.collect"])], deskGymId: "y1" });
    expect(staffDesk[1].items.map((i) => i.key)).toEqual(["dashboard", "desk", "fees", "closing"]);
  });
});

describe("/manage one gym at a time", () => {
  const gyms = manageGroups({ gyms: [own("g1", "Iron House"), own("g2", "Lift"), work("g3", ["members.view"], "Pulse")] }).slice(1);
  const [g1, g2, g3] = gyms;

  it("finds the gym in the path, and none on the all-gyms pages", () => {
    expect(gymFromPath("/manage/g1")).toBe("g1");
    expect(gymFromPath("/manage/g1/members/m9")).toBe("g1");
    for (const p of ["/manage", "/manage/billing", "/manage/billing/invoices", "/manage/payouts", "/manage/reports"]) expect(gymFromPath(p)).toBeNull();
  });

  it("shows the gym in the URL, else the last one used, else the first", () => {
    expect(currentGym(gyms, "/manage/g2/fees", "g1")?.gymId).toBe("g2");
    expect(currentGym(gyms, "/manage/billing", "g2")?.gymId).toBe("g2");
    expect(currentGym(gyms, "/manage/billing", "gone")?.gymId).toBe("g1");
    expect(currentGym(gyms, "/manage/unknown/fees", null)?.gymId).toBe("g1");
    expect(currentGym([], "/manage", null)).toBeNull();
  });

  it("groups an owner's pages into sections, with every page once", () => {
    const sections = gymSections(g1.items);
    expect(sections.map((x) => x.key)).toEqual(["today", "people", "engage", "counter", "money", "team", "setup"]);
    expect(sections.flatMap((x) => x.items.map((i) => i.key)).sort()).toEqual(g1.items.map((i) => i.key).sort());
    expect(sections[0].items.map((i) => i.key)).toEqual(["dashboard", "desk", "entrance", "requests"]);
  });

  it("leaves out a section with no page for staff", () => {
    const sections = gymSections(g3.items);
    expect(sections.map((x) => x.key)).toEqual(["today", "people", "setup"]);
    expect(sections.flatMap((x) => x.items.map((i) => i.key))).toEqual(["dashboard", "requests", "members", "deskmode"]);
  });

  it("keeps your place when switching gyms", () => {
    expect(switchGymHref("/manage/g1/members", g1, g2)).toBe("/manage/g2/members");
    expect(switchGymHref("/manage/g1/members/m9", g1, g2)).toBe("/manage/g2/members");
    expect(switchGymHref("/manage/g1/fees/closing", g1, g2)).toBe("/manage/g2/fees/closing");
    expect(switchGymHref("/manage/g1", g1, g2)).toBe("/manage/g2");
  });

  it("opens the dashboard when that page is not allowed there, or the path has no gym", () => {
    expect(switchGymHref("/manage/g1/settings", g1, g3)).toBe("/manage/g3");
    expect(switchGymHref("/manage/billing", g1, g2)).toBe("/manage/g2");
    expect(switchGymHref("/manage/g1/members", null, g2)).toBe("/manage/g2");
  });
});

describe("offline items (M24 §22)", () => {
  it("are for the owner and fees.adjust, in Money after Cash closing, also at a desk", () => {
    expect(pages(["fees.collect"])).not.toContain("offline");
    expect(pages(["fees.adjust"])).toContain("offline");
    expect(gymItems("g1", null).map((i) => i.key)).toContain("offline");
    expect(gymItems("g1", null, { desk: true }).find((i) => i.key === "offline")).toEqual({ key: "offline", href: "/manage/g1/offline-items" });
    const money = gymSections(gymItems("g1", null)).find((x) => x.key === "money");
    expect(money?.items.map((i) => i.key).slice(0, 3)).toEqual(["fees", "closing", "offline"]);
  });
});

describe("WhatsApp (M24-FR-157)", () => {
  it("is for the owner and staff with whatsapp.send, in Engage after Enquiries", () => {
    expect(gymItems("g1", null).find((i) => i.key === "whatsapp")).toEqual({ key: "whatsapp", href: "/manage/g1/whatsapp" });
    expect(canOpen("whatsapp", ["notices.send", "leads.manage", "members.view", "members.edit"])).toBe(false);
    expect(pages(["notices.send", "leads.manage"])).not.toContain("whatsapp");
    expect(pages(["members.view", "whatsapp.send"])).toEqual(["dashboard", "members", "requests", "whatsapp"]);
    expect(staffItems("y1", ["whatsapp.send"])).toEqual([{ key: "whatsapp", href: "/manage/y1/whatsapp" }]);
    const engage = gymSections(gymItems("g1", null)).find((x) => x.key === "engage");
    expect(engage?.items.map((i) => i.key)).toEqual(["classes", "rewards", "notices", "leads", "whatsapp"]);
  });
});
