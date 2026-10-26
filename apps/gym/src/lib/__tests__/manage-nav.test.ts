import { describe, expect, it } from "vitest";
import { canManage, canOpen, gymItems, manageGroups, staffItems, workplaceGyms, type ManageGymRef } from "../manage-nav";

const hrefs = (groups: { items: { href: string }[] }[]) => groups.flatMap((g) => g.items.map((i) => i.href));
const own = (id: string, name: string): ManageGymRef => ({ id, name, role: "owner", permissions: null });
const work = (id: string, permissions: string[], name: string | null = null): ManageGymRef => ({ id, name, role: "staff", permissions });

describe("/manage sidebar per owner and staff permission (M24 §3.3, §4.1)", () => {
  it("an owner sees My gyms, Billing, Payouts and All-gyms reports, then every page of each gym in menu order", () => {
    const groups = manageGroups({ gyms: [own("g1", "Iron House"), own("g2", "Lift")] });
    expect(groups[0].items.map((i) => i.href)).toEqual(["/manage", "/manage/billing", "/manage/payouts", "/manage/reports"]);
    expect(groups[1].items.map((i) => i.href)).toEqual([
      "/manage/g1",
      "/manage/g1/desk",
      "/manage/g1/members",
      "/manage/g1/requests",
      "/manage/g1/fees",
      "/manage/g1/fees/closing",
      "/manage/g1/reports",
      "/manage/g1/reminders",
      "/manage/g1/packages",
      "/manage/g1/import",
      "/manage/g1/settings",
      "/manage/g1/edit",
      "/manage/g1/passes",
    ]);
    expect(groups.map((g) => g.name)).toEqual([null, "Iron House", "Lift"]);
    expect(groups.every((g) => !g.staff)).toBe(true);
  });

  it("staff see the dashboard and only the pages their permissions open, never the owner's pages", () => {
    expect(gymItems("y1", ["attendance.mark"]).map((i) => i.key)).toEqual(["dashboard", "desk"]);
    expect(gymItems("y1", ["desk.admit"]).map((i) => i.key)).toEqual(["dashboard", "desk"]);
    expect(gymItems("y1", ["desk.admissions"]).map((i) => i.key)).toEqual(["dashboard", "desk"]);
    expect(gymItems("y1", ["members.view"]).map((i) => i.key)).toEqual(["dashboard", "members", "requests"]);
    expect(gymItems("y1", ["members.trainer"]).map((i) => i.key)).toEqual(["dashboard", "members"]);
    expect(gymItems("y1", ["members.view", "fees.collect"]).map((i) => i.key)).toEqual(["dashboard", "members", "requests", "fees", "closing"]);
    expect(gymItems("y1", ["passes.view"]).map((i) => i.key)).toEqual(["dashboard", "passes"]);
    expect(gymItems("y1", ["reports.view"]).map((i) => i.key)).toEqual(["dashboard", "reports"]);
    expect(gymItems("y1", ["fees.collect", "reports.view"]).map((i) => i.key)).toEqual(["dashboard", "fees", "closing", "reports"]);
    expect(gymItems("y1", ["attendance.mark", "members.view", "members.edit", "fees.collect", "fees.adjust", "reports.view", "passes.view"]).some((i) => ["reminders", "packages", "import", "settings", "edit"].includes(i.key))).toBe(false);
    for (const page of ["reminders", "packages", "import", "settings", "edit"] as const) {
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
    expect(hrefs(groups)).toEqual(["/manage", "/manage/y1", "/manage/y1/desk", "/manage/y1/fees", "/manage/y1/fees/closing", "/manage/y2", "/manage/y2/passes"]);
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
