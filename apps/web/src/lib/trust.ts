import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";

/**
 * M17 on kriraghor.com: disputes (the member who paid opens one from the booking; the case page shows
 * both sides, statements and files), reviews (rate a ground after playing; public reviews on the
 * ground page) and reports (report a ground, a review or a member). Since Round B1 reviews cover pros
 * (hire jobs), shops (sub-orders) and gyms (passes) too: one public block, one rating dialog, and the
 * owner's reply from the pro desk or the business panel.
 */
export type PartyCase = components["schemas"]["PartyDispute"];
export type Case = components["schemas"]["Dispute"];
export type Evidence = components["schemas"]["DisputeEvidence"];
export type DisputeOption = components["schemas"]["DisputeOptions"]["items"][number];
export type Category = "no_show_contest" | "venue_problem" | "cash_problem";
export type Review = components["schemas"]["Review"];
export type PublicReviews = components["schemas"]["PublicReviews"];
export type SubjectType = "ground" | "booking" | "user" | "review" | "esports_tournament" | "shop" | "product";
export type ReportReason = "fake_listing" | "wrong_info" | "unsafe" | "harassment" | "fraud" | "spam" | "offensive" | "cheating" | "other";

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}

export const disputes = {
  options: async (bookingId: string) => ok(await api().GET("/me/disputes/options", { params: { query: { sourceType: "booking", sourceId: bookingId } } })),
  open: async (body: { sourceId: string; category: Category; statement: string }, key: string) =>
    ok(await api().POST("/disputes", { params: { header: { "idempotency-key": key } }, body: { sourceType: "booking", ...body } })),
  mine: async (role: "claimant" | "respondent" = "claimant") => ok(await api().GET("/me/disputes", { params: { query: { role } } })),
  get: async (code: string) => ok(await api().GET("/me/disputes/{code}", { params: { path: { code } } })),
  statement: async (code: string, text: string) => ok(await api().POST("/me/disputes/{code}/statement", { params: { path: { code } }, body: { text } })),
  respond: async (code: string, text: string) => ok(await api().POST("/me/disputes/{code}/respond", { params: { path: { code } }, body: { text } })),
  withdraw: async (code: string, reason?: string) => ok(await api().POST("/me/disputes/{code}/withdraw", { params: { path: { code } }, body: reason ? { reason } : {} })),
  /** Sends the file itself as the body (the API checks its first bytes). */
  upload: async (code: string, file: File) =>
    ok(
      await api().POST("/me/disputes/{code}/evidence", {
        params: { path: { code } },
        body: file as unknown as string,
        bodySerializer: (b: unknown) => b as BodyInit,
        headers: { "Content-Type": file.type },
      }),
    ),
  /** Opens a file of the case in a new tab (the API needs the bearer token, so no plain link). */
  openFile: async (code: string, eid: string) => {
    const res = await api().GET("/me/disputes/{code}/evidence/{eid}/file", { params: { path: { code, eid } }, parseAs: "blob" });
    if (res.error || !res.data) throw res.error;
    window.open(URL.createObjectURL(res.data as Blob), "_blank", "noopener");
  },
};

export const reviews = {
  forGround: async (groundId: string) => ok(await api().GET("/grounds/{id}/reviews", { params: { path: { id: groundId }, query: {} } })),
  /** Public: published reviews of a venue, pro profile, shop or gym, with the summary (FR-35). */
  forSubject: async (subjectType: ReviewSubject, subjectId: string, cursor?: string) =>
    ok(await api().GET("/reviews", { params: { query: { subjectType, subjectId, ...(cursor ? { cursor } : {}) } } })),
  reviewable: async () => ok(await api().GET("/me/reviewable")),
  post: async (body: { bookingId: string; stars: number; text?: string }) => ok(await api().POST("/reviews", { body })),
  /** Rate a source (FR-30 to FR-33). A gym answers 200 with `updated: true` when a newer pass updated my review. */
  rate: async (body: { sourceType: ReviewSource; sourceId: string; stars: number; text?: string }, key: string) =>
    ok(await api().POST("/reviews", { body, headers: { "Idempotency-Key": key } })) as Promise<ReviewResult & { updated?: boolean }>,
  mine: async () => ok(await api().GET("/me/reviews")),
  /** The published reviews of what I own (the pro desk: subjectType hire_profile), to reply to (FR-34). */
  owned: async (subjectType: ReviewSubject, cursor?: string) => ok(await api().GET("/me/reviews", { params: { query: { role: "owner", subjectType, ...(cursor ? { cursor } : {}) } } })),
  reply: async (id: string, text: string) => ok(await api().POST("/me/reviews/{id}/reply", { params: { path: { id } }, body: { text } })),
};

