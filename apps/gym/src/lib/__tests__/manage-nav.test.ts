import { describe, expect, it } from "vitest";
import { canManage, manageGroups, staffItems } from "../manage-nav";

type W = { businessType: "venue" | "gym" | "shop"; businessId: string; permissions: string[] };
const hrefs = (groups: { items: { href: string }[] }[]) => groups.flatMap((g) => g.items.map((i) => i.href));

describe("/manage sidebar: owners and Round B3 gym staff (moved from panel-nav)", () => {
  it("an owner sees the list and each of their gyms with its editor, front desk and passes", () => {
    const groups = manageGroups({ owner: true, ownGyms: [{ id: "g1", name: "Iron House" }, { id: "g2", name: "Lift" }], workplaces: [] });
    expect(hrefs(groups)).toEqual(["/manage", "/manage/g1/edit", "/manage/g1/desk", "/manage/g1/passes", "/manage/g2/edit", "/manage/g2/desk", "/manage/g2/passes"]);
    expect(groups.map((g) => g.name)).toEqual([null, "Iron House", "Lift"]);
    expect(groups.every((g) => !g.staff)).toBe(true);
  });

  it("staff see only their gyms: the front desk with desk.admit or desk.admissions, passes with passes.view, never the editor", () => {
    expect(staffItems("y1", ["desk.admit"])).toEqual([{ key: "desk", href: "/manage/y1/desk" }]);
    expect(staffItems("y1", ["desk.admissions"])).toEqual([{ key: "desk", href: "/manage/y1/desk" }]);
    expect(staffItems("y1", ["passes.view"])).toEqual([{ key: "passes", href: "/manage/y1/passes" }]);
    expect(staffItems("y1", ["desk.admit", "desk.admissions", "passes.view"])).toEqual([
      { key: "desk", href: "/manage/y1/desk" },
      { key: "passes", href: "/manage/y1/passes" },
    ]);
    expect(staffItems("y1", [])).toEqual([]);

    const workplaces: W[] = [
      { businessType: "gym", businessId: "y1", permissions: ["desk.admit", "desk.admissions"] },
      { businessType: "gym", businessId: "y2", permissions: ["passes.view"] },
      { businessType: "gym", businessId: "y3", permissions: [] },
      { businessType: "venue", businessId: "v1", permissions: ["bookings.view"] },
      { businessType: "shop", businessId: "s1", permissions: ["orders.view"] },
    ];
    const groups = manageGroups({ owner: false, ownGyms: [{ id: "g9", name: "Not shown" }], workplaces, names: new Map([["y1", "Moushumi's gym"]]) });
    expect(hrefs(groups)).toEqual(["/manage", "/manage/y1/desk", "/manage/y2/passes"]);
    expect(hrefs(groups).some((h) => h.endsWith("/edit"))).toBe(false);
    expect(groups.slice(1).map((g) => [g.gymId, g.name, g.staff])).toEqual([
      ["y1", "Moushumi's gym", true],
      ["y2", null, true],
    ]);
  });

  it("a gym both owned and worked at shows once, as owned", () => {
    const groups = manageGroups({ owner: true, ownGyms: [{ id: "g1", name: "Iron House" }], workplaces: [{ businessType: "gym", businessId: "g1", permissions: ["desk.admit"] }, { businessType: "gym", businessId: "y2", permissions: ["desk.admit"] }] });
    expect(groups.map((g) => g.key)).toEqual(["overview", "own:g1", "work:y2"]);
  });

  it("only gym owners and gym staff with a desk may manage", () => {
    expect(canManage(true, [])).toBe(true);
    expect(canManage(false, [{ businessType: "gym", businessId: "y1", permissions: ["passes.view"] }])).toBe(true);
    expect(canManage(false, [{ businessType: "gym", businessId: "y1", permissions: [] }])).toBe(false);
    expect(canManage(false, [{ businessType: "venue", businessId: "v1", permissions: ["bookings.view"] }])).toBe(false);
    expect(canManage(false, [])).toBe(false);
  });
});
