import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "./manage";

/**
 * M27 round 1 · Front desk and money (gym.kriraghor.com/manage/[gymId]): expenses, the day's cash drawer,
 * profit and loss, the counter shop (products, stock, sales and receipts) and lockers. All of it is the
 * gym's own books (bookkeeping only, like counter fees, M24-FR-34): nothing here moves money. Money is
 * poisha, dates are Dhaka calendar days. Every POST that records money, stock, a sale or a rental carries an
 * Idempotency-Key held per form. The API enforces every rule; these helpers only shape the screens.
 */
type S = components["schemas"];
export type Expense = S["GymExpense"];
export type Expenses = S["GymExpenses"];
export type ExpenseCategory = S["GymExpenseCategory"];
export type Drawer = S["GymDrawer"];
export type Product = S["GymProduct"];
export type Sale = S["GymSale"];
export type Sales = S["GymSales"];
export type Locker = S["GymLocker"];
export type Lockers = S["GymLockers"];
export type Rental = NonNullable<S["GymLockerRental"]>;
export type Pnl = S["GymProfitAndLoss"];
export type PnlPeriod = Pnl["current"];
export type ExpenseMethod = Expense["method"];
export type SaleMethod = Sale["method"];
export type ProductCategory = Product["category"];
export type LockerSize = Locker["size"];
export type LockerState = Locker["state"];

export const EXPENSE_METHODS: ExpenseMethod[] = ["cash", "owner_bkash", "owner_nagad", "card_counter", "bank", "other"];
export const SALE_METHODS: SaleMethod[] = ["cash", "owner_bkash", "owner_nagad", "card_counter", "other"];
export const PRODUCT_CATEGORIES: ProductCategory[] = ["supplement", "drink", "snack", "gear", "apparel", "accessory", "other"];
export const LOCKER_SIZES: LockerSize[] = ["small", "medium", "large"];

const ik = (key: string) => ({ "idempotency-key": key });
const G = (gymId: string) => ({ path: { gymId } });

export type ExpenseInput = { categoryId: string; amountPoisha: number; spentOn: string; method: ExpenseMethod; fromDrawer: boolean; payee: string | null; note: string | null };
export type ProductInput = {
  name: string;
  barcode: string | null;
  category: ProductCategory;
  pricePoisha: number;
  costPoisha: number | null;
  reorderLevel: number;
  batchNo: string | null;
  expiresOn: string | null;
  importer: string | null;
};
export type StockInput = { kind: "in" | "adjust" | "write_off"; qty: number; unitCostPoisha?: number | null; batchNo?: string | null; expiresOn?: string | null; note?: string | null };

