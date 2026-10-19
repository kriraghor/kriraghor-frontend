"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { dhakaTime, takaOf } from "@/lib/esports";
import { events, type EventCard as Card } from "@/lib/events";
import { Chip, Empty } from "./bits";

/** An event as a card: banner, phase, dates and the prize total (lists and the home hero). */
export function EventCard({ e, big = false }: { e: Card; big?: boolean }) {
  const t = useTranslations("esports.events");
  const locale = useLocale();
  return (
    <Link href={`/showcases/${e.slug}`} className="group block glass-card hover:border-line-strong" style={{ borderTopColor: e.accentHex, borderTopWidth: 6 }} data-testid="event-card">
      {e.bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.bannerUrl} alt="" className={`w-full object-cover ${big ? "h-44" : "h-32"}`} />
      ) : null}
      <div className="p-4">
        <div className="flex items-center gap-2">
          <Chip tone={e.phase === "live" ? "live" : "muted"}>{t(`phase.${e.phase}`)}</Chip>
          <span className="text-xs text-muted">{dhakaTime(e.startsAt, locale, { dateStyle: "medium" })}</span>
        </div>
        <h3 className={`mt-2 font-extrabold leading-tight ${big ? "text-2xl" : "text-lg"}`}>{locale === "bn" ? e.titleBn : e.titleEn}</h3>
        <p className="mt-2 text-sm text-muted">
          {t("prizeTotal")}: <span className="font-display font-extrabold text-ink">{takaOf(e.prizeTotal, locale)}</span>
        </p>
      </div>
    </Link>
  );
}

/** /events: live first, then upcoming, then ended. */
export function EventList() {
  const t = useTranslations("esports.events");
  const q = useQuery({ queryKey: ["es-events"], queryFn: () => events.list({ limit: 50 }) });
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-10">
      <h1 className="text-3xl font-extrabold md:text-4xl">{t("title")}</h1>
      <p className="mt-2 max-w-[60ch] text-muted">{t("lead")}</p>
      {q.isPending ? <div className="mt-6 h-48 animate-pulse bg-surface-2" /> : null}
      {q.data && !q.data.items.length ? <Empty title={t("none")} body={t("noneBody")} /> : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="event-list">
        {(q.data?.items ?? []).map((e) => (
          <EventCard key={e.id} e={e} />
        ))}
      </div>
    </section>
  );
}
