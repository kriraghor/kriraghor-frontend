import { hourLabel } from "../dashboard";
import { gymHref } from "../links";
import type { BusinessRole } from "../panel-nav";

/**
 * /vendor/analytics since Round B2 (M19 §6.3): one page for every business the person runs. The
 * business switcher lists the venue, shop and gym the person owns (active roles) and each sports
 * organisation they belong to (the API answers 404 to anyone else); the choice lives in the URL as
 * ?business=venue|shop|gym|organiser (with &org=<id> for an organisation). Pure helpers, tested.
 */
export type DashRole = "ground_owner" | "shop_owner" | "gym_owner" | "organiser";
export type Business = { key: string; role: DashRole; orgId: string | null; name: string | null };
type Org = { id: string; name: string; kind: string; status: string };

/** The ?business= value of each dashboard. */
export const BUSINESS_PARAM: Record<DashRole, string> = { ground_owner: "venue", shop_owner: "shop", gym_owner: "gym", organiser: "organiser" };
export const BUSINESS_PARAMS: readonly string[] = Object.values(BUSINESS_PARAM);

/** The gym owner's reports (all gyms) on gym.kriraghor.com; /vendor/analytics?business=gym redirects there too (lib/gym-redirect). */
export const GYM_REPORTS_HREF = gymHref("/manage/reports");

/** A sports organisation whose console is open (verified, or suspended with its history). */
export const isSportsOrg = (o: Org) => o.kind === "sports" && (o.status === "verified" || o.status === "suspended");

/** The switcher's options: venue, shop and gym (sidebar order) for active roles, then each sports organisation. */
export function businessOptions(active: readonly BusinessRole[], orgs: readonly Org[]): Business[] {
  const own = (["ground_owner", "shop_owner", "gym_owner"] as const).filter((r) => active.includes(r)).map((role): Business => ({ key: BUSINESS_PARAM[role], role, orgId: null, name: null }));
  const sports = orgs.filter(isSportsOrg).map((o): Business => ({ key: `organiser:${o.id}`, role: "organiser", orgId: o.id, name: o.name }));
  return [...own, ...sports];
}

/**
 * The dashboard shown: the one in the URL when the person has it; otherwise the business the panel
 * switcher is on (lastPanelRole); otherwise the first. `null` with no business at all.
 */
export function pickBusiness(options: readonly Business[], url: { business: string; org: string }, view: BusinessRole | "all"): Business | null {
  if (!options.length) return null;
  const byUrl = url.business === "organiser" ? options.find((o) => o.role === "organiser" && (!url.org || o.orgId === url.org)) : options.find((o) => o.role !== "organiser" && o.key === url.business);
  return byUrl ?? (view !== "all" ? options.find((o) => o.role === view) : undefined) ?? options[0];
}

/** The URL parameters for a business (org cleared for everything but an organisation). */
export function businessQuery(b: Pick<Business, "role" | "orgId">): { business: string; org: string | null } {
  return { business: BUSINESS_PARAM[b.role], org: b.role === "organiser" ? b.orgId : null };
}

/**
 * A link to one business's analytics, as the vendor home and the to-do lists use it. A gym's numbers
 * are its reports on gym.kriraghor.com since M24 prompt 2 (/manage/reports, through /go/gym).
 */
export function analyticsHref(role: DashRole, orgId?: string | null): string {
  if (role === "gym_owner") return GYM_REPORTS_HREF;
  const q = new URLSearchParams({ business: BUSINESS_PARAM[role] });
  if (role === "organiser" && orgId) q.set("org", orgId);
  return `/vendor/analytics?${q.toString()}`;
}

// ---------------- chart series

type LinePoints = { points: { key: string; value: number; lastYear: number }[]; lastYearShown: boolean };

/** A line with last year as the second series, left out when last year has nothing (FR-05). */
export function lineSeries(chart: LinePoints): { points: { key: string; value: number }[]; compare: number[] | null } {
  return { points: chart.points.map((p) => ({ key: p.key, value: p.value })), compare: chart.lastYearShown ? chart.points.map((p) => p.lastYear) : null };
}

/** Two counts per bucket as one line and its dashed partner (registered, approved). */
export function pairSeries<R extends { key: string }>(rows: readonly R[], main: keyof R, second: keyof R): { points: { key: string; value: number }[]; compare: number[] | null } {
  if (!rows.length) return { points: [], compare: null };
  return { points: rows.map((r) => ({ key: r.key, value: Number(r[main]) || 0 })), compare: rows.map((r) => Number(r[second]) || 0) };
}

export type Bar = { label: string; value: number; tick?: string };

/** All 24 hours of the day (Dhaka) in order, hours with nothing at 0, a tick every six hours. */
export function hourBars(hours: readonly { hour: number; value: number }[], locale = "en"): Bar[] {
  const by = new Map(hours.map((h) => [h.hour, h.value]));
  return Array.from({ length: 24 }, (_, h) => ({ label: hourLabel(h, locale), value: by.get(h) ?? 0, tick: h % 6 === 0 ? hourLabel(h, locale) : "" }));
}

/** Days of the current bucket: "Mon 12" under each of up to ten bars; beyond that the day number every fifth bar and no figures above. */
export function dayBars(days: readonly { day: string; value: number }[], locale = "en"): { bars: Bar[]; values: boolean } {
  const lang = locale === "bn" ? "bn-BD" : "en-GB";
  const at = (d: string) => new Date(`${d}T12:00:00Z`);
  const long = new Intl.DateTimeFormat(lang, { weekday: "short", day: "numeric", timeZone: "UTC" });
  if (days.length <= 10) return { bars: days.map((b) => ({ label: long.format(at(b.day)), value: b.value })), values: true };
  const num = new Intl.DateTimeFormat(lang, { day: "numeric", timeZone: "UTC" });
  return { bars: days.map((b, i) => ({ label: long.format(at(b.day)), value: b.value, tick: i % 5 === 0 ? num.format(at(b.day)) : "" })), values: false };
}
