import { api, problemOf } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "./finance";

/**
 * Gym system desk client (M24 §4.4, §9.2; admin.kriraghor.com/admin/gym-manage): owners on the gym
 * management system (plan, status, founding partner, active members), their invoices and the per-owner
 * and per-gym fee overrides. Reads need manage_gyms or view_payouts (the overrides list manage_gyms);
 * writes are a master's, each with a step-up token (founding partner and overrides settings.write,
 * voiding an invoice escrow.manage). Counts only, never member data. The API enforces every rule.
 */
type S = components["schemas"];
export type OwnerRow = S["GymAdminOwners"]["items"][number];
export type OwnerDetail = S["GymAdminOwnerDetail"];
export type AdminInvoice = S["GymAdminInvoices"]["items"][number];
export type AdminInvoices = S["GymAdminInvoices"];
export type FeeOverride = S["GymFeeOverride"];
export type SaasTier = OwnerRow["subscription"]["chosenTier"];
export type SubStatus = OwnerRow["subscription"]["status"];
export type InvoiceStatus = AdminInvoice["status"];
export type OverrideKey = FeeOverride["key"];
export type OverrideInput = { scopeType: "owner" | "gym"; scopeId: string; key: OverrideKey; value: number; reason: string; validFrom?: string; validTo?: string | null };

export const SAAS_TIERS: SaasTier[] = ["free", "basic", "standard", "pro"];
export const SUB_STATUSES: SubStatus[] = ["active", "past_due", "restricted", "closed"];
export const INVOICE_STATUSES: InvoiceStatus[] = ["issued", "overdue", "paid", "void"];
export const REFERRAL_KEY: OverrideKey = "fees.gym_referral_poisha";
export const PASS_KEY: OverrideKey = "fees.gym_pct";

const step = (token: string) => ({ "x-step-up": token });

export const gymManageAdmin = {
  owners: async (q: { tier?: SaasTier; status?: SubStatus; founding?: "true" | "false" }) => unwrap(await api("admin").GET("/admin/gym-manage/owners", { params: { query: q } })),
  owner: async (ownerId: string) => unwrap(await api("admin").GET("/admin/gym-manage/owners/{ownerId}", { params: { path: { ownerId } } })),
  setFounding: async (ownerId: string, on: boolean, reason: string, token: string) =>
    unwrap(await api("admin").PUT("/admin/gym-manage/owners/{ownerId}/founding-partner", { params: { path: { ownerId }, header: step(token) }, body: { on, reason } })),
  invoices: async (q: { status?: InvoiceStatus; period?: string; ownerId?: string }) => unwrap(await api("admin").GET("/admin/gym-manage/invoices", { params: { query: q } })),
  voidInvoice: async (invoiceId: string, reason: string, token: string) =>
    unwrap(await api("admin").POST("/admin/gym-manage/invoices/{invoiceId}/void", { params: { path: { invoiceId }, header: step(token) }, body: { reason } })),
  overrides: async (q: { ownerId?: string; status?: "active" | "ended" }) => unwrap(await api("admin").GET("/admin/gym-manage/fee-overrides", { params: { query: q } })),
  createOverride: async (body: OverrideInput, token: string) => unwrap(await api("admin").POST("/admin/gym-manage/fee-overrides", { params: { header: step(token) }, body })),
  endOverride: async (overrideId: string, reason: string, token: string) =>
    unwrap(await api("admin").POST("/admin/gym-manage/fee-overrides/{overrideId}/end", { params: { path: { overrideId }, header: step(token) }, body: { reason } })),
};

// ---------------------------------------------------------------- pure helpers (tested)

export type DeskTab = "owners" | "invoices" | "overrides";
type Me = { isMaster: boolean; permissions: readonly string[] } | undefined;

/** The desk's tabs: owners and invoices with manage_gyms or view_payouts; the overrides list with manage_gyms (masters see all). */
export function deskTabs(me: Me): DeskTab[] {
  if (!me) return [];
  const has = (p: string) => me.isMaster || me.permissions.includes(p);
  if (!has("manage_gyms") && !has("view_payouts")) return [];
  return ["owners", "invoices", ...(has("manage_gyms") ? (["overrides"] as const) : [])];
}

