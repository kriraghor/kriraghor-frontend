import { api } from "@/lib/api/client";
import { unwrap } from "./finance";

/**
 * Admin market (M12): shops and products for reviewers (approve_listings) and ops (manage_users);
 * suspend (manage_users), restore and remove (masters). Shop and product decisions are made on the
 * Moderation desk (kinds `shop` and `product`).
 */
export type Action = "suspend" | "restore" | "remove";
export type StaffShop = {
  id: string;
  slug: string;
  name: string;
  shopType: string;
  status: string;
  editStatus: string | null;
  liveVersion: number;
  addressLine: string;
  about: string | null;
  areaId: string;
  owner: { id: string; displayName: string | null };
  publicVersion?: Record<string, unknown> | null;
};
export type StaffProduct = Record<string, unknown> & { id: string; slug: string; title: string; status: string; editStatus: string | null; visibility: string; basePricePoisha: number };

export const marketAdmin = {
  shops: async (query: { status?: string; q?: string }) => unwrap(await api("admin").GET("/admin/market/shops", { params: { query: { ...(query as Record<string, never>), limit: 50 } } })),
  shop: async (id: string) => (await unwrap(await api("admin").GET("/admin/market/shops/{id}", { params: { path: { id } } }))) as unknown as StaffShop,
  products: async (query: { status?: string; q?: string; shopId?: string }) => unwrap(await api("admin").GET("/admin/market/products", { params: { query: { ...(query as Record<string, never>), limit: 50 } } })),
  product: async (id: string) => (await unwrap(await api("admin").GET("/admin/market/products/{id}", { params: { path: { id } } }))) as unknown as StaffProduct,
  act: async (what: "shops" | "products", id: string, action: Action, reason: string) => {
    const paths = {
      shops: { suspend: "/admin/market/shops/{id}/suspend", restore: "/admin/market/shops/{id}/restore", remove: "/admin/market/shops/{id}/remove" },
      products: { suspend: "/admin/market/products/{id}/suspend", restore: "/admin/market/products/{id}/restore", remove: "/admin/market/products/{id}/remove" },
    } as const;
    return unwrap(await api("admin").POST(paths[what][action], { params: { path: { id } }, body: { reason } }));
  },
};

/** The reviewer's diff of a product (submission payload) in plain lines. */
export type ProductDiff = { first: boolean; fields: { field: string; from: unknown; to: unknown }[]; prices?: { variantId: string; from: number; to: number }[]; photos?: { added: number; removed: number } };
export function productDiffLines(d: ProductDiff | undefined, t: (k: string, v?: Record<string, string | number>) => string, money: (n: number) => string): string[] {
  if (!d || d.first) return [t("diff.first")];
  const out = d.fields.map((f) => t("diff.field", { field: f.field, from: JSON.stringify(f.from ?? "–"), to: JSON.stringify(f.to ?? "–") }));
  for (const p of d.prices ?? []) out.push(t("diff.price", { from: money(p.from), to: money(p.to) }));
  if (d.photos?.added) out.push(t("diff.photosAdded", { n: d.photos.added }));
  if (d.photos?.removed) out.push(t("diff.photosRemoved", { n: d.photos.removed }));
  return out.length ? out : [t("diff.none")];
}

/** "S:Small:ছোট" lines → options. */
export function parseOptions(text: string): { value: string; labelEn: string; labelBn: string }[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [value, labelEn, labelBn] = l.split(":").map((x) => x.trim());
      return { value, labelEn: labelEn || value, labelBn: labelBn || labelEn || value };
    });
}

