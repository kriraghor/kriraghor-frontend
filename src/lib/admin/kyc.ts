import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { unwrap } from "./finance";

/**
 * KYC desk client (M02 lite, until M05): the NID review queue, the review panel, the audited file
 * viewer and NID reveal, and decisions. Files are fetched only when a reviewer asks to see one, so
 * each audited view is a real look.
 */
export type QueueRow = components["schemas"]["KycQueue"]["items"][number];
export type Review = components["schemas"]["KycReview"];
export type Reveal = components["schemas"]["KycNidReveal"];
export type DocStatus = QueueRow["status"];
export type Decision = "approve" | "changes_requested" | "reject";

export const QUEUE_STATUSES = ["in_review", "changes_requested", "approved", "rejected"] as const satisfies readonly DocStatus[];
export const REASONS = ["blurry", "name_mismatch", "not_nid", "under_age", "duplicate_nid", "other"] as const;
export type Reason = (typeof REASONS)[number];
export const RUBRIC = ["nameMatches", "readable", "notExpired"] as const;
export type Rubric = Record<(typeof RUBRIC)[number], boolean>;

/** Approve needs every rubric tick and no failed blocking check; the others need a reason (server re-checks). */
export function decisionProblem(decision: Decision, { rubric, reason, blockingFailed }: { rubric: Rubric; reason: Reason | ""; blockingFailed: boolean }): "rubric" | "checks" | "reason" | null {
  if (decision === "approve") {
    if (!RUBRIC.every((k) => rubric[k])) return "rubric";
    return blockingFailed ? "checks" : null;
  }
  return reason ? null : "reason";
}

const doc = (id: string) => ({ path: { id } });

export const kyc = {
  queue: async (status: DocStatus) => unwrap(await api("admin").GET("/admin/kyc/documents", { params: { query: { status } } })),
  get: async (id: string) => unwrap(await api("admin").GET("/admin/kyc/documents/{id}", { params: doc(id) })),
  /** One file as a Blob (audited on the server). */
  file: async (id: string, fileId: string) => {
    const res = await api("admin").GET("/admin/kyc/documents/{id}/files/{fileId}", { params: { path: { id, fileId } }, parseAs: "blob" });
    return unwrap(res) as unknown as Blob;
  },
  reveal: async (id: string, reason: string) => unwrap(await api("admin").POST("/admin/kyc/documents/{id}/reveal-nid", { params: doc(id), body: { reason } })),
  decide: async (id: string, body: { decision: Decision; rubric?: Rubric; reasonCode?: Reason; note?: string }) =>
    unwrap(await api("admin").POST("/admin/kyc/documents/{id}/decide", { params: doc(id), body })),
};
