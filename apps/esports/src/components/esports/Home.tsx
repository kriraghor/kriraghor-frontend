"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { dhakaTime, esports, takaOf } from "@/lib/esports";
import { events } from "@/lib/events";
import { Card, CardSkeleton, Countdown, Empty, LinkButton, Prize, SlotsBar } from "./bits";
import { EventCard } from "./EventList";

/**
 * esports.kriraghor.com home: a live or upcoming featured big event (M23) leads; otherwise the next big
 * tournament is the hero (a real card, not a picture of one). Open registrations, top players and how
 * it works follow. Esports leads (v3 priority 1).
 */
const DONE = ["results_pending", "finalised", "paid_out", "cancelled"];

export function Home() {
  const t = useTranslations("esports");
  const locale = useLocale();
  const open = useQuery({ queryKey: ["es-list", "open"], queryFn: () => esports.list({ status: "registration_open", limit: 8 }) });
  const featured = useQuery({ queryKey: ["es-list", "featured"], queryFn: () => esports.list({ featured: "true", limit: 10 }) });
  const top = useQuery({ queryKey: ["es-top"], queryFn: () => esports.topPlayers() });
  const bigEvents = useQuery({ queryKey: ["es-events", "featured"], queryFn: () => events.list({ featured: "true", limit: 3 }) });
  const heroEvent = bigEvents.data?.items.find((e) => e.phase === "live" || e.phase === "upcoming") ?? null;
  // Only a tournament still ahead or running leads the page; finished ones live in the lists and results.
  const hero = featured.data?.items.find((x) => !DONE.includes(x.status)) ?? open.data?.items[0] ?? null;

  return (
    <>
      <section className="bg-band text-band-text">
        <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:py-16">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-400">{t("home.kicker")}</p>
            <h1 className="mt-3 max-w-[18ch] text-4xl font-extrabold leading-[1.05] md:text-6xl" data-testid="home-title">
              {t("home.title")}
            </h1>
            <p className="mt-4 max-w-[52ch] text-lg text-band-text/80">{t("home.lead")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <LinkButton href="/events" tone="prize">
                {t("home.browse")}
              </LinkButton>
              <LinkButton href="/me/esports" tone="outline">
                <span className="text-band-text">{t("home.addUid")}</span>
              </LinkButton>
            </div>
          </div>
          <div>
            {heroEvent ? (
              <div data-testid="hero-event">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-400">{t("home.bigEvent")}</p>
                <div className="text-ink">
                  <EventCard e={heroEvent} big />
                </div>
              </div>
            ) : hero ? (
              <Link href={`/events/${hero.slug}`} className="block border-2 border-band-text/20 bg-band p-6 hover:border-amber-400" data-testid="hero-card">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-400">{hero.featured ? t("home.featured") : t("home.next")}</p>
                <h2 className="mt-2 text-2xl font-extrabold">{locale === "bn" ? hero.titleBn : hero.titleEn}</h2>
                <p className="mt-1 text-sm text-band-text/70">
                  {locale === "bn" ? hero.game?.nameBn : hero.game?.nameEn} · {dhakaTime(hero.startsAt, locale)}
                </p>
                <div className="mt-5 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs uppercase text-band-text/60">{t("prizePool")}</p>
                    <Prize money={hero.prizePool} className="text-2xl" />
                  </div>
                  <div>
                    <p className="text-xs uppercase text-band-text/60">{t("entryFee")}</p>
                    <p className="font-display text-2xl font-extrabold">{hero.entryFee.amount === 0 ? t("free") : takaOf(hero.entryFee, locale)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-band-text/60">{t("startsIn")}</p>
                    <p className="text-2xl font-extrabold">
                      <Countdown to={hero.startsAt} done={t("status.live")} />
                    </p>
                  </div>
                </div>
                <div className="mt-5 text-band-text">
                  <SlotsBar taken={hero.slotsTaken} max={hero.maxSlots} />
                </div>
              </Link>
            ) : featured.isPending || open.isPending ? (
              <div className="h-72 animate-pulse bg-band-text/10" />
            ) : (
              <div className="border-2 border-dashed border-band-text/30 p-8 text-band-text/80">{t("home.noneOpen")}</div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-12">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-extrabold md:text-3xl">{t("home.openNow")}</h2>
          <Link href="/events" className="font-semibold text-brand underline">
            {t("home.seeAll")}
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {open.isPending ? Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} />) : open.data?.items.map((item) => <Card key={item.id} t={item} />)}
        </div>
        {open.data && !open.data.items.length ? <Empty title={t("home.noneOpen")} body={t("home.noneOpenBody")} /> : null}
      </section>

      <section className="border-t-2 border-line bg-surface">
        <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-12 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-extrabold">{t("home.topPlayers")}</h2>
            <ol className="mt-4 divide-y-2 divide-line border-y-2 border-line" data-testid="top-players">
              {((top.data?.items ?? []) as { rank: number; userId: string; points: number; username: string | null; displayName: string | null }[]).map((p) => (
                <li key={`${p.userId}-${p.rank}`} className="flex items-center gap-4 py-3">
                  <span className="w-8 font-display text-2xl font-extrabold tabular-nums text-muted">{p.rank}</span>
                  <Link href={`/p/${p.username ?? p.userId}`} className="font-bold underline-offset-2 hover:underline">
                    {p.displayName ?? p.username ?? "—"}
                  </Link>
                  <span className="ml-auto text-sm tabular-nums text-muted">{t("points", { n: Math.round(p.points) })}</span>
                </li>
              ))}
              {top.data && !top.data.items.length ? <li className="py-4 text-muted">{t("home.noRankingsYet")}</li> : null}
            </ol>
            <Link href="/leaderboards" className="mt-3 inline-block font-semibold text-brand underline">
              {t("home.leaderboards")}
            </Link>
          </div>
          <div>
            <h2 className="text-2xl font-extrabold">{t("home.how")}</h2>
            <ol className="mt-4 space-y-4">
              {(["uid", "register", "checkin", "play"] as const).map((k, i) => (
                <li key={k} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-brand font-display text-lg font-extrabold text-white">{i + 1}</span>
                  <div>
                    <p className="font-bold">{t(`home.step.${k}.title`)}</p>
                    <p className="text-sm text-muted">{t(`home.step.${k}.body`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </>
  );
}
