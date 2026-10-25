import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";

/**
 * Payer side of M06: the pay page, the result page and "My payments". Success is decided by the
 * server after it asks the gateway (FR-03); these pages only read GET /payments/:id.
 */
export type PayerPayment = components["schemas"]["PayerPayment"];
export type Payment = components["schemas"]["Payment"];
export type Method = "bkash" | "nagad" | "card";

export async function getPayment(id: string): Promise<PayerPayment> {
  const res = await api().GET("/payments/{id}", { params: { path: { id } } });
  if (res.error || !res.data) throw res.error;
  return res.data;
}

/** Starts a gateway attempt. A new Idempotency-Key per click: a retry of the same click replays. */
export async function startAttempt(id: string, method: Method, key: string) {
  const res = await api().POST("/payments/{id}/attempts", { params: { path: { id }, header: { "idempotency-key": key } }, body: { method } });
  if (res.error || !res.data) throw res.error;
  return res.data;
}

/** Asks the server to check with the gateway now; returns what the server decided. */
export async function verifyPayment(id: string): Promise<PayerPayment> {
  const res = await api().POST("/payments/{id}/verify", { params: { path: { id } } });
  if (res.error || !res.data) throw res.error;
  return res.data;
}

export async function listMyPayments(cursor?: string) {
  const res = await api().GET("/me/payments", { params: { query: { cursor, limit: 20 } } });
  if (res.error || !res.data) throw res.error;
  return res.data;
}

/** Poisha → "৳1,23,456.50" (Indian grouping), Bangla digits for bn: the shared rule (@kriraghor/ui/format). */
export { formatTaka } from "@kriraghor/ui/format";

/** What the result page shows for a payment status. */
export type Outcome = "paid" | "waiting" | "failed" | "expired";
export function outcomeOf(status: Payment["status"]): Outcome {
  if (status === "succeeded" || status === "partially_refunded" || status === "refunded") return "paid";
  if (status === "initiated" || status === "pending") return "waiting";
  if (status === "expired" || status === "cancelled") return "expired";
  return "failed";
}

/** "9:41" until a deadline (never negative). */
export function countdown(deadline: string, now: number): string {
  const s = Math.max(0, Math.floor((new Date(deadline).getTime() - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Polling plan for the result page: every 2 s for up to 60 s (M06 §4). */
export const POLL_MS = 2000;
export const POLL_LIMIT_MS = 60000;