export const gymOps = {
  // Expenses (M27-FR-01 to FR-05)
  categories: async (gymId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/expense-categories", { params: G(gymId) })),
  saveCategories: async (gymId: string, categories: { id?: string; name: string; status: "active" | "retired" }[]) =>
    unwrap(await api().PUT("/manage/gyms/{gymId}/expense-categories", { params: G(gymId), body: { categories } as never })),
  expenses: async (gymId: string, query: { from?: string; to?: string; categoryId?: string; status?: "recorded" | "void"; cursor?: string; limit?: number }) =>
    unwrap(await api().GET("/manage/gyms/{gymId}/expenses", { params: { ...G(gymId), query } })),
  addExpense: async (gymId: string, body: ExpenseInput, key: string) => unwrap(await api().POST("/manage/gyms/{gymId}/expenses", { params: { ...G(gymId), header: ik(key) }, body })),
  voidExpense: async (gymId: string, expenseId: string, reason: string) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/expenses/{expenseId}/void", { params: { path: { gymId, expenseId } }, body: { reason } })),
  // The cash drawer (M27-FR-06 to FR-09)
  drawer: async (gymId: string, date?: string) => unwrap(await api().GET("/manage/gyms/{gymId}/cash-drawer", { params: { ...G(gymId), query: date ? { date } : {} } })),
  openDrawer: async (gymId: string, openingPoisha: number) => unwrap(await api().POST("/manage/gyms/{gymId}/cash-drawer/open", { params: G(gymId), body: { openingPoisha } })),
  closeDrawer: async (gymId: string, countedPoisha: number, note: string | null) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/cash-drawer/close", { params: G(gymId), body: { countedPoisha, note } })),
  // Profit and loss (M27-FR-27)
  pnl: async (gymId: string, from?: string, to?: string) => unwrap(await api().GET("/manage/gyms/{gymId}/pnl", { params: { ...G(gymId), query: from && to ? { from, to } : {} } })),
  // The counter shop (M27-FR-10 to FR-21)
  products: async (gymId: string, query: { q?: string; barcode?: string; status?: "active" | "retired"; low?: boolean } = {}) =>
    unwrap(await api().GET("/manage/gyms/{gymId}/products", { params: { ...G(gymId), query: query as never } })),
  addProduct: async (gymId: string, body: ProductInput) => unwrap(await api().POST("/manage/gyms/{gymId}/products", { params: G(gymId), body })),
  editProduct: async (gymId: string, productId: string, body: Partial<ProductInput> & { status?: "active" | "retired" }) =>
    unwrap(await api().PATCH("/manage/gyms/{gymId}/products/{productId}", { params: { path: { gymId, productId } }, body: body as never })),
  stock: async (gymId: string, productId: string, body: StockInput, key: string) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/products/{productId}/stock", { params: { path: { gymId, productId }, header: ik(key) }, body: body as never })),
  sales: async (gymId: string, query: { date?: string; cursor?: string; limit?: number } = {}) => unwrap(await api().GET("/manage/gyms/{gymId}/sales", { params: { ...G(gymId), query } })),
  sell: async (gymId: string, body: { lines: { productId: string; qty: number }[]; method: SaleMethod; memberId?: string }, key: string) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/sales", { params: { ...G(gymId), header: ik(key) }, body: body as never })),
  receipt: async (gymId: string, saleId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/sales/{saleId}/receipt", { params: { path: { gymId, saleId } } })),
  reverse: async (gymId: string, saleId: string, reason: string) => unwrap(await api().POST("/manage/gyms/{gymId}/sales/{saleId}/reverse", { params: { path: { gymId, saleId } }, body: { reason } })),
  // Lockers (M27-FR-22 to FR-26)
  lockers: async (gymId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/lockers", { params: G(gymId) })),
  addLockers: async (gymId: string, body: { numbers: string[]; zone: string | null; size: LockerSize; monthlyFeePoisha: number }) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/lockers", { params: G(gymId), body })),
  editLocker: async (gymId: string, lockerId: string, body: { zone?: string | null; size?: LockerSize; monthlyFeePoisha?: number; status?: "available" | "out_of_service" | "retired"; note?: string | null }) =>
    unwrap(await api().PATCH("/manage/gyms/{gymId}/lockers/{lockerId}", { params: { path: { gymId, lockerId } }, body: body as never })),
  rent: async (gymId: string, lockerId: string, body: { memberId: string; startsOn?: string; endsOn: string; feePoisha?: number; collect?: { method: SaleMethod } }, key: string) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/lockers/{lockerId}/rent", { params: { path: { gymId, lockerId }, header: ik(key) }, body: body as never })),
  rentals: async (gymId: string, query: { memberId?: string; status?: "active" | "ended" | "cancelled" } = {}) =>
    unwrap(await api().GET("/manage/gyms/{gymId}/locker-rentals", { params: { ...G(gymId), query } })),
  collect: async (gymId: string, rentalId: string, method: SaleMethod, key: string) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/locker-rentals/{rentalId}/collect", { params: { path: { gymId, rentalId }, header: ik(key) }, body: { method } })),
  endRental: async (gymId: string, rentalId: string, reason: string) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/locker-rentals/{rentalId}/end", { params: { path: { gymId, rentalId } }, body: { reason } })),
};

// ---------------------------------------------------------------- pure helpers (tested)

/** A cart line at the counter. */
export type CartLine = { product: Pick<Product, "id" | "name" | "pricePoisha" | "stockQty">; qty: number };

/** Add one of a product to the cart (or one more), never past the stock. */
export function addToCart(cart: readonly CartLine[], product: CartLine["product"]): CartLine[] {
  const i = cart.findIndex((l) => l.product.id === product.id);
  if (i < 0) return product.stockQty > 0 ? [...cart, { product, qty: 1 }] : [...cart];
  return cart.map((l, j) => (j === i ? { ...l, qty: Math.min(l.qty + 1, l.product.stockQty) } : l));
}

/** Set a line's quantity: 0 removes it; never past the stock. */
export function setQty(cart: readonly CartLine[], productId: string, qty: number): CartLine[] {
  if (qty <= 0) return cart.filter((l) => l.product.id !== productId);
  return cart.map((l) => (l.product.id === productId ? { ...l, qty: Math.min(Math.floor(qty), l.product.stockQty) } : l));
}

export const cartTotal = (cart: readonly CartLine[]) => cart.reduce((s, l) => s + l.qty * l.product.pricePoisha, 0);

/** The change to hand back for cash received, or null when it is not enough. */
export const changeDue = (total: number, received: number | null) => (received == null || received < total ? null : received - total);

/** How a drawer difference reads: balanced, short (negative) or over. */
export const drawerTone = (difference: number | null | undefined): "balanced" | "short" | "over" | null =>
  difference == null ? null : difference === 0 ? "balanced" : difference < 0 ? "short" : "over";

/** Change against the period before, as a whole percent; null when there was nothing before. */
export function delta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

/** The first and last Dhaka date of the month that holds `day` (YYYY-MM-DD). */
export function monthRange(day: string): { from: string; to: string } {
  const [y, m] = day.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

/** The month before a YYYY-MM-DD day, as a range. */
export function previousMonth(day: string): { from: string; to: string } {
  const [y, m] = day.split("-").map(Number);
  const prev = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
  return monthRange(prev);
}

/**
 * Locker numbers typed by a person: "1-20", "A1, A2, B5", "101-105, 110" → the list in order, de-duplicated
 * (case-insensitive), or null when a part cannot be read or a range is backwards or too long.
 */
export function lockerNumbers(text: string, max = 500): string[] | null {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (n: string) => {
    const k = n.toUpperCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(n);
    }
  };
  for (const raw of text.split(/[,\n]/)) {
    const part = raw.trim();
    if (!part) continue;
    const range = /^([A-Za-z]*)(\d{1,4})\s*-\s*\1?(\d{1,4})$/.exec(part);
    if (range) {
      const [, prefix, a, b] = range;
      const from = Number(a);
      const to = Number(b);
      if (to < from || to - from + 1 > max) return null;
      for (let n = from; n <= to; n += 1) push(`${prefix}${n}`);
    } else if (/^[A-Za-z0-9-]{1,10}$/.test(part)) {
      push(part);
    } else {
      return null;
    }
  }
  return out.length && out.length <= max ? out : null;
}

/** Days left to a rental's end from today (negative = overdue). */
export function daysLeft(endsOn: string, today: string): number {
  return Math.round((Date.parse(`${endsOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** A Dhaka date some days after another. */
export function plusDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** A typed barcode: what a USB scanner types before Enter, trimmed; digits and letters only. */
export const cleanBarcode = (text: string) => text.trim().replace(/[^0-9A-Za-z-]/g, "");

/** A WhatsApp chat link for a Bangladesh phone (+8801…, 01…), the message prefilled (M27-FR-32). Null when the number cannot be read. */
export function whatsappUrl(phone: string, text: string): string | null {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("880") ? digits : digits.startsWith("0") ? `88${digits}` : null;
  if (!intl || !/^8801[3-9]\d{8}$/.test(intl)) return null;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

/** A tel: link for a phone (spaces and dashes dropped). */
export const telUrl = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
