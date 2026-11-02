import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "./finance";

/**
 * Gym desk client (M20, admin.kriraghor.com):
 * - gyms by status or name; suspend (manage_users) and restore (masters) with a reason;
 * - one gym's working copy (the Moderation desk `gym` panel);
 * - a pass by its code with its escrow hold, and a master's platform cancel (step-up escrow.manage);
 * - a trainer subscription by its code, each month with its hold.
 */
export type StaffGym = components["schemas"]["OwnerGym"];
export type StaffPass = components["schemas"]["GymStaffPass"];
export type StaffSubscription = components["schemas"]["GymStaffSubscription"];
export type GymStatus = StaffGym["status"];

export const gymAdmin = {
  gyms: async (q: { status?: GymStatus; q?: string }) => unwrap(await api("admin").GET("/admin/gym/gyms", { params: { query: { ...(q.status ? { status: q.status } : {}), ...(q.q ? { q: q.q } : {}) } } })),
  gym: async (id: string) => unwrap(await api("admin").GET("/admin/gym/gyms/{id}", { params: { path: { id } } })),
  suspend: async (id: string, reason: string) => unwrap(await api("admin").POST("/admin/gym/gyms/{id}/suspend", { params: { path: { id } }, body: { reason } })),
  restore: async (id: string, reason: string) => unwrap(await api("admin").POST("/admin/gym/gyms/{id}/restore", { params: { path: { id } }, body: { reason } })),
  pass: async (code: string) => unwrap(await api("admin").GET("/admin/gym/passes/{code}", { params: { path: { code } } })),
  cancelPass: async (code: string, reason: string, stepUpToken: string) =>
    unwrap(await api("admin").POST("/admin/gym/passes/{code}/cancel", { params: { path: { code }, header: { "x-step-up": stepUpToken } }, body: { reason } })),
  subscription: async (code: string) => unwrap(await api("admin").GET("/admin/gym/subscriptions/{code}", { params: { path: { code } } })),
};

/** What is still held for a pass (what a platform cancel would refund). */
export const heldOf = (p: Pick<StaffPass, "money">) => Math.max(0, p.money.price - p.money.released - p.money.refunded);

