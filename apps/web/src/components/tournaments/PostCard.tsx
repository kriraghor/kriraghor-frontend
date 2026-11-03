"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { CalendarBlank, ChatCircleText, MapPin, Trophy } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Badge } from "@kriraghor/ui/kit";
import { formatTaka } from "@/lib/payments";
import { PHOTOS } from "@/lib/photos";
import { dateRange, daysUntil } from "@/lib/tournament-dates";
import type { PostCard as Card } from "@/lib/tournament-posts";

/** Where a tournament is, smallest place first. */
export function placeOf(p: Pick<Card, "area" | "district">, locale: string) {
  const name = (x: { en: string; bn: string } | null) => (x ? (locale === "bn" ? x.bn : x.en) : null);
  return [name(p.area), name(p.district)].filter(Boolean).join(", ");
}

/** A tournament in the feed: poster, sport, dates, place, fee, deadline and how much talk it has. */
export function PostCard({ post: p }: { post: Card }) {
  const t = useTranslations("tournaments");
  const locale = useLocale();
  const sport = locale === "bn" ? p.sport.bn : p.sport.en;
  const left = daysUntil(p.registrationDeadline);
  return (
    <Link href={`/tournaments/${p.slug}`} className="glass-card group flex h-full flex-col overflow-hidden no-underline transition-colors hover:border-brand" data-testid="post-card">
      <span className="relative block aspect-[16/9] bg-surface-2">
        <Image src={p.cover ?? PHOTOS.tournaments} alt="" fill sizes="(min-width: 1180px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" unoptimized={Boolean(p.cover)} />
        <span className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge tone="brand">{sport}</Badge>
          {p.registrationOpen ? null : <Badge tone="neutral">{t("registrationClosed")}</Badge>}
        </span>
      </span>
      <span className="flex flex-1 flex-col p-4">
        <span className="font-display text-lg font-extrabold leading-snug text-ink">{p.title}</span>
        <span className="mt-0.5 text-sm text-muted">{t("by", { org: p.organiserName })}</span>
        <span className="mt-3 flex flex-col gap-1.5 text-sm text-ink">
          <span className="flex items-start gap-2">
            <CalendarBlank size={16} aria-hidden className="mt-0.5 shrink-0 text-muted" />
            {dateRange(p.startDate, p.endDate, locale)}
          </span>
          <span className="flex items-start gap-2">
            <MapPin size={16} aria-hidden className="mt-0.5 shrink-0 text-muted" />
            <span>{[p.venueName, placeOf(p, locale)].filter(Boolean).join(", ")}</span>
          </span>
          {p.prizePool ? (
            <span className="flex items-start gap-2">
              <Trophy size={16} aria-hidden className="mt-0.5 shrink-0 text-muted" />
              {t("prize", { amount: formatTaka(p.prizePool, locale) })}
            </span>
          ) : null}
        </span>
        <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-sm">
          <span className="font-bold tabular-nums text-ink">{p.entryFee ? t("fee", { amount: formatTaka(p.entryFee, locale) }) : t("free")}</span>
          <span className="inline-flex items-center gap-3 text-muted">
            {p.registrationOpen ? <span>{left === 0 ? t("closesToday") : t("closesIn", { n: left })}</span> : null}
            <span className="inline-flex items-center gap-1" aria-label={t("comments", { n: p.commentCount })}>
              <ChatCircleText size={16} aria-hidden />
              {p.commentCount}
            </span>
          </span>
        </span>
      </span>
    </Link>
  );
}
