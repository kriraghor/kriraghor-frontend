"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import type { MarketCard } from "@/lib/market";
import { formatTaka } from "@/lib/payments";

/** A Market card: cover, title, "from ৳X" when variant prices differ (FR-32), the shop and its area. */
export function ProductCard({ card, badges }: { card: MarketCard; badges?: string[] }) {
  const t = useTranslations("market");
  const locale = useLocale();
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const price = formatTaka(card.priceFromPoisha, locale);
  return (
    <li>
      <Link href={`/shop/p/${card.slug}`} className="flex h-full flex-col glass-card hover:border-brand" data-testid="product-card">
        {card.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.coverUrl} alt="" loading="lazy" className="aspect-square w-full object-cover" />
        ) : (
          <span className="aspect-square w-full bg-surface-2" />
        )}
        <span className="flex flex-1 flex-col p-3">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">{card.itemType ? name(card.itemType as { nameEn: string; nameBn: string }) : t("newGear")}</span>
          <span className="mt-1 font-extrabold leading-snug">{card.title}</span>
          <span className="mt-1 text-sm text-muted">
            {card.shop.name}
            {card.shop.area ? ` · ${name(card.shop.area)}` : ""}
          </span>
          {badges?.length ? (
            <span className="mt-2 flex flex-wrap gap-1">
              {badges.map((b) => (
                <span key={b} className={`px-2 py-0.5 text-xs font-bold ${b === "price_dropped" ? "bg-brand/10 text-brand" : "bg-surface-2 text-muted"}`}>
                  {t(`badge.${b}`)}
                </span>
              ))}
            </span>
          ) : null}
          <span className="mt-auto pt-3 text-lg font-extrabold tabular-nums">{card.pricesVary ? t("from", { price }) : price}</span>
          {card.isMto ? <span className="text-xs text-muted">{t("madeToOrder")}</span> : null}
        </span>
      </Link>
    </li>
  );
}
