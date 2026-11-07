import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "./manage";
import { webHref } from "./links";
import type { FeePayment } from "./gym-manage";

/**
 * M24 prompt 2 · Online money, reminders and billing (gym.kriraghor.com). Payment links and online
 * refunds (M24-FR-40 to FR-46), paying a link or a due (FR-41), the reminders page (FR-55 to FR-61),
 * reports and exports (FR-70 to FR-74), the owner's invoices (FR-81 to FR-90). Money is poisha; every
 * POST that creates a payment, a link or a refund carries an Idempotency-Key held per form. The API
 * enforces every rule; these helpers only shape the screens.
 */
type S = components["schemas"];
export type PaymentLink = S["GymPaymentLink"];
export type LinkChannel = PaymentLink["channels"][number];
export type LinkStatus = PaymentLink["status"];
export type RefundResult = S["GymFeeRefundResult"];
export type PayLinkSummary = S["GymPayLinkSummary"];
export type PayStart = S["GymPayStart"];
export type MyDues = S["MyGymDues"];
export type MyDue = MyDues["items"][number];
export type RemindersPage = S["GymRemindersPage"];
export type ReminderKind = RemindersPage["kinds"][number]["kind"];
export type Report = S["GymReport"];
export type AllReports = S["GymAllReports"];
export type AbsentList = S["GymAbsentList"];
export type Invoice = S["GymInvoice"];
export type InvoiceLine = NonNullable<Invoice["lines"]>[number];
export type InvoiceStatus = Invoice["status"];
export type BillingFull = S["GymBilling"];
export type FeeSource = BillingFull["fees"]["referral"]["source"];
export type OnlineFeesReason = "role" | "tier" | "restricted";
export type ExportDataset = "members" | "payments" | "attendance";
export type Period = { month: string } | { from: string; to: string };

const ik = (key: string) => ({ "idempotency-key": key });
const G = (gymId: string) => ({ path: { gymId } });

