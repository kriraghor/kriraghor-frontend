import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "./finance";

/**
 * M17 desks on admin.kriraghor.com: disputes (queue, claim, both sides, decide within the staff limit,
 * escalate; masters decide escalated cases with step-up refund.large), reports grouped by subject, and
 * reviews waiting for a check or hidden.
 */
export type StaffCase = components["schemas"]["StaffDispute"];
export type CaseRow = components["schemas"]["StaffDisputeList"]["items"][number];
export type Outcome = "all" | "half" | "none" | "custom" | "upheld" | "rejected" | "corrected";
export type ReportRow = components["schemas"]["ReportQueue"]["items"][number];
export type ReportSubject = components["schemas"]["ReportSubject"];
export type StaffReview = components["schemas"]["ReviewList"]["items"][number];
export type ReportAction = "no_violation" | "content_removed" | "owner_warned" | "user_suspended" | "converted_to_dispute";
type SubjectType = "ground" | "booking" | "user" | "review" | "esports_tournament";

const key = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const a = () => api("admin");

export const disputesAdmin = {
  list: async (query: { status?: string; sourceType?: string; mine?: boolean; code?: string }) =>
    unwrap(
      await a().GET("/admin/disputes", {
        params: { query: { status: (query.status || "active") as never, ...(query.sourceType ? { sourceType: query.sourceType as never } : {}), ...(query.mine ? { mine: "true" as const } : {}), ...(query.code ? { code: query.code } : {}), limit: 100 } },
      }),
    ),
  get: async (code: string) => unwrap(await a().GET("/admin/disputes/{code}", { params: { path: { code } } })),
  claim: async (code: string) => unwrap(await a().POST("/admin/disputes/{code}/claim", { params: { path: { code } } })),
  heartbeat: async (code: string) => unwrap(await a().POST("/admin/disputes/{code}/heartbeat", { params: { path: { code } } })),
  release: async (code: string) => unwrap(await a().POST("/admin/disputes/{code}/release", { params: { path: { code } } })),
  note: async (code: string, text: string) => unwrap(await a().POST("/admin/disputes/{code}/notes", { params: { path: { code } }, body: { text } })),
  hide: async (code: string, eid: string, reason: string) => unwrap(await a().POST("/admin/disputes/{code}/evidence/{eid}/hide", { params: { path: { code, eid } }, body: { reason } })),
  decide: async (code: string, body: { outcome: Outcome; refund?: number; reason: string; version: number }) =>
    unwrap(await a().POST("/admin/disputes/{code}/decide", { params: { path: { code }, header: { "idempotency-key": key() } }, body })),
  escalate: async (code: string, body: { outcome?: Outcome; refund?: number; note: string; version: number }) => unwrap(await a().POST("/admin/disputes/{code}/escalate", { params: { path: { code } }, body })),
  masterDecide: async (code: string, body: { outcome: Outcome; refund?: number; reason: string; version: number }, stepUpToken: string) =>
    unwrap(await a().POST("/admin/disputes/{code}/master-decide", { params: { path: { code }, header: { "x-step-up": stepUpToken, "idempotency-key": key() } }, body })),
  sendBack: async (code: string, note: string) => unwrap(await a().POST("/admin/disputes/{code}/send-back", { params: { path: { code } }, body: { note } })),
  /** Opens a file of the case in a new tab (the API needs the bearer token, so no plain link). */
  openFile: async (code: string, eid: string) => {
    const res = await a().GET("/admin/disputes/{code}/evidence/{eid}/file", { params: { path: { code, eid } }, parseAs: "blob" });
    if (res.error || !res.data) throw res.error;
    window.open(URL.createObjectURL(res.data as Blob), "_blank", "noopener");
  },
};

export const reportsAdmin = {
  list: async (status: "open" | "escalated" = "open") => unwrap(await a().GET("/admin/reports", { params: { query: { status, limit: 100 } } })),
  subject: async (type: SubjectType, id: string) => unwrap(await a().GET("/admin/reports/subjects/{type}/{id}", { params: { path: { type, id } } })),
  resolve: async (body: { subjectType: SubjectType; subjectId: string; action: ReportAction; note: string }) => unwrap(await a().POST("/admin/reports/resolve", { body })),
  escalate: async (body: { subjectType: SubjectType; subjectId: string; note: string }) => unwrap(await a().POST("/admin/reports/escalate", { body })),
  dismiss: async (code: string, note: string) => unwrap(await a().POST("/admin/reports/{code}/dismiss", { params: { path: { code } }, body: { note } })),
};

export const reviewsAdmin = {
  list: async (status: "held" | "hidden" | "published") => unwrap(await a().GET("/admin/reviews", { params: { query: { status, limit: 100 } } })),
  hide: async (id: string, reason: string) => unwrap(await a().POST("/admin/reviews/{id}/hide", { params: { path: { id } }, body: { reason } })),
  restore: async (id: string) => unwrap(await a().POST("/admin/reviews/{id}/restore", { params: { path: { id } } })),
  publish: async (id: string) => unwrap(await a().POST("/admin/reviews/{id}/publish", { params: { path: { id } } })),
};

/** Taka input ("250", "237.50") → poisha, or null when it is not a valid amount. */
export function takaToPoisha(input: string): number | null {
  const s = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}
