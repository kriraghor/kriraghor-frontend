"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { formatTaka } from "@/lib/admin/finance";
import { marketAdmin, productDiffLines, type ProductDiff } from "@/lib/admin/market";
import { Notice } from "@kriraghor/ui/primitives";

type Variant = { id: string; attributes: Record<string, string>; sku: string | null; pricePoisha: number; onHand: number; expiryDate: string | null; batchNo: string | null };
type Photo = { id: string; url: string };

/**
 * The `shop` panel on the Moderation desk (M12): what changed, then the working copy the reviewer is
 * approving: name, type, area, address and about. Checks, rubric and the decision are the desk's (M05).
 */
export function ShopPanel({ payload }: { payload: Record<string, unknown> }) {
  const t = useTranslations("marketAdmin");
  const id = String(payload.shopId);
  const q = useQuery({ queryKey: ["admin-shop", id], queryFn: () => marketAdmin.shop(id) });
  if (q.isPending) return <div className="mt-4 h-40 animate-pulse bg-surface-2" />;
  if (q.isError || !q.data) return <Notice tone="error">{t("loadFailed")}</Notice>;
  const s = q.data;
  const diff = payload.diff as { first: boolean; fields: { field: string; from: unknown; to: unknown }[] } | undefined;
  return (
    <div className="mt-6 space-y-4 border-t-2 border-line pt-4" data-testid="shop-panel">
      <div>
        <h3 className="font-bold">{payload.isEdit ? t("whatChanged") : t("firstReview")}</h3>
        <ul className="mt-1 list-disc pl-5 text-sm">
          {diff && !diff.first ? diff.fields.map((f) => <li key={f.field}>{t("diff.field", { field: f.field, from: JSON.stringify(f.from ?? "–"), to: JSON.stringify(f.to ?? "–") })}</li>) : <li>{t("diff.first")}</li>}
        </ul>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">{t("owner")}</dt>
        <dd className="font-semibold">{s.owner.displayName ?? "–"}</dd>
        <dt className="text-muted">{t("shopType")}</dt>
        <dd>{t(`type.${s.shopType}`)}</dd>
        <dt className="text-muted">{t("name")}</dt>
        <dd>{s.name}</dd>
        <dt className="text-muted">{t("address")}</dt>
        <dd>{s.addressLine}</dd>
        <dt className="text-muted">{t("about")}</dt>
        <dd className="whitespace-pre-line">{s.about ?? "–"}</dd>
      </dl>
    </div>
  );
}

/**
 * The `product` panel on the Moderation desk (M12): what changed (fields, prices, photos), then the
 * working copy: photos, specs, variants with prices, stock and (supplements) expiry and batch.
 */
export function ProductPanel({ payload }: { payload: Record<string, unknown> }) {
  const t = useTranslations("marketAdmin");
  const locale = useLocale();
  const id = String(payload.productId);
  const q = useQuery({ queryKey: ["admin-product", id], queryFn: () => marketAdmin.product(id) });
  if (q.isPending) return <div className="mt-4 h-40 animate-pulse bg-surface-2" />;
  if (q.isError || !q.data) return <Notice tone="error">{t("loadFailed")}</Notice>;
  const p = q.data;
  const money = (n: number) => formatTaka(n, locale);
  const lines = productDiffLines(payload.diff as ProductDiff | undefined, (k, v) => t(k, v), money);
  const shop = p.shop as { name: string; owner: { displayName: string | null } };
  return (
    <div className="mt-6 space-y-4 border-t-2 border-line pt-4" data-testid="product-panel">
      <div>
        <h3 className="font-bold">{payload.isEdit ? t("whatChanged") : t("firstReview")}</h3>
        <ul className="mt-1 list-disc pl-5 text-sm">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">{t("shop")}</dt>
        <dd className="font-semibold">
          {shop.name} · {shop.owner.displayName ?? "–"}
        </dd>
        <dt className="text-muted">{t("title")}</dt>
        <dd>{p.title}</dd>
        <dt className="text-muted">{t("brand")}</dt>
        <dd>{(p.brand as string | null) ?? "–"}</dd>
        <dt className="text-muted">{t("basePrice")}</dt>
        <dd>{money(p.basePricePoisha)}</dd>
        <dt className="text-muted">{t("specs")}</dt>
        <dd>
          {Object.entries(p.specs as Record<string, unknown>)
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join(" · ") || "–"}
        </dd>
        {p.importer || p.bstiRegNo ? (
          <>
            <dt className="text-muted">{t("supplement")}</dt>
            <dd>
              {(p.importer as string | null) ?? "–"} · {(p.bstiRegNo as string | null) ?? "–"}
            </dd>
          </>
        ) : null}
      </dl>
      <div className="grid grid-cols-3 gap-2">
        {(p.photos as Photo[]).map((ph, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={ph.id} src={ph.url} alt={t("photoN", { n: i + 1 })} className="aspect-square w-full border-2 border-line object-cover" />
        ))}
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-line">
            <th className="py-1 pr-2">{t("variant")}</th>
            <th className="py-1 pr-2">{t("price")}</th>
            <th className="py-1 pr-2">{t("stock")}</th>
            <th className="py-1">{t("expiry")}</th>
          </tr>
        </thead>
        <tbody>
          {(p.variants as Variant[]).map((v) => (
            <tr key={v.id} className="border-b border-line">
              <td className="py-1 pr-2">{Object.values(v.attributes).join(" · ") || t("standard")}</td>
              <td className="py-1 pr-2">{money(v.pricePoisha)}</td>
              <td className="py-1 pr-2">{v.onHand}</td>
              <td className="py-1">{v.expiryDate ? `${v.expiryDate} · ${v.batchNo ?? ""}` : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
