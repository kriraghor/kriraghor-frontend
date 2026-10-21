import { api, problemOf, type Problem } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";

/**
 * Finance desk client (M06 §4 /admin/finance): payments, refunds, escrow, ledger and reconciliation.
 * The M07 payout tabs (payouts, batches, accounts) use lib/admin/payouts.
 * Every action re-checks permissions on the server; money moves need a fresh authenticator code.
 */
export type AdminPayment = components["schemas"]["AdminPayment"];
export type Refund = components["schemas"]["Refund"];
export type Hold = components["schemas"]["EscrowHold"];
export type Run = components["schemas"]["ReconciliationRun"];
export type Item = components["schemas"]["ReconciliationItem"];

/** Throws the RFC 7807 problem so CodeDialog and forms can show its title. */
export function unwrap<T>(res: { data?: T; error?: unknown }): T {
  if (res.error || res.data === undefined) throw problemOf(res.error) ?? ({ code: "UNKNOWN", title: "Something went wrong", status: 0 } satisfies Problem);
  return res.data;
}

const BN = "০১২৩৪৫৬৭৮৯";
/** Poisha → "৳1,23,456.50" (Indian grouping), Bangla digits for bn. */
export function formatTaka(poisha: number | null | undefined, locale = "en"): string {
  if (poisha === null || poisha === undefined) return "–";
  const abs = Math.abs(poisha);
  const taka = Math.trunc(abs / 100).toLocaleString("en-IN");
  const rest = abs % 100;
  const text = `${poisha < 0 ? "−" : ""}৳${taka}${rest ? `.${String(rest).padStart(2, "0")}` : ""}`;
  return locale === "bn" ? text.replace(/\d/g, (d) => BN[Number(d)]) : text;
}

/** "1,234.50" typed by a person → poisha, without float maths. null when it is not an amount. */
export function parseTaka(input: string): number | null {
  const m = /^\s*(\d{1,10})(?:\.(\d{1,2}))?\s*$/.exec(input.replace(/,/g, ""));
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

/** A fresh Idempotency-Key for one submit (a double click replays instead of paying twice). */
export const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Today in Dhaka as YYYY-MM-DD (the business day reconciliation uses). */
export function dhakaDate(now: number): string {
  return new Date(now + 6 * 3600 * 1000).toISOString().slice(0, 10);
}

export const TABS = ["payments", "refunds", "escrow", "payouts", "batches", "accounts", "ledger", "reconciliation", "test"] as const;
export type Tab = (typeof TABS)[number];
export const isTab = (v: string | null): v is Tab => Boolean(v) && (TABS as readonly string[]).includes(v as string);

export const finance = {
  config: async () => unwrap(await api("admin").GET("/admin/payments/config")),
  payments: async (query: { status?: AdminPayment["status"]; code?: string; cursor?: string }) => unwrap(await api("admin").GET("/admin/payments", { params: { query } })),
  payment: async (id: string) => unwrap(await api("admin").GET("/admin/payments/{id}", { params: { path: { id } } })),
  refunds: async (query: { status?: Refund["status"]; cursor?: string }) => unwrap(await api("admin").GET("/admin/refunds", { params: { query } })),
  createRefund: async (body: { paymentId: string; amount: number; reasonCode: string; reasonText?: string; goodwill?: boolean }, stepUpToken?: string) =>
    unwrap(await api("admin").POST("/admin/refunds", { params: { header: { "idempotency-key": newKey(), ...(stepUpToken ? { "x-step-up": stepUpToken } : {}) } }, body })),
  decideRefund: async (id: string, action: "approve" | "reject", note: string | undefined, stepUpToken: string) =>
    action === "approve"
      ? unwrap(await api("admin").POST("/admin/refunds/{id}/approve", { params: { path: { id }, header: { "x-step-up": stepUpToken } }, body: { note } }))
      : unwrap(await api("admin").POST("/admin/refunds/{id}/reject", { params: { path: { id }, header: { "x-step-up": stepUpToken } }, body: { note: note ?? "" } })),
  holds: async (query: { status?: Hold["status"]; cursor?: string }) => unwrap(await api("admin").GET("/admin/escrow", { params: { query } })),
  release: async (id: string, body: { amount?: number; reason: string }, stepUpToken: string) =>
    unwrap(await api("admin").POST("/admin/escrow/{id}/release", { params: { path: { id }, header: { "x-step-up": stepUpToken } }, body })),
  freeze: async (id: string, action: "freeze" | "unfreeze", reason: string, stepUpToken: string) =>
    action === "freeze"
      ? unwrap(await api("admin").POST("/admin/escrow/{id}/freeze", { params: { path: { id }, header: { "x-step-up": stepUpToken } }, body: { reason } }))
      : unwrap(await api("admin").POST("/admin/escrow/{id}/unfreeze", { params: { path: { id }, header: { "x-step-up": stepUpToken } }, body: { reason } })),
  accounts: async (code?: string) => unwrap(await api("admin").GET("/admin/ledger/accounts", { params: { query: { code: code || undefined, limit: 100 } } })),
  /** An account's postings; `cursor` is the previous page's nextCursor (the API takes it as a number). */
  entries: async (id: string, cursor?: string) =>
    unwrap(await api("admin").GET("/admin/ledger/accounts/{id}/entries", { params: { path: { id }, query: { limit: 100, cursor: cursor ? Number(cursor) : undefined } } })),
  trialBalance: async () => unwrap(await api("admin").GET("/admin/ledger/trial-balance")),
  invariants: async () => unwrap(await api("admin").GET("/admin/ledger/invariants")),
  runs: async () => unwrap(await api("admin").GET("/admin/reconciliation/runs")),
  runDay: async (businessDate: string) => unwrap(await api("admin").POST("/admin/reconciliation/runs", { body: { businessDate } })),
  items: async (id: string, open: boolean) => unwrap(await api("admin").GET("/admin/reconciliation/runs/{id}/items", { params: { path: { id }, query: { open: open ? "true" : undefined } } })),
  resolve: async (id: string, body: { resolution: "resolved" | "ignored"; note: string }) => unwrap(await api("admin").POST("/admin/reconciliation/items/{id}/resolve", { params: { path: { id } }, body })),
  findUser: async (q: string) => unwrap(await api("admin").GET("/admin/users", { params: { query: { q, limit: 5 } } })),
  testCharge: async (body: { payerId: string; payeeId: string; amount: number; title?: string }) =>
    unwrap(await api("admin").POST("/admin/payments/test-charges", { params: { header: { "idempotency-key": newKey() } }, body })),
};
