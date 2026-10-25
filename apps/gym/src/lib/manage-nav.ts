import type { WorkplaceRef } from "@kriraghor/ui/desk/access";

/**
 * The /manage sidebar on gym.kriraghor.com (moved from the business panel's gym section and the Round
 * B3 "Gym desk" staff section, 25 Oct 2026). The owner sees each of their gyms with its editor, front
 * desk and passes sold; staff see only the gyms they work at, with the front desk when they hold
 * desk.admit or desk.admissions and the passes sold with passes.view (the same rules as panel-nav's
 * workGym). A gym both owned and worked at shows once, as owned. This only shapes the menu: the API
 * enforces every rule (ADR-004).
 */
export type ManageItem = { key: "gyms" | "edit" | "desk" | "passes"; href: string };
export type ManageGroup = { key: string; gymId: string | null; name: string | null; staff: boolean; items: ManageItem[] };

export const DESK_PERMISSIONS = ["desk.admit", "desk.admissions"];
export const PASSES_PERMISSION = "passes.view";

/** The gym desks one staff member may open at one gym, by permission. */
export function staffItems(gymId: string, permissions: readonly string[]): ManageItem[] {
  return [
    ...(permissions.some((p) => DESK_PERMISSIONS.includes(p)) ? [{ key: "desk" as const, href: `/manage/${gymId}/desk` }] : []),
    ...(permissions.includes(PASSES_PERMISSION) ? [{ key: "passes" as const, href: `/manage/${gymId}/passes` }] : []),
  ];
}

/**
 * The sidebar groups: "Gyms" (the list) first, then a group per owned gym (when `owner`), then a group
 * per gym workplace that opens at least one desk. `names` gives workplace names (GET /me/workplaces).
 */
export function manageGroups(input: { owner: boolean; ownGyms: readonly { id: string; name: string }[]; workplaces: readonly WorkplaceRef[]; names?: ReadonlyMap<string, string | null> }): ManageGroup[] {
  const groups: ManageGroup[] = [{ key: "overview", gymId: null, name: null, staff: false, items: [{ key: "gyms", href: "/manage" }] }];
  const owned = new Set<string>();
  if (input.owner) {
    for (const g of input.ownGyms) {
      owned.add(g.id);
      groups.push({
        key: `own:${g.id}`,
        gymId: g.id,
        name: g.name,
        staff: false,
        items: [
          { key: "edit", href: `/manage/${g.id}/edit` },
          { key: "desk", href: `/manage/${g.id}/desk` },
          { key: "passes", href: `/manage/${g.id}/passes` },
        ],
      });
    }
  }
  for (const w of input.workplaces) {
    if (w.businessType !== "gym" || owned.has(w.businessId)) continue;
    const items = staffItems(w.businessId, w.permissions);
    if (!items.length) continue;
    owned.add(w.businessId);
    groups.push({ key: `work:${w.businessId}`, gymId: w.businessId, name: input.names?.get(w.businessId) ?? null, staff: true, items });
  }
  return groups;
}

/** May this person see /manage at all: an active gym owner, or staff at a gym with any gym desk. */
export const canManage = (owner: boolean, workplaces: readonly WorkplaceRef[]) => owner || workplaces.some((w) => w.businessType === "gym" && staffItems(w.businessId, w.permissions).length > 0);
