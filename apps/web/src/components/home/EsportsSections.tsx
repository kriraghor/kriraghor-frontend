"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, HandSwipeLeft, Trophy } from "@phosphor-icons/react";
import { esportsHref } from "@/lib/links";
import { formatTaka } from "@/lib/payments";
import { Flash } from "@kriraghor/ui/motion";
import { nameOf, useEsportsGames, useOpenEsports, useTopPlayers } from "./queries";

const when = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/** "Open for registration" (home-v3 §3): game chips, three cards and "see all"; a swipe rail on phones. */
export function OpenTournaments() {
  const t = useTranslations("home.open");
  const locale = useLocale();
  const [game, setGame] = useState("");
  const games = useEsportsGames();
  const q = useOpenEsports(game);
  const cards = (q.data?.items ?? []).slice(0, 3);
  const money = (n: number) => formatTaka(n, locale);
  const chip = (key: string, label: string) => (
    <button key={key || "all"} type="button" aria-pressed={game === key} onClick={() => setGame(key)} className={`min-h-11 rounded-pill border-2 px-4 text-sm font-bold ${game === key ? "border-ink bg-ink text-bg" : "border-line hover:border-ink"}`}>
      {label}
    </button>
  );

  return (
    <section className="mx-auto max-w-[1320px] px-5 pt-[72px]" id="open" aria-labelledby="open-title" data-testid="open-tournaments">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="open-title" className="text-[clamp(28px,3.4vw,40px)] font-extrabold">
            {t("title")}
          </h2>
          <p className="mt-2 max-w-[60ch] text-muted">{t("sub")}</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("filter")}>
          {chip("", t("all"))}
          {(games.data?.items ?? []).map((g) => chip(g.key, nameOf(g, locale)))}
        </div>
      </div>
      <ul className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible md:grid-cols-4" aria-label={t("listLabel")}>
        {q.isPending
          ? [0, 1, 2].map((i) => <li key={i} className="h-72 w-[82%] shrink-0 animate-pulse rounded-[20px] bg-surface-2 sm:w-auto" />)
          : cards.map((c) => (
              <li key={c.id} className="rv w-[82%] shrink-0 snap-start sm:w-auto">
                <a href={esportsHref(`/events/${c.slug}`)} className="flex h-full flex-col glass-card p-5 hover:border-ink" data-testid="open-card">
                  <span className="flex justify-between gap-2 text-sm">
                    <b>{nameOf(c.game, locale)}</b>
                    <span className="text-muted">{nameOf(c.mode, locale)}</span>
                  </span>
                  <span className="mt-3 text-xl font-extrabold leading-snug">{locale === "bn" ? c.titleBn : c.titleEn}</span>
                  <span className="mt-auto pt-6">
                    <span className="block font-display text-3xl font-extrabold tabular-nums">
                      {money(c.prizePool.amount)} <small className="text-sm font-semibold text-muted">{t("pool")}</small>
                    </span>
                    <span className="mt-3 flex justify-between gap-2 border-t border-line pt-3 text-sm">
                      <span>{c.entryFee.amount === 0 ? t("free") : t(c.entryUnit === "squad" ? "perSquad" : "perPlayer", { fee: money(c.entryFee.amount) })}</span>
                      <Flash value={c.slotsTaken} className="tabular-nums text-muted">{t(c.entryUnit === "squad" ? "squads" : "players", { taken: c.slotsTaken, max: c.maxSlots })}</Flash>
                    </span>
                    <span className="mt-2 flex justify-between gap-2 text-sm">
                      <span>{when(c.startsAt, locale)}</span>
                      <span className="inline-flex items-center gap-1 font-bold text-brand-text">
                        {t("register")} <ArrowRight size={16} aria-hidden />
                      </span>
                    </span>
                  </span>
                </a>
              </li>
            ))}
        {!q.isPending && !cards.length ? <li className="w-full shrink-0 border-2 border-dashed border-line p-6 text-muted sm:col-span-2 md:col-span-3">{t("none")}</li> : null}
        <li className="rv w-[82%] shrink-0 snap-start sm:w-auto">
          <a href={esportsHref(game ? `/events?game=${encodeURIComponent(game)}` : "/events")} className="flex h-full min-h-72 flex-col rounded-[20px] bg-brand p-5 text-white shadow-lg hover:bg-brand-hover">
            <Trophy size={32} aria-hidden />
            <span className="mt-auto text-xl font-extrabold">{t("seeAll")}</span>
            <span className="mt-1 text-white/85">{t("seeAllSub")}</span>
            <span className="mt-4 inline-flex items-center gap-2 font-bold">
              {t("browse")} <ArrowRight size={18} aria-hidden />
            </span>
          </a>
        </li>
      </ul>
      <p className="mt-2 flex items-center gap-2 text-sm text-muted sm:hidden" aria-hidden>
        <HandSwipeLeft size={18} />
        {t("swipe")}
      </p>
    </section>
  );
}

/** "Top players this season" (home-v3 §4, M21-FR-28): #1 large, #2 to #5 small, then the leaderboard. */
export function TopPlayers() {
  const t = useTranslations("home.players");
  const locale = useLocale();
  const q = useTopPlayers();
  const players = (q.data?.items ?? []).filter((p) => p.username).slice(0, 5);
  const [first, ...rest] = players;
  const label = (p: (typeof players)[number]) => [`#${p.rank}`, nameOf(p.game, locale)].filter(Boolean).join(" · ");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="players-title" className="text-[clamp(28px,3.4vw,40px)] font-extrabold">
            {t("title")}
          </h2>
          <p className="mt-2 text-muted">{t("sub")}</p>
        </div>
        <a href={esportsHref("/leaderboards")} className="inline-flex min-h-11 items-center gap-1 font-bold text-brand-text underline">
          {t("full")} <ArrowRight size={16} aria-hidden />
        </a>
      </div>
      {q.isPending ? <div className="mt-6 h-64 animate-pulse rounded-[24px] bg-surface-2" /> : null}
      {!q.isPending && !first ? <p className="mt-6 rounded-[20px] border-2 border-dashed border-line p-6 text-muted">{t("none")}</p> : null}
      {first ? (
        <ol className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-[2fr_1fr_1fr]" data-testid="podium">
          <li className="rv col-span-2 flex flex-col justify-between gap-6 rounded-[24px] bg-band p-6 text-band-text shadow-lg sm:col-span-1 sm:row-span-2">
            <a href={esportsHref(`/p/${first.username}`)} className="flex h-full flex-col justify-between gap-6">
              <span>
                <span className="block text-sm text-band-muted">{label(first)}</span>
                <span className="mt-2 block font-display text-4xl font-extrabold">{first.displayName ?? first.username}</span>
                {first.team ? <span className="block text-sm text-band-muted">{first.team}</span> : null}
              </span>
              <span>
                <span className="block font-display text-3xl font-extrabold tabular-nums text-prize">{t("points", { n: first.points })}</span>
                {first.wins != null || first.kills != null ? <span className="block text-sm text-band-muted">{t("record", { wins: first.wins ?? 0, kills: first.kills ?? 0 })}</span> : null}
              </span>
            </a>
          </li>
          {rest.map((p) => (
            <li key={`${p.rank}-${p.username}`} className="rv glass-card p-4">
              <a href={esportsHref(`/p/${p.username}`)} className="flex h-full flex-col">
                <span className="text-sm text-muted">{label(p)}</span>
                <span className="mt-1 font-extrabold break-words">{p.displayName ?? p.username}</span>
                <span className="mt-auto pt-3 font-bold tabular-nums">{t("points", { n: p.points })}</span>
              </a>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
