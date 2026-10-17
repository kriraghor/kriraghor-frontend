import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { unwrap } from "./finance";

/**
 * Orders desk client (M13, admin.kriraghor.com): search orders by code or status, an order with each
 * sub-order's timeline and escrow hold, and a master's platform cancel (step-up escrow.manage).
 */
export type StaffOrderList = components["schemas"]["StaffOrderList"];
export type StaffOrder = components["schemas"]["StaffOrder"];

export const ordersAdmin = {
  list: async (q: { code?: string; status?: "pending_payment" | "placed" | "cancelled" | "completed" }) =>
    unwrap(await api("admin").GET("/admin/orders", { params: { query: { ...(q.code ? { code: q.code } : {}), ...(q.status ? { status: q.status } : {}), limit: 50 } } })),
  get: async (code: string) => unwrap(await api("admin").GET("/admin/orders/{code}", { params: { path: { code } } })),
  cancel: async (subOrderId: string, reason: string, stepUpToken: string) =>
    unwrap(await api("admin").POST("/admin/orders/sub-orders/{id}/cancel", { params: { path: { id: subOrderId }, header: { "x-step-up": stepUpToken } }, body: { reason } })),
};
