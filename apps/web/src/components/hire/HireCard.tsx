"use client";

import { useLocale, useTranslations } from "next-intl";
import { Play } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Avatar, Badge } from "@kriraghor/ui/kit";
import type { Card } from "@/lib/hire";
import { percent, replyTime } from "@/lib/insights";
import { formatTaka } from "@/lib/payments";

/**
 * A directory card: photo (or initials), role, name, headline, experience, base area, rating and jobs,
 * "Available today" (FR-05: some time left today that is neither blocked nor booked), how fast they
 * reply and how often they accept (FR-52), and "from ৳X" per hour or match.
 */
export function HireCard({ card }: { card: Card }) {
  const t = useTranslations("hire");
  const locale = useLocale();
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const reply = replyTime(card.medianReplyMinutes);
  const accepts = percent(card.acceptanceRate, locale);
  return (
    <li>
      <Link href={`/hiring/${card.slug}`} className="flex h-full flex-col surface-card p-4 hover:border-brand" data-testid="hire-card">
        <span className="flex items-start gap-3">
          <Avatar name={card.name} src={card.avatarUrl} size={48} />
          <span className="min-w-0 flex-1">
            <span className="block break-words text-xs font-bold uppercase tracking-wide text-muted">{name(card.role)}</span>
            <span className="mt-0.5 block break-words text-lg font-extrabold leading-snug">{card.name}</span>
          </span>
        </span>
        <span className="mt-2 text-sm">{card.headline}</span>
        <span className="mt-2 flex flex-wrap items-center gap-1 text-xs font-semibold">
          {/* In the tag row, not beside the name: a long role (PHYSIOTHERAPIST) has no room to wrap there. */}
          {card.availableToday ? (
            <span data-testid="hire-available-today">
              <Badge tone="brand">{t("availableToday")}</Badge>
            </span>
          ) : null}
          <span className="bg-surface-2 px-2 py-0.5">{t(`level.${card.experienceLevel}`)}</span>
          {card.years ? <span className="bg-surface-2 px-2 py-0.5">{t("years", { n: card.years })}</span> : null}
          {card.area ? <span className="bg-surface-2 px-2 py-0.5">{name(card.area)}</span> : null}
          {card.hasIntroVideo ? (
            <span className="inline-flex items-center gap-1 bg-brand-soft px-2 py-0.5 text-brand-text" data-testid="hire-card-video">
              <Play size={12} weight="fill" aria-hidden />
              {t("video.badge")}
            </span>
          ) : null}
        </span>
        <span className="mt-2 text-sm text-muted">
          {card.ratingAvg !== null ? t("rating", { avg: card.ratingAvg.toFixed(1), n: card.ratingCount }) : t("noRating")} · {t("jobsDone", { n: card.jobsDone })}
        </span>
        {reply || accepts ? (
          <span className="mt-1 text-sm text-muted" data-testid="hire-card-stats">
            {[reply ? t(`repliesIn.${reply.unit}`, { n: reply.n }) : null, accepts ? t("accepts", { pct: accepts }) : null].filter(Boolean).join(" · ")}
          </span>
        ) : null}
        <span className="mt-auto pt-3 text-lg font-extrabold tabular-nums">
          {card.rateFrom !== null && card.rateUnit ? t(`from.${card.rateUnit}`, { price: formatTaka(card.rateFrom, locale) }) : t("noRates")}
        </span>
      </Link>
    </li>
  );
}
