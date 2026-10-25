import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { sharedReports, sharedReviews, type ReviewableItem, type ReviewSubject } from "@kriraghor/ui/trust/reviews";
import { gymHref } from "./links";

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
// The public reviews, rating and reporting are shared with gym.kriraghor.com (@kriraghor/ui/trust).
export {
  ratingSummary,
  rateErrorKey,
  reviewedGymFromOtherPass,
  subjectNameOf,
  REPORT_REASONS,
  REVIEW_SUBJECTS,
  SUBJECT_OF,
  type PublicReviews,
  type RateError,
  type ReportReason,
  type Review,
  type ReviewableItem,
  type ReviewResult,
  type ReviewSource,
  type ReviewSubject,
  type SubjectType,
} from "@kriraghor/ui/trust/reviews";

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
  ...sharedReviews,
  forGround: async (groundId: string) => ok(await api().GET("/grounds/{id}/reviews", { params: { path: { id: groundId }, query: {} } })),
  post: async (body: { bookingId: string; stars: number; text?: string }) => ok(await api().POST("/reviews", { body })),
  /** The published reviews of what I own (the pro desk: subjectType hire_profile), to reply to (FR-34). */
  owned: async (subjectType: ReviewSubject, cursor?: string) => ok(await api().GET("/me/reviews", { params: { query: { role: "owner", subjectType, ...(cursor ? { cursor } : {}) } } })),
  reply: async (id: string, text: string) => ok(await api().POST("/me/reviews/{id}/reply", { params: { path: { id } }, body: { text } })),
};

/** The public page of a review's subject (null without a slug). Gyms live on gym.kriraghor.com (through /go/gym). */
export function subjectHref(subjectType: ReviewSubject, slug: string | null | undefined): string | null {
  if (!slug) return null;
  const s = encodeURIComponent(slug);
  return { ground: `/venues/${s}`, hire_profile: `/hiring/${s}`, shop: `/shop/s/${s}`, gym: gymHref(`/gyms/${s}`) }[subjectType];
}

/**
 * Where a waiting item's source opens in the member's account. A hire job's code is its request's
 * code plus "-n", and a shop sub-order's is the order's code plus "-A", so the parent page is the
 * code without its last part. Gym passes open on gym.kriraghor.com (through /go/gym).
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
      return gymHref(`/me/passes/${encodeURIComponent(item.ref)}`);
  }
}

/** Replying as the owner: the codes with their own message. */
const REPLY_ERRORS = ["REPLY_HAS_CONTACT", "NOT_OWNER", "REVIEW_STATE", "VALIDATION_FAILED"] as const;
export type ReplyError = (typeof REPLY_ERRORS)[number] | "failed";
export const replyErrorKey = (code: string | null | undefined): ReplyError => ((REPLY_ERRORS as readonly string[]).includes(code ?? "") ? (code as ReplyError) : "failed");

/** A reply is 2 to 1,000 characters after trimming (the API's rule). */
export const replyOk = (text: string) => text.trim().length >= 2 && text.trim().length <= 1000;

export const reports = {
  ...sharedReports,
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

/** Statuses where the case is still open. */
export const ACTIVE_CASE = new Set(["awaiting_response", "under_review", "escalated"]);
