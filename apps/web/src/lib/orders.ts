import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";

/**
 * Shop orders on kriraghor.com (M13 step 1): the cart, the server quote (a sub-order per shop, ৳80
 * delivery inside Dhaka metro, ৳150 outside), checkout with one online payment (/pay/[id]), my orders
 * with cancel, received and not received (an M17 dispute).
 */
export type Cart = components["schemas"]["Cart"];
export type CartLine = Cart["shops"][number]["lines"][number];
export type Quote = components["schemas"]["OrderQuote"];
export type OrderResult = components["schemas"]["OrderResult"];
export type Order = components["schemas"]["Order"];
export type SubOrder = Order["subOrders"][number];
export type ShipTo = { name: string; phone: string; areaId: string; line: string; note?: string };

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}

export const orders = {
  cart: async () => ok(await api().GET("/me/cart")),
  setQty: async (variantId: string, qty: number) => ok(await api().PUT("/me/cart/items/{variantId}", { params: { path: { variantId } }, body: { qty } })),
  remove: async (variantId: string) => ok(await api().DELETE("/me/cart/items/{variantId}", { params: { path: { variantId } } })),
  areas: async () => ok(await api().GET("/catalog/areas", { params: { query: { service: "delivery" } } })),
  quote: async (areaId: string) => ok(await api().POST("/checkout/quote", { body: { areaId } })),
  place: async (ship: ShipTo, expectedTotal: number, key: string) =>
    ok(await api().POST("/checkout", { params: { header: { "idempotency-key": key } }, body: { ship: { ...ship, note: ship.note || undefined }, expectedTotal } })),
  mine: async () => ok(await api().GET("/me/orders")),
  one: async (code: string) => ok(await api().GET("/me/orders/{code}", { params: { path: { code } } })),
  pay: async (code: string) => ok(await api().POST("/me/orders/{code}/pay", { params: { path: { code } } })),
  cancel: async (id: string) => ok(await api().POST("/me/sub-orders/{id}/cancel", { params: { path: { id } }, body: {} })),
  received: async (id: string) => ok(await api().POST("/me/sub-orders/{id}/received", { params: { path: { id } } })),
  notReceived: async (id: string, statement: string, key: string) =>
    ok(await api().POST("/me/sub-orders/{id}/not-received", { params: { path: { id }, header: { "idempotency-key": key } }, body: { statement } })),
};

/** The order code of a sub-order code (KG-26-000123-A → KG-26-000123). */
export const orderCodeOf = (subCode: string) => subCode.replace(/-[A-Z]$/, "");

/** Statuses the buyer sees, in the order they happen (for the progress line). */
export const STEPS = ["placed", "accepted", "shipped", "delivered", "completed"] as const;
export const stepIndex = (status: string) => STEPS.indexOf(status as (typeof STEPS)[number]);

/** Group the buyer's sub-order statuses into the tone of a chip. */
export function statusTone(status: string): "ok" | "warn" | "muted" | "error" {
  if (status === "completed") return "ok";
  if (["placed", "accepted", "shipped", "delivered"].includes(status)) return "warn";
  if (status === "disputed") return "error";
  return "muted";
}
