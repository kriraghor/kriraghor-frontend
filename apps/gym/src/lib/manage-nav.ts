import type { WorkplaceRef } from "@kriraghor/ui/desk/access";

/**
 * The /manage sidebar on gym.kriraghor.com (M24 §4.1; prompt 0 moved it from the business panel, prompt
 * 1 adds the counter pages). One group per gym from GET /manage/gyms (the gyms I own and the gyms I
 * work at), each page shown by role and permission (M24 §3.3):
 *  - Dashboard: the owner and every staff member of that gym (money tiles follow reports.view);
 *  - Front desk: attendance.mark (member check-ins) or desk.admit / desk.admissions (passes);
 *  - Entrance QR (the tablet at the door, M24-FR-51): attendance.mark;
 *  - Members and Requests: members.view (Members also members.trainer);
 *  - Plans (workout plans and diet charts, M24-FR-62): plans.manage;
 *  - Reviews (M17 reviews of the gym with replies): the owner only;
 *  - Fees and Closing: fees.collect;
 *  - Passes sold: passes.view;
 *  - Reports: reports.view (its CSV exports are the owner's); Reminders: the owner only (prompt 2);
 *  - Packages, Import, Settings and the listing editor: the owner only.
 * Owners also get Billing (their plan), Payouts (online fees and passes) and All-gyms reports. A gym both owned and worked at shows once, as owned. This only
 * shapes the menu: the API enforces every rule (ADR-004); tier-locked pages show an upsell.
 */
export type ManageKey =
  | "gyms"
  | "billing"
  | "payouts"
  | "allReports"
  | "dashboard"
  | "desk"
  | "entrance"
  | "members"
  | "requests"
  | "plans"
  | "fees"
  | "closing"
  | "reports"
  | "reminders"
  | "packages"
  | "import"
  | "settings"
  | "edit"
  | "passes"
  | "reviews";
/** The owner-wide pages (not one gym's). */
export type OverviewKey = "gyms" | "billing" | "payouts" | "allReports";
export type GymPageKey = Exclude<ManageKey, OverviewKey>;
export type ManageItem = { key: ManageKey; href: string };
export type ManageGroup = { key: string; gymId: string | null; name: string | null; staff: boolean; listingStatus?: string | null; items: ManageItem[] };
/** A gym as the menu needs it: GET /manage/gyms items, or a Round B3 workplace when that list is not available. */
export type ManageGymRef = { id: string; name: string | null; role: "owner" | "staff"; permissions: readonly string[] | null; listingStatus?: string | null };

export const DESK_PERMISSIONS = ["attendance.mark", "desk.admit", "desk.admissions"];
export const PASSES_PERMISSION = "passes.view";

/** Which pages need what (null = the owner only; [] = anyone at the gym). */
export const PAGE_NEEDS: Record<GymPageKey, readonly string[] | null> = {
  dashboard: [],
  desk: DESK_PERMISSIONS,
  entrance: ["attendance.mark"],
  members: ["members.view", "members.trainer"],
  requests: ["members.view"],
  plans: ["plans.manage"],
  fees: ["fees.collect"],
  closing: ["fees.collect"],
  reports: ["reports.view"],
  reminders: null,
  passes: [PASSES_PERMISSION],
  packages: null,
  import: null,
  settings: null,
  edit: null,
  reviews: null,
};
const ORDER: GymPageKey[] = ["dashboard", "desk", "entrance", "members", "requests", "plans", "fees", "closing", "reports", "reminders", "packages", "import", "settings", "edit", "passes", "reviews"];
const PATH: Record<GymPageKey, string> = {
  dashboard: "",
  desk: "/desk",
  entrance: "/entrance",
  members: "/members",
  requests: "/requests",
  plans: "/plans",
  fees: "/fees",
  closing: "/fees/closing",
  reports: "/reports",
  reminders: "/reminders",
  packages: "/packages",
  import: "/import",
  settings: "/settings",
  edit: "/edit",
  passes: "/passes",
  reviews: "/reviews",
};

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
    groups.push({ key: `${g.role === "owner" ? "own" : "work"}:${g.id}`, gymId: g.id, name: g.name, staff: g.role === "staff", listingStatus: g.listingStatus ?? null, items });
  }
  return groups;
}

/** May this person see /manage at all: someone who owns a gym, or staff at a gym with any desk. */
export const canManage = (gyms: readonly ManageGymRef[]) => gyms.some((g) => g.role === "owner" || staffItems(g.id, g.permissions ?? []).length > 0);

// ---------------- one gym at a time (2 Nov 2026) ----------------

export type GymSectionKey = "today" | "people" | "money" | "setup";
/** A gym's pages in the sidebar, by what the owner is doing. */
const SECTIONS: { key: GymSectionKey; pages: GymPageKey[] }[] = [
  { key: "today", pages: ["dashboard", "desk", "entrance", "requests"] },
  { key: "people", pages: ["members", "plans", "reviews"] },
  { key: "money", pages: ["fees", "closing", "passes", "reports"] },
  { key: "setup", pages: ["edit", "packages", "reminders", "import", "settings"] },
];
/** The /manage pages that are not one gym's. */
const NOT_A_GYM = new Set(["billing", "payouts", "reports"]);

/** The gym id in a /manage path, or null on the pages that are not one gym's. */
export function gymFromPath(pathname: string): string | null {
  const id = pathname.split("/")[2];
  return id && !NOT_A_GYM.has(id) ? id : null;
}

/** The gym the sidebar shows: the one in the URL, else the last one used, else the first. */
export function currentGym(gyms: readonly ManageGroup[], pathname: string, remembered: string | null): ManageGroup | null {
  const byId = (id: string | null) => (id ? gyms.find((g) => g.gymId === id) : undefined);
  return byId(gymFromPath(pathname)) ?? byId(remembered) ?? gyms[0] ?? null;
}

/** A gym's pages in their sections; a section with no page this person may open is left out. */
export const gymSections = (items: readonly ManageItem[]): { key: GymSectionKey; items: ManageItem[] }[] =>
  SECTIONS.map((s) => ({ key: s.key, items: s.pages.flatMap((p) => items.filter((i) => i.key === p)) })).filter((s) => s.items.length);

/** Where choosing another gym goes: the same page there when this person may open it, else its first page. */
export function switchGymHref(pathname: string, from: ManageGroup | null, to: ManageGroup): string {
  const first = to.items[0]?.href ?? "/manage";
  if (!from || gymFromPath(pathname) !== from.gymId) return first;
  const here = [...from.items].sort((a, b) => b.href.length - a.href.length).find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  return to.items.find((i) => i.key === here?.key)?.href ?? first;
}
