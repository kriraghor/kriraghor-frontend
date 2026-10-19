"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { axisChoices, market, pickedVariant } from "@/lib/market";
import { formatTaka } from "@/lib/payments";
import { ReportButton } from "../trust/ReportButton";
import { SaveButton } from "./SaveButton";
import { AddToCart } from "../orders/AddToCart";

/**
 * /shop/p/[slug] (M12 §4): gallery, variant-aware price, stock note ("Low stock", "Ships in N days",
 * "Out of stock"), the variant picker with sold-out options disabled, quantity up to the per-order
 * limit, specs, supplement details and the seller. Add to cart (M13) while the product and its shop
 * are live. A removed product answers 410.
 */
export function ProductView({ slug }: { slug: string }) {
  const t = useTranslations("market");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["product", slug], queryFn: () => market.product(slug), retry: false });
  const [photo, setPhoto] = useState(0);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  if (q.isPending) return <div className="mx-auto mt-10 h-96 max-w-[1320px] animate-pulse bg-surface-2" />;
  if (q.isError || !q.data) {
    const gone = problemOf(q.error)?.code === "PRODUCT_GONE";
    return (
      <section className="mx-auto max-w-[1320px] px-5 py-16">
        <h1 className="text-2xl font-extrabold">{gone ? t("gone") : t("notFound")}</h1>
        <Link href="/shop" className="mt-3 inline-block font-semibold text-brand underline">
          {t("back")}
        </Link>
      </section>
    );
  }
  const p = q.data;
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const label = (x: { labelEn: string; labelBn: string }) => (locale === "bn" ? x.labelBn : x.labelEn);
  const money = (n: number) => formatTaka(n, locale);
  const choices = axisChoices(p, picked).filter((c) => c.options.length);
  const variant = pickedVariant(p, picked);
  const stock = variant?.stock;
  const price = variant ? money(variant.pricePoisha) : p.priceFromPoisha !== p.priceToPoisha ? t("from", { price: money(p.priceFromPoisha) }) : money(p.priceFromPoisha);
  const maxQty = variant?.stock.code === "low" && variant.stock.available ? Math.min(p.maxQtyPerOrder, variant.stock.available) : p.maxQtyPerOrder;

  return (
    <section className="mx-auto max-w-[1320px] px-5 py-8">
      <Link href="/shop" className="text-sm font-semibold text-brand underline">
        ← {t("title")}
      </Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div>
          {p.photos.length ? (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.photos[photo]?.url} alt={t("photoOf", { name: p.title, n: photo + 1 })} className="aspect-square w-full object-cover sm:aspect-[4/3]" data-testid="product-photo" />
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {p.photos.map((ph, i) => (
                  <button key={ph.id} type="button" onClick={() => setPhoto(i)} aria-label={t("photoOf", { name: p.title, n: i + 1 })} aria-pressed={i === photo} className={`shrink-0 border-2 ${i === photo ? "border-brand" : "border-transparent"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ph.url} alt="" className="h-16 w-16 object-cover" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="aspect-[4/3] w-full bg-surface-2" />
          )}
          {p.description ? <p className="mt-6 max-w-3xl whitespace-pre-line">{p.description}</p> : null}
          {p.specs.length ? (
            <>
              <h2 className="mt-8 text-2xl font-extrabold">{t("specs")}</h2>
              <dl className="mt-3 grid max-w-2xl grid-cols-[minmax(0,1fr)_minmax(0,1fr)] border-t-2 border-line" data-testid="product-specs">
                {p.specs.map((s) => (
                  <div key={s.key} className="contents">
                    <dt className="border-b border-line py-2 text-muted">{label(s)}</dt>
                    <dd className="border-b border-line py-2 font-semibold">{locale === "bn" ? s.valueBn : s.valueEn}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}
          {p.supplement ? (
            <div className="mt-8 max-w-2xl border-2 border-line p-4" data-testid="supplement-info">
              <h2 className="font-extrabold">{t("supplementTitle")}</h2>
              <p className="mt-1 text-sm">{p.supplement.importer ? t("importer", { name: p.supplement.importer }) : null}</p>
              <p className="text-sm">{p.supplement.bstiRegNo ? t("bsti", { no: p.supplement.bstiRegNo }) : null}</p>
              {variant?.expiryDate ? <p className="mt-1 text-sm">{t("expires", { date: variant.expiryDate })}</p> : null}
            </div>
          ) : null}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              {p.category ? name(p.category) : ""}
              {p.itemType ? ` · ${name(p.itemType)}` : ""}
            </p>
            <h1 className="mt-1 text-3xl font-extrabold leading-tight" data-testid="product-title">
              {p.title}
            </h1>
            {p.brand ? <p className="text-muted">{p.brand}</p> : null}
            <p className="mt-3 text-3xl font-extrabold tabular-nums" data-testid="product-price">
              {price}
            </p>
            <p className="mt-1 text-sm font-semibold" role="status" data-testid="stock-note">
              {stock ? t(`stock.${stock.code}`, { n: stock.available ?? 0, days: stock.days ?? p.mtoDays ?? 0 }) : p.isMto ? t("stock.mto", { days: p.mtoDays ?? 0, n: 0 }) : t("pickOptions")}
            </p>
          </div>

          {choices.map(({ axis, options }) => (
            <fieldset key={axis.key}>
              <legend className="text-sm font-bold">{label(axis)}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {options.map(({ option, available }) => {
                  const on = picked[axis.key] === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={on}
                      disabled={!available}
                      onClick={() => setPicked({ ...picked, [axis.key]: option.value })}
                      className={`min-h-11 min-w-12 border-2 px-3 font-semibold disabled:cursor-not-allowed disabled:text-muted disabled:line-through ${on ? "border-brand bg-brand/10" : "border-line"}`}
                      data-testid={`option-${axis.key}-${option.value}`}
                    >
                      {label(option)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div className="flex items-end gap-3">
            <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
              {t("qty")}
              <select value={qty} onChange={(e) => setQty(Number(e.target.value))} className="min-h-12 field px-3 text-base text-ink" disabled={!variant?.purchasable}>
                {Array.from({ length: Math.max(1, maxQty) }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <AddToCart variantId={variant?.purchasable ? variant.id : null} qty={qty} open={p.checkoutOpen} />
          </div>
          {p.checkoutOpen ? null : <p className="text-sm text-muted">{t("checkoutSoon")}</p>}
          <SaveButton productId={p.id} />

          <div className="border-2 border-line p-4" data-testid="seller">
            <p className="text-sm text-muted">{t("soldBy")}</p>
            <Link href={`/shop/s/${p.shop.slug}`} className="text-lg font-extrabold hover:underline">
              {p.shop.name}
            </Link>
            <p className="text-sm text-muted">
              {t(`shopType.${p.shop.shopType}`)}
              {p.shop.area ? ` · ${name(p.shop.area)}` : ""}
            </p>
            <p className="mt-1 text-sm">{t("verifiedShop")}</p>
          </div>
          <ReportButton subjectType="product" subjectId={p.id} label={t("report")} />
        </aside>
      </div>
    </section>
  );
}
