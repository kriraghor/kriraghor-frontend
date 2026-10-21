import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "./finance";

/**
 * M18 risk desk (admin.kriraghor.com): open flags by severity, one account with its flags, metrics,
 * actions and undo, reliability, holds and document requests. Staff with manage_users ask for
 * documents, clear and suspend (up to risk.staff_suspend_max_days); masters also freeze payouts and
 * ban, with a step-up code. Every action needs a reason; every action can be undone (a new row).
 */
export type RiskFlag = components["schemas"]["RiskFlagList"]["items"][number];
export type RiskAccount = components["schemas"]["RiskAccount"];
export type RiskOverview = components["schemas"]["RiskOverview"];
export type RiskActionName = "freeze_payouts" | "request_documents" | "clear" | "suspend" | "ban";
export type Severity = "info" | "medium" | "high" | "critical";

const a = () => api("admin");

export const riskAdmin = {
  overview: async () => unwrap(await a().GET("/admin/risk/overview")),
  flags: async (query: { status?: string; severity?: Severity; cursor?: string }) =>
    unwrap(await a().GET("/admin/risk/flags", { params: { query: { status: (query.status || "active") as never, ...(query.severity ? { severity: query.severity } : {}), ...(query.cursor ? { cursor: query.cursor } : {}), limit: 100 } } })),
  account: async (userId: string) => unwrap(await a().GET("/admin/risk/accounts/{userId}", { params: { path: { userId } } })),
  act: async (userId: string, body: { action: RiskActionName; flagId?: string; reason: string; params?: { days?: number; docType?: "nid" | "trade_license" | "deed_or_lease" | "tin" } }, stepUpToken?: string) =>
    unwrap(await a().POST("/admin/risk/accounts/{userId}/actions", { params: { path: { userId }, header: stepUpToken ? { "x-step-up": stepUpToken } : {} }, body })),
  undo: async (id: string, reason: string, stepUpToken?: string) => unwrap(await a().POST("/admin/risk/actions/{id}/undo", { params: { path: { id }, header: stepUpToken ? { "x-step-up": stepUpToken } : {} }, body: { reason } })),
  thresholds: async (changes: { key: string; to: number }[], reason: string, stepUpToken: string) =>
    unwrap(await a().POST("/admin/risk/thresholds", { params: { header: { "x-step-up": stepUpToken } }, body: { changes, reason } })),
};

/** The step-up scope an action (or its undo) needs: freezes risk.manage, bans user.ban, others none. */
export function stepUpScope(action: string): "risk.manage" | "user.ban" | null {
  if (action === "freeze_payouts" || action === "unfreeze_payouts") return "risk.manage";
  if (action === "ban") return "user.ban";
  return null;
}

/** Actions only a master can take (Q100). */
export const MASTER_ACTIONS = new Set(["freeze_payouts", "ban"]);

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "info"];
