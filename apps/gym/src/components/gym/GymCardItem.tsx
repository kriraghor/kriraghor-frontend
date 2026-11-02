"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { distanceText, type GymCard } from "@/lib/gym";
import { formatTaka } from "@kriraghor/ui/format";
import { RatingLine } from "@kriraghor/ui/trust";

/** A gym card: cover, name, area, distance (with Near me), facilities, day and monthly prices, open now, women-only hours. */
export function GymCardItem({ card }: { card: GymCard }) {
  const t = useTranslations("gym");
  const locale = useLocale();
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const money = (n: number) => formatTaka(n, locale);
  return (
    <li>
      <Link href={`/gyms/${card.slug}`} className="flex h-full flex-col glass-card hover:border-brand" data-testid="gym-card">
        {card.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.cover} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <span className="aspect-[4/3] w-full bg-surface-2" />
        )}
        <span className="flex flex-1 flex-col p-4">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
            <span className={card.openNow ? "text-brand" : "text-muted"}>{card.openNow ? t("openNow") : t("closedNow")}</span>
            {card.womenOnlyHours ? <span className="text-muted">· {t("womenOnly")}</span> : null}
          </span>
          <span className="mt-1 text-xl font-extrabold leading-snug">{card.name}</span>
          {card.area || card.distanceM !== null ? (
            <span className="text-sm text-muted" data-testid="gym-card-where">
              {[card.area ? name(card.area) : null, distanceText(card.distanceM, locale)].filter(Boolean).join(" · ")}
            </span>
          ) : null}
          <RatingLine avg={card.ratingAvg} count={card.ratingCount} className="text-sm text-muted" />
          {card.facilities.length ? (
            <span className="mt-3 flex flex-wrap gap-1">
              {card.facilities.slice(0, 4).map((f) => (
                <span key={f.id} className="bg-surface-2 px-2 py-0.5 text-xs font-semibold">
                  {name(f)}
                </span>
              ))}
            </span>
          ) : null}
          <span className="mt-auto grid grid-cols-2 gap-2 pt-4">
            {card.monthPrice !== null ? (
              <span>
                <span className="block text-xs text-muted">{t("monthly")}</span>
                <span className="text-lg font-extrabold tabular-nums">{money(card.monthPrice)}</span>
              </span>
            ) : null}
          </span>
        </span>
      </Link>
    </li>
  );
}
