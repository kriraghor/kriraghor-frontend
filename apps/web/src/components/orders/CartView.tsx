"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { useAuth } from "@kriraghor/ui/auth";
import { orders, type Cart, type CartLine } from "@/lib/orders";
import { formatTaka } from "@/lib/payments";
import { MePanel } from "../MePanel";
import { Notice } from "@kriraghor/ui/primitives";

/**
 * /shop/cart (M13 FR-01, FR-02): lines grouped by shop with live prices (a changed price is marked),
 * quantity up to the stock and the per-order limit, remove, and lines that can no longer be bought.
 * Delivery is added per shop at checkout.
 */
export function CartView() {
  const t = useTranslations("orders");
  const locale = useLocale();
  const { status } = useAuth();
  const qc = useQueryClient();
  const cart = useQuery({ queryKey: ["cart"], queryFn: () => orders.cart(), enabled: status === "signed_in" });
  const set = (c: Cart) => qc.setQueryData(["cart"], c);
  const qty = useMutation({ mutationFn: ({ v, n }: { v: string; n: number }) => orders.setQty(v, n), onSuccess: set });
  const remove = useMutation({ mutationFn: (v: string) => orders.remove(v), onSuccess: set });
  const money = (n: number) => formatTaka(n, locale);

  if (status === "signed_out") return <MePanel />;
  if (cart.isPending) return <div className="rounded-control mx-auto mt-10 h-64 max-w-[1100px] kg-shimmer bg-surface-2" />;
  if (cart.isError) return <section className="mx-auto max-w-[1100px] px-5 py-10"><Notice tone="error">{t("failed")}</Notice></section>;
  const c = cart.data;
  const empty = c.shops.length === 0 && c.unavailable.length === 0;
  const name = (l: CartLine) => `${l.title ?? ""}${(locale === "bn" ? l.variantLabelBn : l.variantLabelEn) ? ` · ${locale === "bn" ? l.variantLabelBn : l.variantLabelEn}` : ""}`;

  return (
    <section className="mx-auto max-w-[1100px] px-5 py-10" data-testid="cart">
      <h1 className="text-3xl font-extrabold">{t("cartTitle")}</h1>
      {empty ? (
        <div className="mt-6">
          <p className="text-muted">{t("cartEmpty")}</p>
          <Link href="/shop" className="mt-3 inline-block font-semibold text-brand underline">
            {t("browse")}
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-6">
            {c.shops.map((g) => (
              <div key={g.shop.id} className="rounded-card border border-line" data-testid="cart-shop">
                <div className="flex items-baseline justify-between border-b-2 border-line px-4 py-3">
                  <Link href={`/shop/s/${g.shop.slug}`} className="font-extrabold hover:underline">
                    {g.shop.name}
                  </Link>
                  <span className="text-sm text-muted">{t("shopItems", { amount: money(g.items) })}</span>
                </div>
                <ul className="divide-y-2 divide-line">
                  {g.lines.map((l) => (
                    <li key={l.variantId} className="flex flex-wrap items-center gap-4 px-4 py-3" data-testid="cart-line">
                      {l.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.photoUrl} alt="" className="h-16 w-16 object-cover" />
                      ) : (
                        <div className="h-16 w-16 bg-surface-2" />
                      )}
                      <div className="min-w-0 flex-1">
                        <Link href={`/shop/p/${l.productSlug}`} className="font-semibold hover:underline">
                          {name(l)}
                        </Link>
                        <p className="text-sm text-muted">
                          {money(l.unitPrice ?? 0)}
                          {l.priceChanged ? <span className="ml-2 font-semibold text-ink" data-testid="price-changed">{t("priceWas", { price: money(l.addedPrice) })}</span> : null}
                          {l.isMto ? ` · ${t("mto", { days: l.mtoDays ?? 0 })}` : ""}
                        </p>
                        {l.unavailable ? <p className="text-sm text-danger">{t(`block.${l.block}`)}</p> : null}
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <span className="sr-only">{t("qty")}</span>
                        <select
                          value={l.qty}
                          onChange={(e) => qty.mutate({ v: l.variantId, n: Number(e.target.value) })}
                          className="min-h-11 field px-2"
                          disabled={qty.isPending || (l.maxQty ?? 0) < 1}
                          data-testid="cart-qty"
                        >
                          {Array.from({ length: Math.max(l.qty, l.maxQty ?? 1) }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n} disabled={n > (l.maxQty ?? n)}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className="w-24 text-right font-bold">{money(l.lineTotal ?? 0)}</span>
                      <button type="button" onClick={() => remove.mutate(l.variantId)} className="min-h-11 px-2 text-sm font-semibold text-brand underline" data-testid="cart-remove">
                        {t("remove")}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {c.unavailable.length ? (
              <div className="rounded-card border border-line p-4">
                <p className="font-semibold">{t("noLonger")}</p>
                <ul className="mt-2">
                  {c.unavailable.map((l) => (
                    <li key={l.variantId} className="flex items-center justify-between py-1 text-sm">
                      <span>{t("unavailableLine")}</span>
                      <button type="button" onClick={() => remove.mutate(l.variantId)} className="min-h-11 px-2 font-semibold text-brand underline">
                        {t("remove")}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <aside className="rounded-card h-fit border border-line p-5">
            <div className="flex justify-between text-lg font-extrabold">
              <span>{t("subtotal", { n: c.count })}</span>
              <span data-testid="cart-items">{money(c.items)}</span>
            </div>
            <p className="mt-2 text-sm text-muted">{t("deliveryNote")}</p>
            {c.ready ? (
              <Link href="/shop/checkout" className="mt-5 flex min-h-12 items-center justify-center bg-brand font-bold text-on-brand hover:bg-brand-hover" data-testid="go-checkout">
                {t("checkout")}
              </Link>
            ) : (
              <p className="mt-5 text-sm font-semibold text-danger">{t("fixCart")}</p>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
