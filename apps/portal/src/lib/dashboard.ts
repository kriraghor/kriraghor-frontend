import { api } from "@kriraghor/api-client";
import type { components, paths } from "@kriraghor/api-client/schema";
import { downloadCsv as sharedDownloadCsv } from "@kriraghor/ui/csv";
import { formatTaka, unwrap } from "./admin/finance";

/**
 * M19 dashboards on the portal: the ground owner's Overview and Analytics (vendor host, customer
 * session) and the platform overview (admin host, staff session: master or view_analytics).
 */
export type Period = "7w" | "qtr" | "yr";
/** Every answer of GET /me/dashboard, told apart by `role` (read from the path, not the schema names). */
type DashboardAnswer = paths["/me/dashboard"]["get"]["responses"][200]["content"]["application/json"];
export type OwnerDashboard = Extract<DashboardAnswer, { role: "ground_owner" }>;
export type ShopDashboard = Extract<DashboardAnswer, { role: "shop_owner" }>;
export type GymDashboard = Extract<DashboardAnswer, { role: "gym_owner" }>;
export type OrganiserDashboard = Extract<DashboardAnswer, { role: "organiser" }>;
export type PlatformOverview = components["schemas"]["PlatformOverview"];
export type Actions = components["schemas"]["PendingActions"];
export type Tile = components["schemas"]["KpiTile"];
export type ActionItem = Actions["items"][number];
/** The businesses "Needs your action" answers for (GET /me/dashboard/actions?role=); organisers since Round B2. */
export type ActionRole = "ground_owner" | "shop_owner" | "gym_owner" | "organiser";
export const ACTION_ROLES: readonly string[] = ["ground_owner", "shop_owner", "gym_owner", "organiser"];
type Locale = "en" | "bn";
const loc = (locale: string): Locale => (locale === "bn" ? "bn" : "en");
const dash = async (query: { role: "ground_owner" | "shop_owner" | "gym_owner" | "organiser"; period: Period; locale: Locale; orgId?: string }) => unwrap(await api().GET("/me/dashboard", { params: { query } }));

export const dashboards = {
  /** The tiles' definitions come back in the page's language (M19 §6, EN and BN). */
  owner: async (period: Period, locale = "en") => (await dash({ role: "ground_owner", period, locale: loc(locale) })) as OwnerDashboard,
  /** Round B2 (M19 §6.3): the shop owner's, the gym owner's and one sports organisation's dashboard. */
  shop: async (period: Period, locale = "en") => (await dash({ role: "shop_owner", period, locale: loc(locale) })) as ShopDashboard,
  gym: async (period: Period, locale = "en") => (await dash({ role: "gym_owner", period, locale: loc(locale) })) as GymDashboard,
  organiser: async (orgId: string, period: Period, locale = "en") => (await dash({ role: "organiser", orgId, period, locale: loc(locale) })) as OrganiserDashboard,
  /** M19-FR-11 for one business: venue (default), shop, gym or the sports organisations. */
  ownerActions: async (role: ActionRole = "ground_owner") => unwrap(await api().GET("/me/dashboard/actions", { params: { query: { role } } })),
  platform: async (period: Period) => unwrap(await api("admin").GET("/admin/analytics/overview", { params: { query: { period } } })),
  staffActions: async () => unwrap(await api("admin").GET("/admin/analytics/actions")),
};

/** Fetch a dashboard CSV through the API (with the session) and save it (the shared @kriraghor/ui/csv helper). */
export async function downloadCsv(audience: "api" | "admin", path: "/me/dashboard/export" | "/admin/analytics/export", query: Record<string, string>) {
  await sharedDownloadCsv(audience, path, query);
}

/** Saving a CSV answer, its file name and the words for a failed export live in @kriraghor/ui/csv (shared with gym.kriraghor.com). */
export { csvErrorKey, csvFilename, saveCsv } from "@kriraghor/ui/csv";

