import { DEFAULT_PERIOD, PERIODS, hourLabel } from "../dashboard";
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

// ---------------- round 2 (20 Nov 2026): period, venue and measures in the URL, pure helpers

/** /vendor/analytics's URL filters: business (and org), the period (30 days by default) and a venue (`groundId`, "" = all venues). */
export const ANALYTICS_FILTERS = {
  business: { default: "", allowed: BUSINESS_PARAMS },
  org: { default: "" },
  period: { default: DEFAULT_PERIOD, allowed: PERIODS as readonly string[] },
  groundId: { default: "" },
} as const;

/** The vendor home's URL filter: the period of the summary strip and of every business card. */
export const HOME_FILTERS = { period: { default: DEFAULT_PERIOD, allowed: PERIODS as readonly string[] } } as const;

/** The venue to filter by: the URL's `groundId` when it is one of the owner's venues, else "" (all venues). */
export function pickGround(groundId: string, grounds: readonly { id: string }[] | undefined): string {
  if (!groundId || !grounds) return "";
  return grounds.some((g) => g.id === groundId) ? groundId : "";
}

export type Measure = "units" | "value";
export const MEASURES: readonly Measure[] = ["units", "value"];

/**
 * Sales by category and best sellers by units or by value (the toggle): biggest first (ties by
 * name), each with the other measure as its quieter second figure.
 */
export function rankBy<R extends { units: number; value: number }>(
  rows: readonly R[],
  measure: Measure,
  label: (r: R) => string,
  key: (r: R) => string,
  other: (r: R) => string,
): { key: string; label: string; value: number; secondary: string }[] {
  return rows
    .map((r) => ({ key: key(r), label: label(r), value: measure === "units" ? r.units : r.value, secondary: other(r) }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

/**
 * Busiest hours: the API sends the top six hours by time booked, so they are ranked (most booked
 * first, ties by the earlier hour) rather than drawn as a 24-hour strip whose other hours would
 * read as empty when they are only not in the top six.
 */
export function busiestHours<R extends { hour: number }>(rows: readonly R[], value: (r: R) => number): { hour: number; value: number }[] {
  return rows.map((r) => ({ hour: r.hour, value: value(r) })).sort((a, b) => b.value - a.value || a.hour - b.hour);
}

export type FeePart = "held" | "released" | "refunded" | "fee";
export const FEE_PARTS: readonly FeePart[] = ["held", "released", "refunded", "fee"];

/**
 * Where one tournament's entry fees are (all time): still held by Kriraghor, released to the
 * organiser, refunded to teams, and the Kriraghor fee taken on release (what is left of `collected`;
 * M06 holds: available = held − released − refunded − fee). The parts add up to `collected`; an
 * inconsistent answer never draws a negative fee.
 */
export function feeSplit(e: { collected: number; held: number; released: number; refunded: number }): { total: number; parts: { key: FeePart; value: number }[] } {
  const fee = Math.max(0, e.collected - e.held - e.released - e.refunded);
  const parts = [
    { key: "held" as const, value: Math.max(0, e.held) },
    { key: "released" as const, value: Math.max(0, e.released) },
    { key: "refunded" as const, value: Math.max(0, e.refunded) },
    { key: "fee" as const, value: fee },
  ];
  return { total: Math.max(e.collected, parts.reduce((s, p) => s + p.value, 0)), parts };
}

/** The shop's "coming later" items the page has words for; unknown keys are left out (never shown raw). */
export function comingLaterItems(keys: readonly string[], known: (key: string) => boolean): string[] {
  return keys.filter(known);
}
