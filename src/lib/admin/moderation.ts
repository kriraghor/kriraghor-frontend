import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { newKey, unwrap } from "./finance";

/**
 * Moderation desk client (M05 lite): the queue of the kinds the reviewer may see, KPIs, the claim
 * lock (heartbeat while the pane is open), server-stored rubric ticks, decisions, the master
 * override (step-up moderation.override) and reopen. Each kind's panel (documents: M02's fields,
 * files and NID reveal) lives with that kind.
 */
export type Row = components["schemas"]["ModerationQueue"]["items"][number];
export type Detail = components["schemas"]["ModerationDetail"];
export type Stats = components["schemas"]["ModerationStats"];
export type Status = Row["status"];
export type Check = Detail["checks"][number];
export type Decision = "approve" | "request_changes" | "reject";
export type Claimed = "me" | "others" | "none";

export const QUEUE_STATUSES = ["pending_review", "changes_requested", "approved", "rejected"] as const satisfies readonly Status[];
/** The desk refreshes the queue on this cadence (no websocket push in lite). */
export const QUEUE_POLL_MS = 30_000;
/** moderation.heartbeat_sec (60): the pane keeps the lock while it is open. */
export const HEARTBEAT_MS = 60_000;

/** Hard checks that fail (they block approval unless a master overrides, Q46). */
export const hardFailures = (checks: readonly Check[]) => checks.filter((c) => c.severity === "hard" && c.result === "fail").map((c) => c.key);

/**
 * What stops this decision before it reaches the server (the server re-checks everything):
 * approve needs every rubric tick and no failing hard check unless an override reason is given;
 * the others need a reason, and text when the reason asks for it.
 */
export function decisionProblem(
  decision: Decision,
  { missing, failing, reason, reasonText, override }: { missing: readonly string[]; failing: readonly string[]; reason: { requiresText: boolean } | null; reasonText: string; override: string }
): "rubric" | "checks" | "reason" | "reasonText" | null {
  if (decision === "approve") {
    if (missing.length) return "rubric";
    return failing.length && override.trim().length < 3 ? "checks" : null;
  }
  if (!reason) return "reason";
  return reason.requiresText && !reasonText.trim() ? "reasonText" : null;
}

/** Seconds left on a lock, never below 0. */
export const secondsLeft = (expiresAt: string, now: number) => Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));

const sub = (id: string) => ({ path: { id } });

export const moderation = {
  queue: async (query: { status: Status; kind?: string; claimed?: Claimed; overdue?: "true"; q?: string }) => unwrap(await api("admin").GET("/admin/submissions", { params: { query } })),
  stats: async () => unwrap(await api("admin").GET("/admin/submissions/stats")),
  get: async (id: string) => unwrap(await api("admin").GET("/admin/submissions/{id}", { params: sub(id) })),
  claim: async (id: string) => unwrap(await api("admin").POST("/admin/submissions/{id}/claim", { params: sub(id) })),
  heartbeat: async (id: string) => unwrap(await api("admin").POST("/admin/submissions/{id}/heartbeat", { params: sub(id) })),
  ticks: async (id: string, ticks: string[]) => unwrap(await api("admin").PUT("/admin/submissions/{id}/ticks", { params: sub(id), body: { ticks } })),
  release: async (id: string, force = false) => unwrap(await api("admin").POST("/admin/submissions/{id}/release", { params: sub(id), body: force ? { force } : {} })),
  decide: async (id: string, body: { decision: Decision; reasonCode?: string; reasonText?: string; override?: string }, stepUpToken?: string) =>
    unwrap(
      await api("admin").POST("/admin/submissions/{id}/decide", {
        params: { ...sub(id), header: { "idempotency-key": newKey(), ...(stepUpToken ? { "x-step-up": stepUpToken } : {}) } },
        body,
      })
    ),
  reopen: async (id: string, reason: string, stepUpToken: string) =>
    unwrap(await api("admin").POST("/admin/submissions/{id}/reopen", { params: { ...sub(id), header: { "x-step-up": stepUpToken } }, body: { reason } })),
};
