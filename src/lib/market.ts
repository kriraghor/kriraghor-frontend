import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

/**
 * Market on kriraghor.com (M12 step 1): browse shop products with filters and facet counts, the
 * product page (variant picker with live stock), the shop page and saved items. Checkout comes with
 * M13, so the product page shows the item and its stock only.
 */
export type MarketCard = components["schemas"]["MarketCard"];
export type ItemList = components["schemas"]["MarketItemList"];
export type ProductPage = components["schemas"]["MarketProductPage"];
export type ShopPage = components["schemas"]["MarketShopPage"];
export type Categories = components["schemas"]["MarketCategories"];
export type SavedList = components["schemas"]["SavedList"];
export type Sort = "newest" | "price" | "-price";
export type Filters = { category?: string; types?: string[]; priceMin?: number; priceMax?: number; areaId?: string; q?: string; sort?: Sort; cursor?: string };

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}

export const market = {
  list: async (f: Filters) =>
    ok(
      await api().GET("/market/items", {
        params: {
          query: {
            ...(f.category ? { category: f.category } : {}),
            ...(f.types?.length ? { types: f.types.join(",") as unknown as string[] } : {}),
            ...(f.priceMin !== undefined ? { priceMin: f.priceMin } : {}),
            ...(f.priceMax !== undefined ? { priceMax: f.priceMax } : {}),
            ...(f.areaId ? { areaId: f.areaId } : {}),
            ...(f.q ? { q: f.q } : {}),
            ...(f.sort ? { sort: f.sort } : {}),
            ...(f.cursor ? { cursor: f.cursor } : {}),
            limit: 24,
          },
        },
      })
    ),
  categories: async () => ok(await api().GET("/market/categories")),
  product: async (slug: string) => ok(await api().GET("/market/products/{slug}", { params: { path: { slug } } })),
  shop: async (slug: string, cursor?: string) => ok(await api().GET("/market/shops/{slug}", { params: { path: { slug }, query: { ...(cursor ? { cursor } : {}), limit: 24 } } })),
  areas: async () => ok(await api().GET("/catalog/areas", { params: { query: { service: "grounds" } } })),
  saved: async () => ok(await api().GET("/me/saved")),
  save: async (id: string) => ok(await api().PUT("/me/saved/{itemType}/{id}", { params: { path: { itemType: "product", id } } })),
  unsave: async (id: string) => ok(await api().DELETE("/me/saved/{itemType}/{id}", { params: { path: { itemType: "product", id } } })),
};

/** The price bands of the filter panel (taka). */
export const PRICE_BANDS = [
  { key: "lt2000", max: 200000 },
  { key: "2000to8000", min: 200000, max: 800000 },
  { key: "gt8000", min: 800000 },
] as const;

/** Filters ↔ URL search params, so a filtered list can be shared and the back button works. */
export function filtersFromParams(p: URLSearchParams): Filters {
  const num = (k: string) => (p.get(k) && /^\d+$/.test(p.get(k)!) ? Number(p.get(k)) : undefined);
  const sort = p.get("sort");
  const types = p.get("types")?.split(",").filter(Boolean);
  return {
    category: p.get("category") ?? undefined,
    types: types?.length ? types : undefined,
    priceMin: num("min"),
    priceMax: num("max"),
    areaId: p.get("area") ?? undefined,
    q: p.get("q") ?? undefined,
    sort: sort === "newest" || sort === "price" || sort === "-price" ? sort : undefined,
  };
}

export function paramsFromFilters(f: Filters): string {
  const p = new URLSearchParams();
  if (f.category) p.set("category", f.category);
  if (f.types?.length) p.set("types", f.types.join(","));
  if (f.priceMin !== undefined) p.set("min", String(f.priceMin));
  if (f.priceMax !== undefined) p.set("max", String(f.priceMax));
  if (f.areaId) p.set("area", f.areaId);
  if (f.q) p.set("q", f.q);
  if (f.sort) p.set("sort", f.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** The band that matches the price filters, if any. */
export function bandOf(f: Filters): string | undefined {
  return PRICE_BANDS.find((b) => ("min" in b ? b.min : undefined) === f.priceMin && ("max" in b ? b.max : undefined) === f.priceMax)?.key;
}

/** Variant choices: for each axis, its options and whether any variant with that value can be bought. */
export function axisChoices(page: Pick<ProductPage, "axes" | "variants">, picked: Record<string, string>) {
  return page.axes.map((axis) => ({
    axis,
    options: axis.options
      .filter((o) => page.variants.some((v) => v.attributes[axis.key] === o.value))
      .map((o) => {
        const others = Object.entries(picked).filter(([k]) => k !== axis.key);
        const matches = page.variants.filter((v) => v.attributes[axis.key] === o.value && others.every(([k, val]) => v.attributes[k] === val));
        return { option: o, available: matches.some((v) => v.purchasable) };
      }),
  }));
}

/** The variant matching every picked axis value (or the only one, for a Standard product). */
export function pickedVariant(page: Pick<ProductPage, "axes" | "variants">, picked: Record<string, string>) {
  if (!page.axes.length) return page.variants[0] ?? null;
  return page.variants.find((v) => page.axes.every((a) => v.attributes[a.key] === undefined || v.attributes[a.key] === picked[a.key])) ?? null;
}