export const gymMoney = {
  // Payment links (fees.collect) and online refunds (owner)
  links: async (gymId: string, query: { dueId?: string; status?: LinkStatus } = {}) => unwrap(await api().GET("/manage/gyms/{gymId}/payment-links", { params: { ...G(gymId), query } })),
  createLink: async (gymId: string, dueId: string, body: { amountPoisha?: number; channels?: LinkChannel[] }, key: string) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/dues/{dueId}/payment-links", { params: { path: { gymId, dueId }, header: ik(key) }, body })),
  cancelLink: async (gymId: string, linkId: string) => unwrap(await api().POST("/manage/gyms/{gymId}/payment-links/{linkId}/cancel", { params: { path: { gymId, linkId } } })),
  refund: async (gymId: string, feePaymentId: string, body: { amountPoisha: number; reason: string }, key: string) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/fee-payments/{feePaymentId}/refund", { params: { path: { gymId, feePaymentId }, header: ik(key) }, body })),
  // Reminders (owner) and reports (reports.view; exports owner)
  reminders: async (gymId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/reminders", { params: G(gymId) })),
  report: async (gymId: string, period: Period) => unwrap(await api().GET("/manage/gyms/{gymId}/reports", { params: { ...G(gymId), query: period } })),
  /** M27-FR-31: not seen for `days` (1–365); the gym's own absent days when left out. */
  absent: async (gymId: string, days?: number) => unwrap(await api().GET("/manage/gyms/{gymId}/reports/absent", { params: { ...G(gymId), query: days ? { days } : {} } })),
  allReports: async (period: Period) => unwrap(await api().GET("/manage/reports", { params: { query: period } })),
  // The owner's invoices
  invoices: async () => unwrap(await api().GET("/manage/billing/invoices")),
  invoice: async (invoiceId: string) => unwrap(await api().GET("/manage/billing/invoices/{invoiceId}", { params: { path: { invoiceId } } })),
  payInvoice: async (invoiceId: string, key: string) => unwrap(await api().POST("/manage/billing/invoices/{invoiceId}/pay", { params: { path: { invoiceId }, header: ik(key) } })),
  // Public: the payment link page (a bearer when signed in tells the viewer's phone match)
  payLink: async (token: string) => unwrap(await api().GET("/gym-pay/{token}", { params: { path: { token } } })),
  payByLink: async (token: string, linkAccount: boolean, key: string) => unwrap(await api().POST("/gym-pay/{token}/pay", { params: { path: { token }, header: ik(key) }, body: { linkAccount } })),
  // Member: my dues across gyms
  myDues: async () => unwrap(await api().GET("/me/gym-dues")),
  payMyDue: async (dueId: string, key: string) => unwrap(await api().POST("/me/gym-dues/{dueId}/pay", { params: { path: { dueId }, header: ik(key) } })),
};

// ---------------------------------------------------------------- pure helpers (tested)

/** The API's pay URL (GYM_URL/pay/<id>) as a path on this site, so the pay page opens here; anything else stays as given. */
export function payPath(url: string): string {
  try {
    const path = new URL(url, "https://gym.kriraghor.com").pathname;
    return /^\/pay\/[^/]+$/.test(path) ? path : url;
  } catch {
    return url;
  }
}

/** The channels toggles → the POST body's channels ([] = only the QR at the counter). */
export const linkChannels = (inApp: boolean, email: boolean): LinkChannel[] => [...(inApp ? (["in_app"] as const) : []), ...(email ? (["email"] as const) : [])];

/** The status a viewer should see: an open link past its expiry is expired (the job marks it later). */
export const linkStatus = (l: Pick<PaymentLink, "status" | "expiresAt">, now = Date.now()): LinkStatus => (l.status === "open" && Date.parse(l.expiresAt) <= now ? "expired" : l.status);

/** The open, unexpired link among a due's links (the dialog shows it with Cancel instead of a new one). */
export const openLinkOf = <T extends Pick<PaymentLink, "status" | "expiresAt">>(links: readonly T[], now = Date.now()): T | null => links.find((l) => linkStatus(l, now) === "open") ?? null;

/** Where a "can't take fees online" answer sends the owner: the gym owner documents on kriraghor.com (list_gym), a plan, or the bill. */
export function onlineFeesFix(reason: string | null | undefined): { key: OnlineFeesReason; href: string } {
  if (reason === "tier") return { key: "tier", href: "/manage/billing" };
  if (reason === "restricted") return { key: "restricted", href: "/manage/billing" };
  return { key: "role", href: webHref("/account/business?as=gym") };
}

/** An online payment the owner may refund from the hold: positive, online, not reversed, before the link's release. */
export type RefundState = { can: true; refundable: number; until: string | null } | { can: false; why: "notOnline" | "reversed" | "released" | "refunded" };
export function refundState(p: Pick<FeePayment, "amountPoisha" | "method" | "reversedById" | "reversesId">, link: Pick<PaymentLink, "releaseAt" | "releasedAt" | "refundedPoisha"> | null | undefined, now = Date.now()): RefundState {
  if (p.method !== "online" || p.amountPoisha <= 0 || p.reversesId) return { can: false, why: "notOnline" };
  if (p.reversedById) return { can: false, why: "reversed" };
  if (link?.releasedAt || (link?.releaseAt && Date.parse(link.releaseAt) <= now)) return { can: false, why: "released" };
  const refundable = p.amountPoisha - (link?.refundedPoisha ?? 0);
  if (refundable <= 0) return { can: false, why: "refunded" };
  return { can: true, refundable, until: link?.releaseAt ?? null };
}

/** What /p/[token] shows for a link: pay, already paid (receipt), expired or cancelled (ask for a new one), or not online. */
export type PayLinkView = "pay" | "paid" | "expired" | "cancelled" | "offline";
export function payLinkView(s: Pick<PayLinkSummary, "link" | "onlineFees">, now = Date.now()): PayLinkView {
  const st = linkStatus(s.link, now);
  if (st === "paid") return "paid";
  if (st === "expired") return "expired";
  if (st === "cancelled") return "cancelled";
  return s.onlineFees ? "pay" : "offline";
}

/** The "link this membership" tick is offered only when the API says so (signed in, phone matches, not yet linked). */
export const offerLink = (viewer: PayLinkSummary["viewer"]) => Boolean(viewer?.canLink);

/** A ?month= value (YYYY-MM) if it is a real month no later than this one, else this month. */
export function monthParam(v: string | null | undefined, today: string): string {
  const cur = today.slice(0, 7);
  if (!v || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v) || v > cur || v < "2020-01") return cur;
  return v;
}

