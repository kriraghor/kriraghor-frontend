import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "./finance";

/**
 * The staff review figures on the admin home (M19 §6.4, FR-33): GET /admin/analytics/reviews for
 * masters and reviewers, "me" (my own decisions) or "team" (everyone's, in the kinds I may review).
 */
export type ReviewFigures = components["schemas"]["ReviewFigures"];
export type ReviewScope = "me" | "team";
export const REVIEW_SCOPES: readonly ReviewScope[] = ["me", "team"];

export const reviewFigures = async (scope: ReviewScope, locale = "en") => unwrap(await api("admin").GET("/admin/analytics/reviews", { params: { query: { scope, locale: locale === "bn" ? "bn" : "en" } } })) as ReviewFigures;

/** Who sees the figures: masters, and staff who review (M05: approve_documents or approve_listings). */
export const canSeeReviews = (u: { isMaster: boolean; permissions: readonly string[] }) => u.isMaster || u.permissions.some((p) => p === "approve_documents" || p === "approve_listings");

/**
 * A duration in minutes as days, hours and minutes, largest two parts only ("1 d 4 h", "2 h 5 min",
 * "45 min"); null stays null. The words come from the caller (EN or BN).
 */
export function formatDuration(minutes: number | null | undefined, word: (unit: "d" | "h" | "m", n: number) => string): string | null {
  if (minutes == null) return null;
  const total = Math.max(0, Math.round(minutes));
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  const parts: string[] = [];
  if (d) parts.push(word("d", d));
  if (h) parts.push(word("h", h));
  if (m || !parts.length) parts.push(word("m", m));
  return parts.slice(0, 2).join(" ");
}

/** The weekday of today a week ago (for "vs last Wednesday"), from a Dhaka day "2026-11-25". */
export function weekdayName(day: string, locale = "en"): string {
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

/** The per-day answer as chart series: approved, changes asked and rejected, oldest day first. */
export function decisionSeries(perDay: ReviewFigures["perDay"]) {
  return {
    days: perDay.map((d) => d.day),
    approved: perDay.map((d) => d.approved),
    changes: perDay.map((d) => d.changesRequested),
    rejected: perDay.map((d) => d.rejected),
  };
}
