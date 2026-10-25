import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";

/**
 * Payee side of M07, shared by kriraghor.com (/me/payouts) and the business panel
 * (vendor.kriraghor.com/vendor/payouts): the payout account (bKash or Nagad in the NID name,
 * confirmed with a code to the registered phone, checked by Kriraghor) and my payouts with a CSV
 * statement per payout. The customer session (audience "api") in both apps. Account numbers are
 * only ever shown masked ("bKash ••• 4321").
 */
export type PayoutAccount = components["schemas"]["PayoutAccount"];
export type PayoutSummary = components["schemas"]["PayoutSummary"];
export type MyPayout = components["schemas"]["MyPayoutPage"]["items"][number];
export type MyPayoutDetail = components["schemas"]["MyPayoutDetail"];
export type Wallet = "bkash" | "nagad";

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}

export const listAccounts = async () => ok(await api().GET("/me/payout-accounts"));
export const sendAccountCode = async () => ok(await api().POST("/me/payout-accounts/otp"));
export const addAccount = async (body: { type: Wallet; accountNo: string; accountName: string; code: string }) => ok(await api().POST("/me/payout-accounts", { body }));
export const getSummary = async () => ok(await api().GET("/me/payouts/summary"));
export const listPayouts = async (cursor?: string) => ok(await api().GET("/me/payouts", { params: { query: { cursor, limit: 20 } } }));
export const getPayout = async (id: string) => ok(await api().GET("/me/payouts/{id}", { params: { path: { id } } }));

/** Downloads the CSV statement for one payout (the API needs the bearer token, so no plain link). */
export async function downloadStatement(id: string, code: string, locale: "en" | "bn") {
  const res = await api().GET("/me/payouts/{id}/statement.csv", { params: { path: { id }, query: { locale } }, parseAs: "blob" });
  if (res.error || !res.data) throw res.error;
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${code}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------- pure helpers (tested)

/** A Bangladeshi mobile wallet number (01XXXXXXXXX, +880 accepted): the same rule as the server. */
export function isWalletNumber(input: string): boolean {
  const local = input.replace(/[\s-]/g, "").replace(/^\+?880/, "0");
  return /^01[3-9]\d{8}$/.test(local);
}

/** How a payout status reads to the payee. */
export type PayoutTone = "ok" | "waiting" | "bad" | "muted";
export function toneOf(status: MyPayout["status"]): PayoutTone {
  if (status === "paid") return "ok";
  if (status === "failed" || status === "on_hold") return "bad";
  if (status === "cancelled") return "muted";
  return "waiting";
}

/** Where the payee's account stands: none yet, one being checked, or a verified one (null). */
export function accountGap(sum: { account: unknown; pendingAccount: unknown } | undefined): "missing" | "pending" | null {
  if (!sum || sum.account) return null;
  return sum.pendingAccount ? "pending" : "missing";
}

/** The next payout: what the next run will send plus what is already in a payout on its way. */
export const nextPayoutAmount = (sum: Pick<PayoutSummary, "nextPayout" | "inPayouts">) => sum.nextPayout.projected + sum.inPayouts;

/** Poisha → "৳1,23,456.50" (Indian grouping), Bangla digits for bn. Same rule as the backend. */
export { formatTaka } from "../format";
