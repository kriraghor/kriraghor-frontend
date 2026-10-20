import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { newKey, unwrap } from "./finance";

/**
 * Payouts client (M07 §4.3 on the Finance desk): payouts, runs and payout-account review. Release,
 * retry, approve and reveal need a fresh authenticator code (step-up payout.approve).
 */
export type Payout = components["schemas"]["Payout"];
export type PayoutDetail = components["schemas"]["PayoutDetail"];
export type PayoutStatus = Payout["status"];
export type Reveal = components["schemas"]["PayoutReveal"];
export type ReviewRow = components["schemas"]["PayoutAccountReviewPage"]["items"][number];
export type Batch = components["schemas"]["PayoutBatch"];

export const PAYOUT_STATUSES = ["scheduled", "needs_approval", "on_hold", "processing", "failed", "paid", "cancelled"] as const satisfies readonly PayoutStatus[];
export const FAILURE_REASONS = ["invalid_wallet", "name_mismatch", "account_closed", "provider_error", "other"] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];

/** Which actions a payout offers, by status (the server re-checks every one). */
export function actionsFor(p: Pick<Payout, "status" | "kind">, { isMaster, canRelease }: { isMaster: boolean; canRelease: boolean }) {
  const out: Array<"release" | "approve" | "hold" | "reveal" | "markPaid" | "markFailed" | "retry" | "cancel"> = [];
  if (!canRelease) return out;
  if (p.status === "scheduled") out.push("release", "hold");
  if (p.status === "needs_approval") {
    if (isMaster) out.push("approve");
    out.push("hold");
  }
  if (p.status === "processing") out.push("reveal", "markPaid", "markFailed");
  if (p.status === "failed") out.push("retry");
  if (p.kind !== "refund" && ["scheduled", "needs_approval", "on_hold", "failed"].includes(p.status)) out.push("cancel");
  return out;
}

const path = (id: string) => ({ path: { id } });

export const payouts = {
  list: async (query: { status?: PayoutStatus; cursor?: string }) => unwrap(await api("admin").GET("/admin/payouts", { params: { query } })),
  get: async (id: string) => unwrap(await api("admin").GET("/admin/payouts/{id}", { params: path(id) })),
  release: async (id: string, stepUpToken: string) =>
    unwrap(await api("admin").POST("/admin/payouts/{id}/release", { params: { ...path(id), header: { "idempotency-key": newKey(), "x-step-up": stepUpToken } } })),
  approve: async (id: string, stepUpToken: string) =>
    unwrap(await api("admin").POST("/admin/payouts/{id}/approve", { params: { ...path(id), header: { "idempotency-key": newKey(), "x-step-up": stepUpToken } } })),
  reveal: async (id: string, stepUpToken: string) => unwrap(await api("admin").POST("/admin/payouts/{id}/reveal", { params: { ...path(id), header: { "x-step-up": stepUpToken } } })),
  markPaid: async (id: string, body: { reference: string; note?: string }) =>
    unwrap(await api("admin").POST("/admin/payouts/{id}/mark-paid", { params: { ...path(id), header: { "idempotency-key": newKey() } }, body })),
  markFailed: async (id: string, body: { reason: FailureReason; note?: string }) => unwrap(await api("admin").POST("/admin/payouts/{id}/mark-failed", { params: path(id), body })),
  retry: async (id: string, stepUpToken: string) => unwrap(await api("admin").POST("/admin/payouts/{id}/retry", { params: { ...path(id), header: { "x-step-up": stepUpToken } } })),
  cancel: async (id: string, reason: string) => unwrap(await api("admin").POST("/admin/payouts/{id}/cancel", { params: path(id), body: { reason } })),
  hold: async (id: string, body: { reason: string; scope: "payout" | "payee" }) => unwrap(await api("admin").POST("/admin/payouts/{id}/hold", { params: path(id), body })),
  liftHold: async (id: string, body: { holdId: string; reason: string }) => unwrap(await api("admin").POST("/admin/payouts/{id}/lift-hold", { params: path(id), body })),
  batches: async () => unwrap(await api("admin").GET("/admin/payout-batches")),
  runNow: async (schedule: "daily" | "ground_weekly" | "shop_weekly") => unwrap(await api("admin").POST("/admin/payout-batches/run", { body: { schedule } })),
  accounts: async (status: ReviewRow["status"] = "pending_verification") => unwrap(await api("admin").GET("/admin/payout-accounts", { params: { query: { status } } })),
  verify: async (id: string, note?: string) => unwrap(await api("admin").POST("/admin/payout-accounts/{id}/verify", { params: path(id), body: { note } })),
  reject: async (id: string, note: string) => unwrap(await api("admin").POST("/admin/payout-accounts/{id}/reject", { params: path(id), body: { note } })),
};

/** Wallet number grouped for reading aloud and typing: 017 1234 5678. */
export const groupWallet = (n: string) => n.replace(/^(\d{3})(\d{4})(\d{4})$/, "$1 $2 $3");
