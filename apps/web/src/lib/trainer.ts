import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";

/**
 * Trainers' monthly plans on kriraghor.com (M20 §6, part of Hire): the plans on a fitness trainer's
 * hire page (/hiring/[slug]), the trainer's own plans and subscribers (/pro/plans), and the
 * subscription card both sides share. The member's gym pages, passes and "My trainer plans" moved to
 * gym.kriraghor.com on 25 Oct 2026 (M24 §4.3). Dates are Dhaka calendar dates.
 */
export type Plan = components["schemas"]["TrainerPlan"];
export type Subscription = components["schemas"]["TrainerSubscription"];

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}
const key = (k: string) => ({ "idempotency-key": k });

export const trainer = {
  plansOf: async (profileId: string) => ok(await api().GET("/gym/trainers/{id}/plans", { params: { path: { id: profileId } } })),
  subscribe: async (planId: string, startDate: string, k: string) => ok(await api().POST("/gym/subscriptions", { params: { header: key(k) }, body: { planId, startDate } })),
  renew: async (id: string) => ok(await api().POST("/me/subscriptions/{id}/renew", { params: { path: { id } } })),
  cancelSubscription: async (id: string) => ok(await api().POST("/me/subscriptions/{id}/cancel", { params: { path: { id } } })),
  problem: async (id: string, statement: string, k: string) =>
    ok(await api().POST("/me/subscriptions/{id}/problem", { params: { path: { id }, header: key(k) }, body: { statement } })) as { dispute?: { code?: string } },
  myPlans: async () => ok(await api().GET("/pro/trainer-plans")),
  createPlan: async (body: { profileId: string; title: string; description?: string | null; sessionsPerMonth?: number | null; price: number; whereKind: "gym" | "home" | "online"; gymId?: string | null; areaId?: string | null }) =>
    ok(await api().POST("/pro/trainer-plans", { body })),
  retirePlan: async (id: string) => ok(await api().POST("/pro/trainer-plans/{id}/retire", { params: { path: { id } } })),
  subscribers: async () => ok(await api().GET("/pro/subscriptions")),
  /** The live gyms a plan can be held at (the plan form's gym picker). */
  gyms: async () => ok(await api().GET("/gym/gyms", { params: { query: { sort: "price", limit: 24 } } })),
  areas: async () => ok(await api().GET("/catalog/areas", { params: { query: { service: "delivery" } } })),
};

/** A calendar date `n` days after another (YYYY-MM-DD, UTC arithmetic so no time zone shifts it). */
export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export type Tone = "ok" | "warn" | "muted" | "error";
export function subscriptionTone(phase: string): Tone {
  if (phase === "active") return "ok";
  if (["renewal_due", "grace", "pending_payment"].includes(phase)) return "warn";
  if (phase === "lapsed") return "error";
  return "muted";
}
export const TONE: Record<Tone, string> = { ok: "border-brand text-brand", warn: "border-amber-500 text-ink", muted: "border-line text-muted", error: "border-danger text-danger" };
