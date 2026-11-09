import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "./manage";

/**
 * The gym SMS add-on (M24 prompt 3b, M24-FR-96 to FR-100, §18). Built and switched off on the platform
 * until the SMS gateway is signed (G9): while off, the screens say "coming soon". The owner switches it on
 * (paid plans), buys bundles (an invoice paid at once), and chooses which reminders also go by SMS; each SMS
 * holds units that M08 settles. The API enforces every rule; these helpers only shape the screens.
 */
type S = components["schemas"];
export type SmsAddon = S["GymSmsAddon"];
export type SmsEntries = S["GymSmsEntries"];
export type SmsEntry = SmsEntries["items"][number];
/** The reminder kinds a gym may send by SMS (the API's reminders page lists them as `choosable`). */
export type SmsKind = "renewal_due" | "ends_today" | "overdue" | "receipt" | "pay_link";

const ik = (key: string) => ({ "idempotency-key": key });

export const gymSms = {
  setAddon: async (enabled: boolean) => unwrap(await api().PUT("/manage/billing/sms-addon", { body: { enabled } })),
  buyBundles: async (bundles: number, key: string) => unwrap(await api().POST("/manage/billing/sms-bundles", { params: { header: ik(key) }, body: { bundles } })),
  entries: async (limit = 30) => unwrap(await api().GET("/manage/billing/sms-entries", { params: { query: { limit } } })),
};

// ---------------- pure helpers (tested)

/** What the billing card shows: coming soon (the platform switch or the plan), off, or on. */
export function smsCardState(a: Pick<SmsAddon, "available" | "status">): "soon" | "off" | "on" {
  if (a.status === "active") return "on";
  return a.available ? "off" : "soon";
}

/** A bundle count kept between 1 and 20 (the API's limit), whole. */
export const clampBundles = (n: number) => Math.min(20, Math.max(1, Math.round(Number.isFinite(n) ? n : 1)));

/** The kinds after switching one on or off, in the order the page lists them. */
export function smsKindsAfter(current: string[], order: readonly string[], kind: string, on: boolean): string[] {
  const next = new Set(current);
  if (on) next.add(kind);
  else next.delete(kind);
  return order.filter((k) => next.has(k));
}

/** How full the balance is against the low mark: empty (cannot hold one message), low, or ok. */
export function smsBalanceTone(a: Pick<SmsAddon, "balance" | "lowBalance" | "reserveUnits">): "empty" | "low" | "ok" {
  if (a.balance < a.reserveUnits) return "empty";
  return a.balance < a.lowBalance ? "low" : "ok";
}