export type ReviewSubject = "ground" | "hire_profile" | "shop" | "gym";
export type ReviewSource = "booking" | "hire_job" | "sub_order" | "gym_pass";
export type ReviewResult = components["schemas"]["ReviewResult"];
export type ReviewableItem = components["schemas"]["Reviewable"]["items"][number];
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

/** The public page of a review's subject (null without a slug). */
export function subjectHref(subjectType: ReviewSubject, slug: string | null | undefined): string | null {
  if (!slug) return null;
  const s = encodeURIComponent(slug);
  return { ground: `/venues/${s}`, hire_profile: `/hiring/${s}`, shop: `/shop/s/${s}`, gym: `/gym/gyms/${s}` }[subjectType];
}

/**
 * Where a waiting item's source opens in the member's account. A hire job's code is its request's
 * code plus "-n", and a shop sub-order's is the order's code plus "-A", so the parent page is the
 * code without its last part.
 */
export function sourceHref(item: Pick<ReviewableItem, "sourceType" | "sourceId" | "ref" | "bookingId">): string {
  const parent = item.ref.includes("-") ? item.ref.slice(0, item.ref.lastIndexOf("-")) : item.ref;
  switch (item.sourceType) {
    case "booking":
      return `/me/bookings/${encodeURIComponent(item.bookingId ?? item.sourceId)}`;
    case "hire_job":
      return `/me/hire/${encodeURIComponent(parent)}`;
    case "sub_order":
      return `/me/orders/${encodeURIComponent(parent)}`;
    case "gym_pass":
      return `/me/passes/${encodeURIComponent(item.ref)}`;
  }
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

/** Replying as the owner: the codes with their own message. */
const REPLY_ERRORS = ["REPLY_HAS_CONTACT", "NOT_OWNER", "REVIEW_STATE", "VALIDATION_FAILED"] as const;
export type ReplyError = (typeof REPLY_ERRORS)[number] | "failed";
export const replyErrorKey = (code: string | null | undefined): ReplyError => ((REPLY_ERRORS as readonly string[]).includes(code ?? "") ? (code as ReplyError) : "failed");

/** A reply is 2 to 1,000 characters after trimming (the API's rule). */
export const replyOk = (text: string) => text.trim().length >= 2 && text.trim().length <= 1000;

/**
 * The gym rule (M20-FR-10): one review per member and gym, so a newer pass updates it. True when I
 * already reviewed this gym from another pass.
 */
export function reviewedGymFromOtherPass(mine: { subjectType: string; subjectId: string; sourceType?: string; sourceId?: string }[] | undefined, gymId: string | null | undefined, passId: string): boolean {
  if (!mine || !gymId) return false;
  return mine.some((r) => r.subjectType === "gym" && r.subjectId === gymId && r.sourceId !== passId);
}

export const reports = {
  file: async (body: { subjectType: SubjectType; subjectId: string; reasonCode: ReportReason; note?: string }) => ok(await api().POST("/reports", { body })),
  mine: async () => ok(await api().GET("/me/reports")),
};

/** M18: my reliability, and M02 documents our team asked me for. */
export const risk = {
  myTrust: async () => ok(await api().GET("/me/trust")),
  documentRequests: async () => ok(await api().GET("/me/document-requests")),
};

/**
 * Client-side type check before uploading. The server re-checks the file's bytes and its size
 * (disputes.evidence_max_bytes, a platform setting), answering FILE_TYPE or FILE_TOO_LARGE.
 */
export const EVIDENCE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const evidenceTypeOk = (file: File) => EVIDENCE_TYPES.includes(file.type);

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

/** Statuses where the case is still open. */
export const ACTIVE_CASE = new Set(["awaiting_response", "under_review", "escalated"]);
