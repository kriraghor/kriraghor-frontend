import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

/**
 * M17 on kriraghor.com: disputes (the member who paid opens one from the booking; the case page shows
 * both sides, statements and files), reviews (rate a ground after playing; public reviews on the
 * ground page) and reports (report a ground, a review or a member).
 */
export type PartyCase = components["schemas"]["PartyDispute"];
export type Case = components["schemas"]["Dispute"];
export type Evidence = components["schemas"]["DisputeEvidence"];
export type DisputeOption = components["schemas"]["DisputeOptions"]["items"][number];
export type Category = "no_show_contest" | "venue_problem" | "cash_problem";
export type Review = components["schemas"]["Review"];
export type PublicReviews = components["schemas"]["PublicReviews"];
export type SubjectType = "ground" | "booking" | "user" | "review" | "esports_tournament";
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
  reviewable: async () => ok(await api().GET("/me/reviewable")),
  post: async (body: { bookingId: string; stars: number; text?: string }) => ok(await api().POST("/reviews", { body })),
  mine: async () => ok(await api().GET("/me/reviews")),
};

export const reports = {
  file: async (body: { subjectType: SubjectType; subjectId: string; reasonCode: ReportReason; note?: string }) => ok(await api().POST("/reports", { body })),
  mine: async () => ok(await api().GET("/me/reports")),
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
};

/** Statuses where the case is still open. */
export const ACTIVE_CASE = new Set(["awaiting_response", "under_review", "escalated"]);
