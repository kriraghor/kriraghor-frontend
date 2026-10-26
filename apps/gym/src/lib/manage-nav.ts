import type { WorkplaceRef } from "@kriraghor/ui/desk/access";

/**
 * The /manage sidebar on gym.kriraghor.com (M24 §4.1; prompt 0 moved it from the business panel, prompt
 * 1 adds the counter pages). One group per gym from GET /manage/gyms (the gyms I own and the gyms I
 * work at), each page shown by role and permission (M24 §3.3):
 *  - Dashboard: the owner and every staff member of that gym (money tiles follow reports.view);
 *  - Front desk: attendance.mark (member check-ins) or desk.admit / desk.admissions (passes);
 *  - Members and Requests: members.view (Members also members.trainer);
 *  - Fees and Closing: fees.collect;
 *  - Passes sold: passes.view;
 *  - Reports: reports.view (its CSV exports are the owner's); Reminders: the owner only (prompt 2);
 *  - Packages, Import, Settings and the listing editor: the owner only.
 * Owners also get Billing (their plan), Payouts (online fees and passes) and All-gyms reports. A gym both owned and worked at shows once, as owned. This only
 * shapes the menu: the API enforces every rule (ADR-004); tier-locked pages show an upsell.
 */
export type ManageKey = "gyms" | "billing" | "payouts" | "allReports" | "dashboard" | "desk" | "members" | "requests" | "fees" | "closing" | "reports" | "reminders" | "packages" | "import" | "settings" | "edit" | "passes";
/** The owner-wide pages (not one gym's). */
export type OverviewKey = "gyms" | "billing" | "payouts" | "allReports";
export type GymPageKey = Exclude<ManageKey, OverviewKey>;
export type ManageItem = { key: ManageKey; href: string };
export type ManageGroup = { key: string; gymId: string | null; name: string | null; staff: boolean; items: ManageItem[] };
/** A gym as the menu needs it: GET /manage/gyms items, or a Round B3 workplace when that list is not available. */
export type ManageGymRef = { id: string; name: string | null; role: "owner" | "staff"; permissions: readonly string[] | null };

export const DESK_PERMISSIONS = ["attendance.mark", "desk.admit", "desk.admissions"];
export const PASSES_PERMISSION = "passes.view";

/** Which pages need what (null = the owner only; [] = anyone at the gym). */
export const PAGE_NEEDS: Record<GymPageKey, readonly string[] | null> = {
  dashboard: [],
  desk: DESK_PERMISSIONS,
  members: ["members.view", "members.trainer"],
  requests: ["members.view"],
  fees: ["fees.collect"],
  closing: ["fees.collect"],
  reports: ["reports.view"],
  reminders: null,
  passes: [PASSES_PERMISSION],
  packages: null,
  import: null,
  settings: null,
  edit: null,
};
const ORDER: GymPageKey[] = ["dashboard", "desk", "members", "requests", "fees", "closing", "reports", "reminders", "packages", "import", "settings", "edit", "passes"];
const PATH: Record<GymPageKey, string> = { dashboard: "", desk: "/desk", members: "/members", requests: "/requests", fees: "/fees", closing: "/fees/closing", reports: "/reports", reminders: "/reminders", packages: "/packages", import: "/import", settings: "/settings", edit: "/edit", passes: "/passes" };

/** May someone with these permissions (null = the owner) open this page? */
export function canOpen(page: GymPageKey, permissions: readonly string[] | null): boolean {
  if (permissions === null) return true;
  const needs = PAGE_NEEDS[page];
  if (needs === null) return false;
  return needs.length === 0 || needs.some((p) => permissions.includes(p));
}

/** The pages one person may open at one gym, in menu order. */
export function gymItems(gymId: string, permissions: readonly string[] | null): ManageItem[] {
  return ORDER.filter((k) => canOpen(k, permissions)).map((key) => ({ key, href: `/manage/${gymId}${PATH[key]}` }));
}

/** The desks one staff member may open at one gym (the workplace cards; the dashboard is left out there). */
export const staffItems = (gymId: string, permissions: readonly string[]): ManageItem[] => gymItems(gymId, permissions).filter((i) => i.key !== "dashboard");

/** Round B3 workplaces as menu gyms (when GET /manage/gyms is not available, e.g. while it loads). */
export const workplaceGyms = (workplaces: readonly WorkplaceRef[], names?: ReadonlyMap<string, string | null>): ManageGymRef[] =>
  workplaces.filter((w) => w.businessType === "gym").map((w) => ({ id: w.businessId, name: names?.get(w.businessId) ?? null, role: "staff", permissions: w.permissions }));

const OWNER_OVERVIEW: ManageItem[] = [
  { key: "billing", href: "/manage/billing" },
  { key: "payouts", href: "/manage/payouts" },
  { key: "allReports", href: "/manage/reports" },
];

/**
 * The sidebar groups: "My gyms" (and, for owners, Billing, Payouts and All-gyms reports) first, then one group per gym: owned gyms
 * first, then gyms worked at that open at least one desk besides the dashboard.
 */
export function manageGroups(input: { gyms: readonly ManageGymRef[] }): ManageGroup[] {
  const owner = input.gyms.some((g) => g.role === "owner");
  const groups: ManageGroup[] = [{ key: "overview", gymId: null, name: null, staff: false, items: [{ key: "gyms", href: "/manage" }, ...(owner ? OWNER_OVERVIEW : [])] }];
  const seen = new Set<string>();
  const sorted = [...input.gyms].sort((a, b) => (a.role === b.role ? 0 : a.role === "owner" ? -1 : 1));
  for (const g of sorted) {
    if (seen.has(g.id)) continue;
    const perms = g.role === "owner" ? null : (g.permissions ?? []);
    const items = gymItems(g.id, perms);
    if (perms && !items.some((i) => i.key !== "dashboard")) continue;
    seen.add(g.id);
    groups.push({ key: `${g.role === "owner" ? "own" : "work"}:${g.id}`, gymId: g.id, name: g.name, staff: g.role === "staff", items });
  }
  return groups;
}

/** May this person see /manage at all: someone who owns a gym, or staff at a gym with any desk. */
export const canManage = (gyms: readonly ManageGymRef[]) => gyms.some((g) => g.role === "owner" || staffItems(g.id, g.permissions ?? []).length > 0);
