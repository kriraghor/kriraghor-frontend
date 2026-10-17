import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { unwrap } from "./finance";

/**
 * Hire desk client (M11, admin.kriraghor.com):
 * - requests by code or status, and one request with each job's timeline and escrow hold;
 * - a master's platform cancel of a job (step-up escrow.manage);
 * - profiles: suspend (manage_users) and restore (masters).
 * The taxonomy is edited through the generic catalogue (hire-categories, hire-roles).
 */
export type StaffRequest = components["schemas"]["HireStaffRequest"];
export type StaffJob = StaffRequest["jobs"][number];
export type StaffProfile = components["schemas"]["HireStaffProfile"];
export type RequestStatus = StaffRequest["status"];
export type ProfileStatus = "pending_review" | "live" | "paused" | "suspended" | "rejected" | "changes_requested";

export const hireAdmin = {
  requests: async (q: { code?: string; status?: RequestStatus }) =>
    unwrap(await api("admin").GET("/admin/hire/requests", { params: { query: { ...(q.code ? { code: q.code } : {}), ...(q.status ? { status: q.status } : {}), limit: 50 } } })),
  request: async (code: string) => unwrap(await api("admin").GET("/admin/hire/requests/{code}", { params: { path: { code } } })),
  profiles: async (q: { status?: ProfileStatus; q?: string }) => unwrap(await api("admin").GET("/admin/hire/profiles", { params: { query: { ...(q.status ? { status: q.status } : {}), ...(q.q ? { q: q.q } : {}) } } })),
  profile: async (id: string) => unwrap(await api("admin").GET("/admin/hire/profiles/{id}", { params: { path: { id } } })),
  suspend: async (id: string, reason: string) => unwrap(await api("admin").POST("/admin/hire/profiles/{id}/suspend", { params: { path: { id } }, body: { reason } })),
  restore: async (id: string, reason: string) => unwrap(await api("admin").POST("/admin/hire/profiles/{id}/restore", { params: { path: { id } }, body: { reason } })),
  cancelJob: async (jobId: string, reason: string, stepUpToken: string) =>
    unwrap(await api("admin").POST("/admin/hire/jobs/{id}/cancel", { params: { path: { id: jobId }, header: { "x-step-up": stepUpToken } }, body: { reason } })),
};

/** Jobs a master may still cancel for the platform (money held, work not yet done). */
export const CANCELLABLE = ["scheduled", "checked_in"];
