"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Card } from "@/lib/hire";
import { formatTaka } from "@/lib/payments";

/** A directory card: role, name, headline, experience, base area, rating and jobs, and "from ৳X" per hour or match. */
export function HireCard({ card }: { card: Card }) {
  const t = useTranslations("hire");
  const locale = useLocale();
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  return (
    <li>
      <Link href={`/hiring/${card.slug}`} className="flex h-full flex-col border-2 border-line bg-surface p-4 hover:border-brand" data-testid="hire-card">
        <span className="text-xs font-bold uppercase tracking-wide text-muted">{name(card.role)}</span>
        <span className="mt-1 text-lg font-extrabold leading-snug">{card.name}</span>
        <span className="mt-1 text-sm">{card.headline}</span>
        <span className="mt-2 flex flex-wrap gap-1 text-xs font-semibold">
          <span className="bg-surface-2 px-2 py-0.5">{t(`level.${card.experienceLevel}`)}</span>
          {card.years ? <span className="bg-surface-2 px-2 py-0.5">{t("years", { n: card.years })}</span> : null}
          {card.area ? <span className="bg-surface-2 px-2 py-0.5">{name(card.area)}</span> : null}
        </span>
        <span className="mt-2 text-sm text-muted">
          {card.ratingAvg !== null ? t("rating", { avg: card.ratingAvg.toFixed(1), n: card.ratingCount }) : t("noRating")} · {t("jobsDone", { n: card.jobsDone })}
        </span>
        <span className="mt-auto pt-3 text-lg font-extrabold tabular-nums">
          {card.rateFrom !== null && card.rateUnit ? t(`from.${card.rateUnit}`, { price: formatTaka(card.rateFrom, locale) }) : t("noRates")}
        </span>
      </Link>
    </li>
  );
}
