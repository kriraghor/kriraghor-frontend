import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "../admin/finance";

/**
 * Shop owner desk client (M12 step 1, vendor.kriraghor.com): my shop and its review, products with
 * variants and photos, stock with reasons on an append-only ledger, and the stock rules. The customer
 * session (audience "api"); the API gate list_product needs an active shop_owner role.
 */
export type Shop = components["schemas"]["ShopOwnerView"];
export type Product = components["schemas"]["ProductOwnerView"];
export type ProductCard = components["schemas"]["ProductOwnerList"]["items"][number];
export type Variant = components["schemas"]["ProductVariantOwnerView"];
export type Inventory = components["schemas"]["InventoryOverview"];
export type InventoryRow = Inventory["items"][number];
export type Movement = components["schemas"]["InventoryMovementList"]["items"][number];
export type Categories = components["schemas"]["MarketCategories"];
export type Category = Categories["items"][number];
export type ItemType = Category["types"][number];
export type ItemField = ItemType["fields"][number];
export type ShopType = Shop["shopType"];
export type ReasonCode = "received" | "count_correction" | "damaged" | "lost" | "other";
export type ShopInput = { shopType: ShopType; name: string; areaId: string; addressLine: string; about?: string | null; lat?: number | null; lng?: number | null };
export type ProductInput = {
  itemTypeId: string;
  title: string;
  brand?: string | null;
  description?: string | null;
  specs?: Record<string, string | number>;
  basePricePoisha: number;
  isMto?: boolean;
  mtoDays?: number | null;
  maxQtyPerOrder?: number;
  importer?: string | null;
  bstiRegNo?: string | null;
};
export type VariantInput = { attributes?: Record<string, string>; sku?: string | null; priceOverridePoisha?: number | null; expiryDate?: string | null; batchNo?: string | null; openingStock?: number };

const g = (id: string) => ({ path: { id } });

export const shopDesk = {
  profile: async () => unwrap(await api().GET("/shop/profile")),
  create: async (body: ShopInput) => unwrap(await api().POST("/shop/profile", { body })),
  update: async (body: Partial<ShopInput>) => unwrap(await api().PATCH("/shop/profile", { body })),
  submit: async () => unwrap(await api().POST("/shop/profile/submit")),
  withdraw: async () => unwrap(await api().POST("/shop/profile/withdraw")),
  pause: async () => unwrap(await api().POST("/shop/profile/pause")),
  resume: async () => unwrap(await api().POST("/shop/profile/resume")),
  stockRules: async (body: { lowStockThreshold?: number; autoHideOutOfStock?: boolean; mtoDaysDefault?: number }) => unwrap(await api().PUT("/shop/stock-rules", { body })),
  products: async () => unwrap(await api().GET("/shop/products")),
  product: async (id: string) => unwrap(await api().GET("/shop/products/{id}", { params: g(id) })),
  createProduct: async (body: ProductInput & { variants?: VariantInput[] }) => unwrap(await api().POST("/shop/products", { body })),
  updateProduct: async (id: string, body: Partial<ProductInput>) => unwrap(await api().PATCH("/shop/products/{id}", { params: g(id), body })),
  submitProduct: async (id: string) => unwrap(await api().POST("/shop/products/{id}/submit", { params: g(id) })),
  withdrawProduct: async (id: string) => unwrap(await api().POST("/shop/products/{id}/withdraw", { params: g(id) })),
  pauseProduct: async (id: string) => unwrap(await api().POST("/shop/products/{id}/pause", { params: g(id) })),
  resumeProduct: async (id: string) => unwrap(await api().POST("/shop/products/{id}/resume", { params: g(id) })),
  removeProduct: async (id: string) => unwrap(await api().POST("/shop/products/{id}/remove", { params: g(id) })),
  addVariant: async (id: string, body: VariantInput) => unwrap(await api().POST("/shop/products/{id}/variants", { params: g(id), body })),
  updateVariant: async (variantId: string, body: Omit<VariantInput, "attributes" | "openingStock">) => unwrap(await api().PATCH("/shop/variants/{id}", { params: g(variantId), body })),
  retireVariant: async (variantId: string) => unwrap(await api().POST("/shop/variants/{id}/retire", { params: g(variantId) })),
  /** One photo, sent raw; the API checks its first bytes. */
  uploadPhoto: async (id: string, file: File) =>
    unwrap(
      await api().POST("/shop/products/{id}/photos", {
        params: g(id),
        body: file as unknown as string,
        bodySerializer: (b: unknown) => b as BodyInit,
        headers: { "Content-Type": file.type },
      })
    ),
  orderPhotos: async (id: string, ids: string[]) => unwrap(await api().PUT("/shop/products/{id}/photos/order", { params: g(id), body: { ids } })),
  removePhoto: async (id: string, photoId: string) => unwrap(await api().POST("/shop/products/{id}/photos/{photoId}/remove", { params: { path: { id, photoId } } })),
  adjust: async (variantId: string, body: { delta?: number; setTo?: number; reasonCode: ReasonCode; reasonText?: string }) => unwrap(await api().POST("/shop/variants/{id}/adjust", { params: g(variantId), body })),
  movements: async (variantId: string) => unwrap(await api().GET("/shop/variants/{id}/movements", { params: { ...g(variantId), query: { limit: 50 } } })),
  /** shopId (Round B3): a shop the caller works at as staff; the owner leaves it out for their own shop. */
  inventory: async (status?: "low" | "out" | "mto" | "blocked", shopId?: string) => unwrap(await api().GET("/shop/inventory", { params: { query: { ...(status ? { status } : {}), ...(shopId ? { shopId } : {}) } } })),
  categories: async () => unwrap(await api().GET("/market/categories")),
  areas: async () => unwrap(await api().GET("/catalog/areas")),
};

/** The item types this shop type may sell (a category lists the shop types it allows). */
export function typesForShop(cats: Category[], shopType: ShopType): { category: Category; type: ItemType }[] {
  return cats.filter((c) => c.shopTypes.includes(shopType)).flatMap((category) => category.types.map((type) => ({ category, type })));
}

/** Spec form values → the API's specs (numbers as numbers; empty fields left out). */
export function specsFrom(fields: ItemField[], values: Record<string, string>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const f of fields.filter((x) => !x.isVariantAxis)) {
    const v = values[f.key]?.trim();
    if (!v) continue;
    out[f.key] = f.kind === "number" ? Number(v) : v;
  }
  return out;
}

/** "EU 43 · Black" for a variant (or "Standard"). */
export function variantLabel(fields: ItemField[], attributes: Record<string, string>, locale: string, standard: string): string {
  const parts = fields
    .filter((f) => f.isVariantAxis && attributes[f.key] !== undefined)
    .map((f) => {
      const o = f.options.find((x) => x.value === attributes[f.key]);
      return o ? (locale === "bn" ? o.labelBn : o.labelEn) : attributes[f.key];
    });
  return parts.length ? parts.join(" · ") : standard;
}

/** Taka text ("6500" or "6500.50") → poisha, or null. */
export function toPoisha(text: string): number | null {
  const m = /^\s*(\d+)(?:\.(\d{1,2}))?\s*$/.exec(text);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}
