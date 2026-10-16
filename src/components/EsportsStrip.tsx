"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/lib/api/client";
import { publicEnv } from "@/lib/env";
import { formatTaka } from "@/lib/payments";

type Card = { id: string; slug: string; titleEn: string; titleBn: string; game: { nameEn: string; nameBn: string } | null; entryFee: { amount: number }; prizePool: { amount: number }; maxSlots: number; slotsTaken: number; startsAt: string };
type Top = { rank: number; username: string | null; displayName: string | null; game: { nameEn: string | null }; points: number };

const dhaka = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/**
 * Home esports strip (M21, v3 priority 1): the next open tournaments and the top players, linking to
 * esports.kriraghor.com. Public reads; hidden when there is nothing to show.
 */
export function EsportsStrip() {
  const t = useTranslations("esportsStrip");
  const locale = useLocale();
  const base = publicEnv().ESPORTS_URL;
  const open = useQuery({
    queryKey: ["home-esports-open"],
    queryFn: async () => {
      const r = await api().GET("/esports/tournaments", { params: { query: { status: "registration_open", limit: 3 } } });
      if (r.error || !r.data) throw r.error;
      return r.data.items as unknown as Card[];
    },
  });
  const top = useQuery({
    queryKey: ["home-esports-top"],
    queryFn: async () => {
      const r = await api().GET("/esports/top-players");
      if (!r.data) throw new Error("top players unavailable");
      return (r.data as unknown as { items: Top[] }).items;
    },
  });
  const cards = open.data ?? [];
  const players = (top.data ?? []).filter((p) => p.username).slice(0, 5);

  return (
    <section className="bg-band text-band-text" aria-labelledby="esports-strip-title" data-testid="esports-strip">
      <div className="mx-auto max-w-[1320px] px-5 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-300">{t("kicker")}</p>
            <h2 id="esports-strip-title" className="mt-2 text-3xl font-extrabold">
              {t("title")}
            </h2>
          </div>
          <a href={`${base}/tournaments`} className="inline-flex min-h-12 items-center bg-amber-300 px-5 font-bold text-band">
            {t("all")}
          </a>
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <ul className="grid gap-4 md:grid-cols-3">
            {open.isPending
              ? [0, 1, 2].map((i) => <li key={i} className="h-44 animate-pulse bg-band-text/10" />)
              : cards.map((c) => (
                  <li key={c.id}>
                    <a href={`${base}/t/${c.slug}`} className="flex h-full flex-col border-2 border-band-text/20 p-4 hover:border-amber-300" data-testid="esports-strip-card">
                      <span className="text-xs font-semibold uppercase tracking-wide text-band-text/60">{locale === "bn" ? c.game?.nameBn : c.game?.nameEn}</span>
                      <span className="mt-1 text-lg font-extrabold leading-snug">{locale === "bn" ? c.titleBn : c.titleEn}</span>
                      <span className="mt-1 text-sm text-band-text/70">{dhaka(c.startsAt, locale)}</span>
                      <span className="mt-auto flex items-end justify-between gap-3 pt-4">
                        <span>
                          <span className="block text-xs uppercase text-band-text/60">{t("prizes")}</span>
                          <span className="text-2xl font-extrabold tabular-nums text-amber-300">{formatTaka(c.prizePool.amount, locale)}</span>
                        </span>
                        <span className="text-right text-sm">
                          <span className="block">{c.entryFee.amount === 0 ? t("free") : t("entry", { fee: formatTaka(c.entryFee.amount, locale) })}</span>
                          <span className="block text-band-text/60">{t("slots", { left: Math.max(0, c.maxSlots - c.slotsTaken) })}</span>
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
            {!open.isPending && !cards.length ? <li className="border-2 border-dashed border-band-text/30 p-6 text-band-text/80 md:col-span-3">{t("none")}</li> : null}
          </ul>
          <div>
            <h3 className="text-lg font-extrabold">{t("topPlayers")}</h3>
            <ol className="mt-3 divide-y divide-band-text/15 border-y border-band-text/15">
              {players.map((p) => (
                <li key={`${p.rank}-${p.username}`}>
                  <a href={`${base}/p/${p.username}`} className="flex min-h-12 items-center gap-3 py-2 hover:text-amber-300">
                    <span className="w-6 font-mono text-sm text-band-text/60">{p.rank}</span>
                    <span className="font-semibold">{p.displayName ?? p.username}</span>
                    <span className="text-xs text-band-text/60">{p.game.nameEn}</span>
                    <span className="ml-auto text-sm tabular-nums">{t("points", { n: p.points })}</span>
                  </a>
                </li>
              ))}
              {!top.isPending && !players.length ? <li className="py-3 text-sm text-band-text/70">{t("noPlayers")}</li> : null}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
