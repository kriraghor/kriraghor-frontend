import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "../admin/finance";

/**
 * Shop orders desk client (M13 step 1, vendor.kriraghor.com): my sub-orders by tab, accept (the
 * buyer's phone and address show), reject with a reason (a full refund), ship with the courier and
 * tracking number, mark delivered (optional photo), and the settlement totals.
 */
export type ShopSub = components["schemas"]["ShopSubOrder"];
export type ShopSubList = components["schemas"]["ShopSubOrderList"];
export type Settlement = components["schemas"]["ShopSettlement"];
export const TABS = ["to_accept", "to_ship", "shipped", "done", "cancelled"] as const;
export type Tab = (typeof TABS)[number];
export const REJECT_REASONS = ["out_of_stock", "cannot_deliver_area", "price_error", "shop_closed", "other"] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

const g = (id: string) => ({ path: { id } });

export const shopOrders = {
  list: async (tab: Tab) => unwrap(await api().GET("/shop/sub-orders", { params: { query: { tab, limit: 50 } } })),
  get: async (id: string) => unwrap(await api().GET("/shop/sub-orders/{id}", { params: g(id) })),
  accept: async (id: string) => unwrap(await api().POST("/shop/sub-orders/{id}/accept", { params: g(id) })),
  reject: async (id: string, reason: RejectReason, note?: string) => unwrap(await api().POST("/shop/sub-orders/{id}/reject", { params: g(id), body: { reason, ...(note ? { note } : {}) } })),
  ship: async (id: string, courierName: string, trackingNo: string) => unwrap(await api().POST("/shop/sub-orders/{id}/ship", { params: g(id), body: { courierName, trackingNo } })),
  /** Mark delivered, with an optional photo sent raw (the API checks its first bytes). */
  delivered: async (id: string, file?: File | null) =>
    unwrap(
      await api().POST("/shop/sub-orders/{id}/delivered", {
        params: g(id),
        body: (file ?? "") as unknown as string,
        bodySerializer: (b: unknown) => b as BodyInit,
        headers: { "Content-Type": file?.type || "application/octet-stream" },
      })
    ),
  settlement: async () => unwrap(await api().GET("/shop/settlement")),
};

/** The time left until a deadline, in whole hours (negative once past). */
export const hoursLeft = (iso: string | null | undefined, now = Date.now()) => (iso ? Math.floor((new Date(iso).getTime() - now) / 3600000) : null);
