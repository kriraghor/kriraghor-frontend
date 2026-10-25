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
export type GymSort = "price" | "rating" | "newest";

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}
const key = (k: string) => ({ "idempotency-key": k });

export const gym = {
  list: async (q: { areaId?: string; facility?: string; sort?: GymSort; cursor?: string }) =>
    ok(await api().GET("/gym/gyms", { params: { query: { ...(q.areaId ? { areaId: q.areaId } : {}), ...(q.facility ? { facility: q.facility } : {}), sort: q.sort ?? "price", ...(q.cursor ? { cursor: q.cursor } : {}), limit: 24 } } })),
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

// ---------------- the Dhaka calendar (UTC+6, no daylight saving)

const DHAKA_MS = 6 * 3600000;
export const dhakaToday = (now = new Date()) => new Date(now.getTime() + DHAKA_MS).toISOString().slice(0, 10);
export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const dowOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** The next `n` dates from today on which the gym opens (for the day pass picker). */
export function openDates(hours: Hours, today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i)).filter((d) => hours.some((h) => h.dow === dowOf(d)));
}

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
export const TONE: Record<Tone, string> = { ok: "border-brand text-brand", warn: "border-amber-500 text-ink", muted: "border-line text-muted", error: "border-danger text-danger" };
