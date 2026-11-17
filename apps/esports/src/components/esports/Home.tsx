"use client";

import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Crown, GameController, IdentificationCard, Sword, Trophy, UserCheck } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { SectionHeading } from "@kriraghor/ui/kit";
import { Reveal } from "@kriraghor/ui/motion";
import { dhakaTime, esports, takaOf } from "@/lib/esports";
import { events } from "@/lib/events";
import { Card, CardSkeleton, Countdown, Empty, LinkButton, Prize, SlotsBar } from "./bits";
import { EventCard } from "./EventList";

/**
 * esports.kriraghor.com home (UI v2, dark first): a live or upcoming featured big event (M23) leads;
 * otherwise the next big tournament is the hero (a real card, not a picture of one). Open registrations,
 * top players and how it works follow. Esports leads (v3 priority 1). The one orange action is
 * "Browse tournaments"; prize money is in the accent too.
 */
const DONE = ["results_pending", "finalised", "paid_out", "cancelled"];
const STEPS = [
  { key: "uid", icon: IdentificationCard },
  { key: "register", icon: Sword },
  { key: "checkin", icon: UserCheck },
  { key: "play", icon: GameController },
] as const;

type TopRow = { rank: number; userId: string; points: number; username: string | null; displayName: string | null };

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
  const players = (top.data?.items ?? []) as TopRow[];

  return (
    <Reveal>
      <section className="relative isolate overflow-hidden bg-band text-band-text">
        <Image src="/images/esports-mobile.jpg" alt="" fill priority sizes="100vw" className="-z-20 object-cover object-[60%_30%] opacity-55" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-band via-band/90 to-band/40" aria-hidden />
        {/* The logo's slant, as a glow behind the copy. */}
        <div className="absolute -left-24 top-0 -z-10 h-full w-[46%] -skew-x-[18deg] bg-gradient-to-b from-accent/25 via-accent/5 to-transparent blur-2xl" aria-hidden />
        <div className="kg-hero mx-auto grid max-w-[1320px] gap-10 px-5 py-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:py-20">
          <div className="kg-hero-item flex flex-col justify-center">
            <p className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-accent">
              <span className="kg-pulse size-2 rounded-pill bg-accent" aria-hidden />
              {t("home.kicker")}
            </p>
            <h1 className="mt-4 max-w-[16ch] text-[2.6rem] font-extrabold uppercase leading-[1.02] tracking-tight md:text-7xl [:lang(bn)_&]:leading-[1.3] [:lang(bn)_&]:tracking-normal" data-testid="home-title">
              {t("home.title")}
            </h1>
            <p className="mt-5 max-w-[52ch] text-lg text-band-text/80">{t("home.lead")}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <LinkButton href="/events" tone="prize">
                {t("home.browse")}
                <ArrowRight size={20} weight="bold" aria-hidden className="ml-2" />
              </LinkButton>
              <Link href="/me/esports" className="inline-flex min-h-12 items-center justify-center rounded-control border border-band-text/25 px-5 font-bold text-band-text transition-colors hover:bg-band-text/10">
                {t("home.addUid")}
              </Link>
            </div>
          </div>
          <div className="kg-hero-item">
            {heroEvent ? (
              <div data-testid="hero-event">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-accent">{t("home.bigEvent")}</p>
                <div className="text-ink">
                  <EventCard e={heroEvent} big />
                </div>
              </div>
            ) : hero ? (
              <Link href={`/events/${hero.slug}`} className="glass-band group block rounded-card p-6 shadow-lg transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-accent/60 md:p-7" data-testid="hero-card">
                <div className="flex items-center justify-between gap-3">
                  <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-accent">
                    <Trophy size={16} weight="fill" aria-hidden />
                    {hero.featured ? t("home.featured") : t("home.next")}
                  </p>
                  <ArrowRight size={20} aria-hidden className="text-band-text/50 transition-transform group-hover:translate-x-1 group-hover:text-accent" />
                </div>
                <h2 className="mt-3 text-2xl font-extrabold md:text-3xl">{locale === "bn" ? hero.titleBn : hero.titleEn}</h2>
                <p className="mt-1 text-sm text-band-text/70">
                  {locale === "bn" ? hero.game?.nameBn : hero.game?.nameEn} · {dhakaTime(hero.startsAt, locale)}
                </p>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="rounded-control bg-band-text/[0.06] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-band-text/60">{t("prizePool")}</p>
                    <Prize money={hero.prizePool} className="text-2xl !text-accent" />
                  </div>
                  <div className="rounded-control bg-band-text/[0.06] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-band-text/60">{t("entryFee")}</p>
                    <p className="font-display text-2xl font-extrabold">{hero.entryFee.amount === 0 ? t("free") : takaOf(hero.entryFee, locale)}</p>
                  </div>
                  <div className="rounded-control bg-band-text/[0.06] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-band-text/60">{t("startsIn")}</p>
                    <p className="text-xl font-extrabold md:text-2xl">
                      <Countdown to={hero.startsAt} done={t("status.live")} />
                    </p>
                  </div>
                </div>
                <div className="mt-5 text-band-text [&_.text-muted]:text-band-text/60 [&_[role=progressbar]]:bg-band-text/15">
                  <SlotsBar taken={hero.slotsTaken} max={hero.maxSlots} />
                </div>
              </Link>
            ) : featured.isPending || open.isPending ? (
              <div className="kg-shimmer h-72 rounded-card bg-band-text/10" />
            ) : (
              <div className="glass-band rounded-card border-dashed p-8 text-band-text/80">{t("home.noneOpen")}</div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-14">
        <SectionHeading
          size="display"
          title={t("home.openNow")}
          action={
            <Link href="/events" className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-control px-2 font-semibold text-brand-text hover:bg-surface-2">
              {t("home.seeAll")}
              <ArrowRight size={18} aria-hidden />
            </Link>
          }
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {open.isPending ? Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} />) : open.data?.items.map((item) => <Card key={item.id} t={item} />)}
        </div>
        {open.data && !open.data.items.length ? <Empty title={t("home.noneOpen")} body={t("home.noneOpenBody")} /> : null}
      </section>

      <section className="border-t border-line bg-surface/60">
        <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div>
            <SectionHeading size="display" title={t("home.topPlayers")} />
            <ol className="mt-6 surface-card divide-y divide-line overflow-hidden" data-testid="top-players">
              {players.map((p) => (
                <li key={`${p.userId}-${p.rank}`} className="rv flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-2">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-control font-display text-lg font-extrabold tabular-nums ${p.rank === 1 ? "bg-accent text-on-accent" : p.rank <= 3 ? "bg-accent-soft text-accent-text" : "bg-surface-2 text-muted"}`}>
                    {p.rank === 1 ? <Crown size={20} weight="fill" aria-label="1" /> : p.rank}
                  </span>
                  <Link href={`/p/${p.username ?? p.userId}`} className="min-w-0 truncate font-bold underline-offset-2 hover:underline">
                    {p.displayName ?? p.username ?? "—"}
                  </Link>
                  <span className="ml-auto whitespace-nowrap text-sm font-semibold tabular-nums text-muted">{t("points", { n: Math.round(p.points) })}</span>
                </li>
              ))}
              {top.isPending ? Array.from({ length: 5 }, (_, i) => <li key={i} className="kg-shimmer h-16 bg-surface-2/60" aria-hidden />) : null}
              {top.data && !players.length ? <li className="px-4 py-6 text-muted">{t("home.noRankingsYet")}</li> : null}
            </ol>
            <Link href="/leaderboards" className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 font-semibold text-brand-text hover:bg-surface-2">
              {t("home.leaderboards")}
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
          <div>
            <SectionHeading size="display" title={t("home.how")} />
            <ol className="mt-6 grid gap-3 sm:grid-cols-2">
              {STEPS.map(({ key, icon: Icon }, i) => (
                <li key={key} className="rv surface-card relative flex flex-col gap-3 overflow-hidden p-5">
                  <span className="absolute right-5 top-3 font-display text-5xl font-extrabold leading-none tabular-nums text-ink/10" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="grid size-11 place-items-center rounded-control bg-brand-soft text-brand-text">
                    <Icon size={24} weight="duotone" aria-hidden />
                  </span>
                  <div>
                    <p className="font-display text-lg font-bold">
                      <span className="sr-only">{i + 1}. </span>
                      {t(`home.step.${key}.title`)}
                    </p>
                    <p className="mt-1 text-sm text-muted">{t(`home.step.${key}.body`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </Reveal>
  );
}
