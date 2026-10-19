"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { dayLabel } from "@/lib/bookings";
import { formatTaka } from "@/lib/payments";
import { statusTone, TONE, type Card } from "@/lib/tournaments";

/** A tournament in a list: sport, format, dates, fee, places and the organiser. */
export function TournamentCard({ t: x }: { t: Card }) {
  const t = useTranslations("tournaments");
  const locale = useLocale();
  const sport = locale === "bn" ? x.sport.nameBn : x.sport.nameEn;
  return (
    <Link href={`/events/${x.slug}`} className="flex h-full flex-col glass-card p-4 hover:border-brand" data-testid="tournament-card">
      <span className="flex items-start justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wide text-muted">
          {sport} · {t(`format.${x.format}`)}
        </span>
        <span className={`shrink-0 border-2 px-2 py-0.5 text-xs font-bold ${TONE[statusTone(x.status)]}`}>{t(`status.${x.status}`)}</span>
      </span>
      <span className="mt-2 text-lg font-extrabold leading-snug">{x.name}</span>
      {x.organisation ? <span className="text-sm text-muted">{t("by", { org: x.organisation.name })}</span> : null}
      <span className="mt-auto grid grid-cols-3 gap-2 pt-4 text-sm">
        <span>
          <span className="block text-muted">{t("starts")}</span>
          <span className="font-bold">{x.startDate ? dayLabel(x.startDate, locale) : "–"}</span>
        </span>
        <span>
          <span className="block text-muted">{t("fee")}</span>
          <span className="font-bold tabular-nums">{x.entryFeePoisha ? formatTaka(x.entryFeePoisha, locale) : t("free")}</span>
        </span>
        <span>
          <span className="block text-muted">{t("teams")}</span>
          <span className="font-bold tabular-nums">
            {x.approved}/{x.maxTeams}
          </span>
        </span>
      </span>
    </Link>
  );
}
