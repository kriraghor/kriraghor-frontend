import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";

/**
 * Reviews and reports (M17) shared by kriraghor.com and gym.kriraghor.com: the public reviews of a
 * subject (FR-35), rating a source I paid for (FR-30 to FR-33), my waiting items and my reviews, and
 * reporting a review or a listing (FR-15). The pure helpers below are unit-tested. kriraghor.com adds
 * its own calls (disputes, owner replies) in its lib/trust.
 */
export type Review = components["schemas"]["Review"];
export type PublicReviews = components["schemas"]["PublicReviews"];
export type ReviewSubject = "ground" | "hire_profile" | "shop" | "gym";
export type ReviewSource = "booking" | "hire_job" | "sub_order" | "gym_pass";
export type ReviewResult = components["schemas"]["ReviewResult"];
export type ReviewableItem = components["schemas"]["Reviewable"]["items"][number];
export type SubjectType = "ground" | "booking" | "user" | "review" | "esports_tournament" | "shop" | "product";
export type ReportReason = "fake_listing" | "wrong_info" | "unsafe" | "harassment" | "fraud" | "spam" | "offensive" | "cheating" | "other";

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}

export const sharedReviews = {
  /** Public: published reviews of a venue, pro profile, shop or gym, with the summary (FR-35). */
  forSubject: async (subjectType: ReviewSubject, subjectId: string, cursor?: string) =>
    ok(await api().GET("/reviews", { params: { query: { subjectType, subjectId, ...(cursor ? { cursor } : {}) } } })),
  reviewable: async () => ok(await api().GET("/me/reviewable")),
  /** Rate a source (FR-30 to FR-33). A gym answers 200 with `updated: true` when a newer pass updated my review. */
  rate: async (body: { sourceType: ReviewSource; sourceId: string; stars: number; text?: string }, key: string) =>
    ok(await api().POST("/reviews", { body, headers: { "Idempotency-Key": key } })) as Promise<ReviewResult & { updated?: boolean }>,
  mine: async () => ok(await api().GET("/me/reviews")),
};

export const sharedReports = {
  file: async (body: { subjectType: SubjectType; subjectId: string; reasonCode: ReportReason; note?: string }) => ok(await api().POST("/reports", { body })),
};

export const REVIEW_SUBJECTS: ReviewSubject[] = ["ground", "hire_profile", "shop", "gym"];
export const SUBJECT_OF: Record<ReviewSource, ReviewSubject> = { booking: "ground", hire_job: "hire_profile", sub_order: "shop", gym_pass: "gym" };

/**
 * What the summary block shows: the average only when the API gives one (it is null until
 * reviews.min_count_display reviews exist, a platform setting we never repeat here), the count, and
 * each star's share of the reviews (5 stars first) as a whole percentage.
 */
export function ratingSummary(summary: { avg: number | null; count: number; histogram?: number[] } | null | undefined) {
  const count = summary?.count ?? 0;
  const avg = summary?.avg ?? null;
  const histogram = summary?.histogram ?? [];
  const spread = [5, 4, 3, 2, 1].map((stars) => {
    const n = histogram[stars - 1] ?? 0;
    return { stars, n, pct: count ? Math.round((n / count) * 100) : 0 };
  });
  return { avg, count, showAvg: avg !== null, spread };
}

/** The subject's name: the API's subjectName when it sends one (or the v1 groundName), else null. */
export function subjectNameOf(item: object): string | null {
  const r = item as { subjectName?: unknown; groundName?: unknown };
  const n = typeof r.subjectName === "string" ? r.subjectName : typeof r.groundName === "string" ? r.groundName : null;
  return n && n.trim() ? n : null;
}

/** Posting a rating: the error codes we explain in our own words (anything else falls back to "failed"). */
const RATE_ERRORS = [
  "NOT_YOUR_BOOKING",
  "NOT_YOUR_JOB",
  "NOT_YOUR_ORDER",
  "NOT_YOUR_PASS",
  "NOT_PLAYED",
  "JOB_NOT_RELEASED",
  "ORDER_NOT_COMPLETED",
  "PASS_NOT_REDEEMED",
  "REVIEW_WINDOW_CLOSED",
  "REVIEW_EXISTS",
  "REVIEW_HIDDEN",
] as const;
export type RateError = (typeof RATE_ERRORS)[number] | "failed";
export const rateErrorKey = (code: string | null | undefined): RateError => ((RATE_ERRORS as readonly string[]).includes(code ?? "") ? (code as RateError) : "failed");

/**
 * The gym rule (M20-FR-10): one review per member and gym, so a newer pass updates it. True when I
 * already reviewed this gym from another pass.
 */
export function reviewedGymFromOtherPass(mine: { subjectType: string; subjectId: string; sourceType?: string; sourceId?: string }[] | undefined, gymId: string | null | undefined, passId: string): boolean {
  if (!mine || !gymId) return false;
  return mine.some((r) => r.subjectType === "gym" && r.subjectId === gymId && r.sourceId !== passId);
}

/** The reasons a member can pick for each kind of subject. */
export const REPORT_REASONS: Record<SubjectType, ReportReason[]> = {
  ground: ["fake_listing", "wrong_info", "unsafe", "fraud", "other"],
  booking: ["fraud", "harassment", "other"],
  user: ["harassment", "fraud", "spam", "other"],
  review: ["offensive", "spam", "fake_listing", "other"],
  esports_tournament: ["cheating", "wrong_info", "fraud", "other"],
  shop: ["fake_listing", "fraud", "wrong_info", "other"],
  product: ["fake_listing", "wrong_info", "fraud", "offensive", "other"],
};