/** 24 hourly bars (Dhaka) from the sparse busiest-hours list, labels every 6 hours. */
export function hourBars(rows: readonly { hour: number; visits: number }[]): { label: string; value: number; tick: string }[] {
  const by = new Map(rows.map((r) => [r.hour, r.visits]));
  return Array.from({ length: 24 }, (_, h) => ({ label: `${String(h).padStart(2, "0")}:00`, value: by.get(h) ?? 0, tick: h % 6 === 0 ? String(h).padStart(2, "0") : "" }));
}

/** Daily visits as bars; the day of the month under every 5th bar so 31 bars fit a phone. */
export function dayBars(rows: readonly { date: string; visits: number }[]): { label: string; value: number; tick: string }[] {
  return rows.map((r, i) => {
    const day = Number(r.date.slice(8, 10));
    return { label: r.date, value: r.visits, tick: i === 0 || day % 5 === 0 ? String(day) : "" };
  });
}

/** Churn (a ratio or null) as a whole percent with one decimal ("4.2"), or null. */
export const churnPct = (churn: number | null | undefined) => (churn == null ? null : Math.round(churn * 1000) / 10);

/** Left-by-reason counts, largest first, zero rows left out. */
export const reasonsByCount = (byReason: Record<string, number>) =>
  Object.entries(byReason)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

/** The billing banner: restricted beats past due; none when the subscription is in good standing. */
export function billingBanner(sub: Pick<BillingFull["subscription"], "status" | "restrictOn">): { kind: "restricted" } | { kind: "pastDue"; restrictOn: string | null } | null {
  if (sub.status === "restricted") return { kind: "restricted" };
  if (sub.status === "past_due") return { kind: "pastDue", restrictOn: sub.restrictOn };
  return null;
}

/** A fee that applies: the standard setting, or a special rate (an override) until a date or open-ended. */
export const feeKind = (f: { source: FeeSource; validTo: string | null }): "standard" | "specialUntil" | "special" => (f.source === "setting" ? "standard" : f.validTo ? "specialUntil" : "special");

/** An invoice may be paid while it is issued or overdue. */
export const invoicePayable = (i: Pick<Invoice, "status">) => i.status === "issued" || i.status === "overdue";

export const INVOICE_TONE: Record<InvoiceStatus, "info" | "danger" | "brand" | "neutral"> = { issued: "info", overdue: "danger", paid: "brand", void: "neutral" };

/** One invoice line's description in the page's language. */
export const lineText = (l: Pick<InvoiceLine, "descriptionEn" | "descriptionBn">, locale: string) => (locale === "bn" ? l.descriptionBn || l.descriptionEn : l.descriptionEn || l.descriptionBn);

/** The reports page's export query for a month. */
export const exportQuery = (dataset: ExportDataset, month: string): Record<string, string> => ({ dataset, month });

/** The reminder kinds switched off after flipping one (the settings PATCH remindersOff), kept in the page's kind order. */
export function remindersOffAfter(kinds: readonly { kind: ReminderKind; on: boolean }[], kind: ReminderKind, on: boolean): ReminderKind[] {
  return kinds.filter((k) => (k.kind === kind ? !on : !k.on)).map((k) => k.kind);
}
