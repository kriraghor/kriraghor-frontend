import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";

/**
 * Gyms for members on gym.kriraghor.com (M20, moved from kriraghor.com on 25 Oct 2026):
 * - the /gyms hub (gyms, trainers; gear lives in the kriraghor.com shop);
 * - a gym page with hours (women-only windows) and packages;
 * - passes bought into escrow and shown as a QR with a 6-character backup code (/me/passes);
 * - my trainer subscriptions (/me/subscriptions). Trainers' own plans stay on kriraghor.com (Hire).
 * Dates are Dhaka calendar dates.
 */
export type GymCard = components["schemas"]["GymCard"];
export type GymPage = components["schemas"]["GymPage"];
export type GymPackage = GymPage["packages"][number];
export type Pass = components["schemas"]["GymPass"];
export type PassResult = components["schemas"]["GymPassResult"];
export type Subscription = components["schemas"]["TrainerSubscription"];
export type Hours = GymPage["hours"];
export type TrainerCard = components["schemas"]["GymTrainerCard"];
export type GymSort = "price" | "rating" | "newest" | "nearest";
/** The /gyms filters (M24 prompt 3, §4.1). The position is the viewer's, sent for this answer only and never stored. */
export type GymListQuery = { areaId?: string; facility?: string; q?: string; sort?: GymSort; priceMax?: number; at?: { lat: number; lng: number } | null; radiusKm?: number; cursor?: string };

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}
const key = (k: string) => ({ "idempotency-key": k });

export const gym = {
  list: async (q: GymListQuery) => ok(await api().GET("/gym/gyms", { params: { query: gymListParams(q) as never } })),
  page: async (slug: string) => ok(await api().GET("/gym/gyms/{slug}", { params: { path: { slug } } })),
  trainers: async () => ok(await api().GET("/gym/trainers", { params: { query: { sort: "rating" } } })),
  areas: async () => ok(await api().GET("/catalog/areas", { params: { query: { service: "delivery" } } })),
  facilities: async () => ok(await api().GET("/catalog/facilities")),
  buy: async (packageId: string, validFrom: string, k: string) => ok(await api().POST("/gym/passes", { params: { header: key(k) }, body: { packageId, validFrom } })),
  myPasses: async (status?: "active" | "used" | "expired") => ok(await api().GET("/me/passes", { params: { query: status ? { status } : {} } })),
  pass: async (code: string) => ok(await api().GET("/me/passes/{code}", { params: { path: { code } } })),
  cancelPass: async (id: string) => ok(await api().POST("/me/passes/{id}/cancel", { params: { path: { id } } })),
  mySubscriptions: async () => ok(await api().GET("/me/subscriptions")),
  subscription: async (id: string) => ok(await api().GET("/me/subscriptions/{id}", { params: { path: { id } } })),
  renew: async (id: string) => ok(await api().POST("/me/subscriptions/{id}/renew", { params: { path: { id } } })),
  cancelSubscription: async (id: string) => ok(await api().POST("/me/subscriptions/{id}/cancel", { params: { path: { id } } })),
  problem: async (id: string, statement: string, k: string) =>
    ok(await api().POST("/me/subscriptions/{id}/problem", { params: { path: { id }, header: key(k) }, body: { statement } })) as { dispute?: { code?: string } },
};

/** The /gyms filters → the API query: the nearest sort and the radius need a position, else the list sorts by price. */
export function gymListParams(q: GymListQuery): Record<string, string | number> {
  const out: Record<string, string | number> = { limit: 24 };
  if (q.areaId) out.areaId = q.areaId;
  if (q.facility) out.facility = q.facility;
  if (q.q && q.q.trim().length >= 2) out.q = q.q.trim().slice(0, 60);
  if (q.priceMax && q.priceMax > 0) out.priceMax = q.priceMax;
  if (q.at) {
    // About 11 m: enough for a distance, no more of the viewer's position than that.
    out.lat = Math.round(q.at.lat * 1e4) / 1e4;
    out.lng = Math.round(q.at.lng * 1e4) / 1e4;
    if (q.radiusKm) out.radiusKm = q.radiusKm;
  }
  out.sort = q.sort === "nearest" && !q.at ? "price" : (q.sort ?? (q.at ? "nearest" : "price"));
  if (q.cursor) out.cursor = q.cursor;
  return out;
}

/** "850 m", "2.4 km" (null without a position). */
export function distanceText(m: number | null | undefined, locale: string): string | null {
  if (m == null) return null;
  const n = (v: number, digits: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-IN", { maximumFractionDigits: digits }).format(v);
  return m < 1000 ? `${n(Math.max(10, Math.round(m / 10) * 10), 0)} m` : `${n(m / 1000, m < 10000 ? 1 : 0)} km`;
}

// ---------------- the Dhaka calendar (UTC+6, no daylight saving)

const DHAKA_MS = 6 * 3600000;
export const dhakaToday = (now = new Date()) => new Date(now.getTime() + DHAKA_MS).toISOString().slice(0, 10);
export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const dowOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** Hours grouped by weekday, Saturday first (the Bangladesh week). */
export function weekOf(hours: Hours): { dow: number; windows: Hours }[] {
  const order = [6, 0, 1, 2, 3, 4, 5];
  return order.map((dow) => ({ dow, windows: hours.filter((h) => h.dow === dow).sort((a, b) => a.openTime.localeCompare(b.openTime)) }));
}

export type Tone = "ok" | "warn" | "muted" | "error";
export function passTone(status: string): Tone {
  if (status === "active") return "ok";
  if (status === "pending_payment") return "warn";
  return "muted";
}
export function subscriptionTone(phase: string): Tone {
  if (phase === "active") return "ok";
  if (["renewal_due", "grace", "pending_payment"].includes(phase)) return "warn";
  if (phase === "lapsed") return "error";
  return "muted";
}
export const TONE: Record<Tone, string> = { ok: "border-brand text-brand", warn: "border-warning text-ink", muted: "border-line text-muted", error: "border-danger text-danger" };