/** Only masters change anything here (founding partner, overrides, voiding); everyone else reads. */
export const canWrite = (me: Me) => Boolean(me?.isMaster);

/** An open invoice can be voided (issued or overdue). */
export const voidable = (status: InvoiceStatus) => status === "issued" || status === "overdue";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "2026-11-01T09:30" typed in a datetime-local field (Dhaka time) → an ISO instant; null when blank, undefined when not a date. */
export function dhakaLocalToIso(v: string): string | null | undefined {
  const s = v.trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return undefined;
  const ms = Date.parse(`${s}:00+06:00`);
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

export type OverrideForm = { scopeType: "owner" | "gym"; scopeId: string; kind: "referral" | "pass"; value: string; reason: string; validFrom: string; validTo: string };
export type OverrideProblem = "scope" | "value" | "reason" | "from" | "to" | "order";

/**
 * The create form → the API body, or the first problem. The referral fee is typed in taka and sent as
 * whole poisha (0 waives it); the pass commission is a percent with up to 2 decimals, 0 to 100. Valid
 * from and to are Dhaka times (from defaults to now on the API; to blank runs until a master ends it).
 */
export function overrideBody(f: OverrideForm): { ok: true; body: OverrideInput } | { ok: false; problem: OverrideProblem } {
  const scopeId = f.scopeId.trim();
  if (!UUID.test(scopeId)) return { ok: false, problem: "scope" };
  const text = f.value.replace(/,/g, "").trim();
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(text);
  if (!m) return { ok: false, problem: "value" };
  let value: number;
  if (f.kind === "referral") value = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  else {
    value = Number(text);
    if (value > 100) return { ok: false, problem: "value" };
  }
  const reason = f.reason.trim();
  if (reason.length < 2 || reason.length > 300) return { ok: false, problem: "reason" };
  const from = dhakaLocalToIso(f.validFrom);
  if (from === undefined) return { ok: false, problem: "from" };
  const to = dhakaLocalToIso(f.validTo);
  if (to === undefined) return { ok: false, problem: "to" };
  if (to && Date.parse(to) <= (from ? Date.parse(from) : Date.now())) return { ok: false, problem: "order" };
  const body: OverrideInput = { scopeType: f.scopeType, scopeId, key: f.kind === "referral" ? REFERRAL_KEY : PASS_KEY, value, reason };
  if (from) body.validFrom = from;
  if (to) body.validTo = to;
  return { ok: true, body };
}

/** An override's value as people read it: taka for the referral fee, a percent for the pass commission. */
export function overrideValue(key: OverrideKey, value: number, taka: (poisha: number) => string): string {
  return key === REFERRAL_KEY ? taka(value) : `${value}%`;
}

/** The URL's founding filter → the API's (only "true" or "false"). */
export const foundingParam = (v: string): "true" | "false" | undefined => (v === "true" || v === "false" ? v : undefined);

/** A YYYY-MM period filter, or undefined when it is not one. */
export const periodParam = (v: string): string | undefined => (/^\d{4}-(0[1-9]|1[0-2])$/.test(v.trim()) ? v.trim() : undefined);

/** A problem's code and its extras (min/max for out-of-bounds), for the desk's messages. */
export function problemInfo(err: unknown): { code: string | null; title: string | null; min?: number; max?: number } {
  const p = problemOf(err) as (ReturnType<typeof problemOf> & { min?: number; max?: number }) | null;
  if (!p) return { code: null, title: null };
  return { code: p.code ?? null, title: p.title ?? null, ...(typeof p.min === "number" ? { min: p.min } : {}), ...(typeof p.max === "number" ? { max: p.max } : {}) };
}

/** Invoice totals per status in the desk's order (statuses with nothing are left out). */
export function invoiceTotals(totals: AdminInvoices["totals"] | undefined): { status: InvoiceStatus; count: number; totalPoisha: number }[] {
  if (!totals) return [];
  return INVOICE_STATUSES.filter((s) => totals[s]?.count).map((s) => ({ status: s, count: totals[s].count, totalPoisha: totals[s].totalPoisha }));
}
