import { describe, expect, it } from "vitest";
import { canManage, canOpen, currentGym, gymFromPath, gymItems, gymSections, manageGroups, staffItems, switchGymHref, workplaceGyms, type ManageGymRef } from "../manage-nav";

const hrefs = (groups: { items: { href: string }[] }[]) => groups.flatMap((g) => g.items.map((i) => i.href));
const own = (id: string, name: string): ManageGymRef => ({ id, name, role: "owner", permissions: null });
const work = (id: string, permissions: string[], name: string | null = null): ManageGymRef => ({ id, name, role: "staff", permissions });

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
      "/manage/g1/reports",
      "/manage/g1/reminders",
      "/manage/g1/packages",
      "/manage/g1/import",
      "/manage/g1/settings",
      "/manage/g1/edit",
      "/manage/g1/passes",
      "/manage/g1/reviews",
    ]);
    expect(groups.map((g) => g.name)).toEqual([null, "Iron House", "Lift"]);
    expect(groups.every((g) => !g.staff)).toBe(true);
  });

  it("staff see the dashboard and only the pages their permissions open, never the owner's pages", () => {
    expect(gymItems("y1", ["attendance.mark"]).map((i) => i.key)).toEqual(["dashboard", "desk", "entrance"]);
    expect(gymItems("y1", ["plans.manage"]).map((i) => i.key)).toEqual(["dashboard", "plans"]);
    expect(gymItems("y1", ["desk.admit"]).map((i) => i.key)).toEqual(["dashboard", "desk"]);
    expect(gymItems("y1", ["desk.admissions"]).map((i) => i.key)).toEqual(["dashboard", "desk"]);
    expect(gymItems("y1", ["members.view"]).map((i) => i.key)).toEqual(["dashboard", "members", "requests"]);
    expect(gymItems("y1", ["members.trainer"]).map((i) => i.key)).toEqual(["dashboard", "members"]);
    expect(gymItems("y1", ["members.view", "fees.collect"]).map((i) => i.key)).toEqual(["dashboard", "members", "requests", "fees", "closing"]);
    expect(gymItems("y1", ["passes.view"]).map((i) => i.key)).toEqual(["dashboard", "passes"]);
    expect(gymItems("y1", ["reports.view"]).map((i) => i.key)).toEqual(["dashboard", "reports"]);
    expect(gymItems("y1", ["fees.collect", "reports.view"]).map((i) => i.key)).toEqual(["dashboard", "fees", "closing", "reports"]);
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
    expect(hrefs(groups)).toEqual(["/manage", "/manage/y1", "/manage/y1/desk", "/manage/y1/entrance", "/manage/y1/fees", "/manage/y1/fees/closing", "/manage/y2", "/manage/y2/passes"]);
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
    expect(sections.map((x) => x.key)).toEqual(["today", "people", "money", "setup"]);
    expect(sections.flatMap((x) => x.items.map((i) => i.key)).sort()).toEqual(g1.items.map((i) => i.key).sort());
    expect(sections[0].items.map((i) => i.key)).toEqual(["dashboard", "desk", "entrance", "requests"]);
  });

  it("leaves out a section with no page for staff", () => {
    const sections = gymSections(g3.items);
    expect(sections.map((x) => x.key)).toEqual(["today", "people"]);
    expect(sections.flatMap((x) => x.items.map((i) => i.key))).toEqual(["dashboard", "requests", "members"]);
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
