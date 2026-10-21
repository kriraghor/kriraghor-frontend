import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";

/**
 * The pro's earnings and performance (M11 §4 Earnings, §9 GET /pro/earnings, M19 §4.2 and §6.3 "Pro";
 * Round B1): GET /pro/insights?period=7w|qtr|yr. Money is poisha (shown with formatTaka); the bars are
 * Dhaka weeks (7w, qtr) or months (yr). Pure formatting helpers, unit-tested.
 */
export type Insights = components["schemas"]["HireInsights"];
export type Period = Insights["period"];
export const PERIODS: Period[] = ["7w", "qtr", "yr"];

export const insights = {
  read: async (period: Period) => {
    const res = await api().GET("/pro/insights", { params: { query: { period } } });
    if (res.error || res.data === undefined) throw res.error;
    return res.data;
  },
};

/** A period from the URL (?period=), else the default 7 weeks. */
export const periodOf = (raw: string | null | undefined): Period => (PERIODS.includes(raw as Period) ? (raw as Period) : "7w");

/** A share in percent, whole number, in the locale's digits ("90%", "৯০%"); null stays null. */
export function percent(value: number | null | undefined, locale = "en"): string | null {
  if (value === null || value === undefined) return null;
  return `${new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-GB", { maximumFractionDigits: 0 }).format(Math.round(value))}%`;
}

/** A reply time as the unit to say it in: under an hour in minutes, under a day in hours, else days (at least 1). */
export function replyTime(minutes: number | null | undefined): { unit: "min" | "hours" | "days"; n: number } | null {
  if (minutes === null || minutes === undefined) return null;
  if (minutes < 60) return { unit: "min", n: Math.max(1, Math.round(minutes)) };
  if (minutes < 1440) return { unit: "hours", n: Math.round(minutes / 60) };
  return { unit: "days", n: Math.round(minutes / 1440) };
}

/** A bar's label: the week's first day ("12 Oct") or the month ("Oct"), on the Dhaka calendar. */
export function bucketLabel(bucket: { key: string; from: string }, period: Period, locale = "en"): string {
  const tag = locale === "bn" ? "bn-BD" : "en-GB";
  const d = new Date(`${bucket.from}T00:00:00Z`);
  return period === "yr" ? new Intl.DateTimeFormat(tag, { month: "short", timeZone: "UTC" }).format(d) : new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", timeZone: "UTC" }).format(d);
}

/** The average rating to one decimal ("4.6"), or null without reviews. */
export const ratingText = (rating: { avg: number | null; count: number }, locale = "en") =>
  rating.avg === null || !rating.count ? null : new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rating.avg);

/** Poisha as short taka for a bar label ("৳12.5K", "৳800"; Bangla digits for bn). */
export const compactTaka = (poisha: number, locale = "en") =>
  `৳${new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(Math.trunc(poisha / 100))}`;

/** Whether the period had any earnings to chart. */
export const hasEarnings = (x: Pick<Insights, "buckets">) => x.buckets.some((b) => b.amount > 0);