// ---------------- pure helpers (tested)

/**
 * Desk paths a module may still send in its old form (the 19 Oct 2026 renames, and esports leaving
 * the business panel on 21 Oct 2026), mapped to where the desk lives now. Other paths pass through.
 */
const MOVED: [RegExp, string][] = [
  [/^\/vendor\/grounds(?=[/?#]|$)/, "/vendor/venues"],
  [/^\/vendor\/tournaments\/([^/?#]+)\/t\/([^/?#]+)/, "/vendor/events/$1/e/$2"],
  [/^\/vendor\/tournaments(?=[/?#]|$)/, "/vendor/events"],
  [/^\/vendor\/esports(?:\/[^?#]*)?(?:[?#].*)?$/, "/vendor/events"],
];
export function deskHref(href: string): string {
  for (const [from, to] of MOVED) if (from.test(href)) return href.replace(from, to);
  return href;
}

const SEVERITY: Record<string, number> = { high: 0, normal: 1, low: 2 };
const dueTime = (a: { dueAt: string | null }) => (a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY);

/**
 * M19-FR-11 across businesses: the per-role lists as one, most urgent first (severity, then the
 * earliest due time; items with no due time after those with one), each tagged with its business
 * and its link moved to the current desk path.
 */
export function mergeActions<R extends string>(lists: { role: R; items: ActionItem[] }[]): (ActionItem & { role: R })[] {
  return lists
    .flatMap(({ role, items }) => items.map((a) => ({ ...a, href: deskHref(a.href), role })))
    .sort((a, b) => (SEVERITY[a.severity] ?? 1) - (SEVERITY[b.severity] ?? 1) || dueTime(a) - dueTime(b));
}

/** A setup checklist: the next step (-1 once every step is done) and how many are done. */
export function checklist<S extends { done: boolean }>(steps: S[]): { steps: S[]; current: number; complete: boolean; doneCount: number } {
  const current = steps.findIndex((s) => !s.done);
  return { steps, current, complete: current === -1, doneCount: steps.filter((s) => s.done).length };
}

const BN = "০১২৩৪৫৬৭৮৯";
const bn = (s: string) => s.replace(/\d/g, (d) => BN[Number(d)]);

/** FR-07: "৳4.3 lakh" from ৳1 lakh up, otherwise the full taka figure. */
export function compactTaka(poisha: number | null | undefined, locale = "en"): string {
  if (poisha === null || poisha === undefined) return "–";
  const taka = poisha / 100;
  if (Math.abs(taka) >= 1e7) {
    const s = `৳${(taka / 1e7).toFixed(1).replace(/\.0$/, "")} ${locale === "bn" ? "কোটি" : "crore"}`;
    return locale === "bn" ? bn(s) : s;
  }
  if (Math.abs(taka) >= 1e5) {
    const s = `৳${(taka / 1e5).toFixed(1).replace(/\.0$/, "")} ${locale === "bn" ? "লাখ" : "lakh"}`;
    return locale === "bn" ? bn(s) : s;
  }
  return formatTaka(poisha, locale);
}

/** A rate (0.382) as "38%" (one decimal under 10%). */
export function pct(rate: number | null | undefined, locale = "en"): string {
  if (rate === null || rate === undefined) return "–";
  const v = rate * 100;
  const s = `${v < 10 ? v.toFixed(1).replace(/\.0$/, "") : Math.round(v)}%`;
  return locale === "bn" ? bn(s) : s;
}

/** A bucket key as a short label: weeks "12 Oct", months "Oct 26". */
export function bucketLabel(key: string, locale = "en"): string {
  const month = key.length === 7;
  const d = new Date(`${month ? `${key}-01` : key}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", month ? { month: "short", year: "2-digit", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" }).format(d);
}

/** An hour of the day as "6 pm". */
export function hourLabel(h: number, locale = "en"): string {
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { hour: "numeric", hour12: true, timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 1, h)));
}
