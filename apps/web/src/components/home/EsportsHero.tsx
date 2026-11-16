"use client";

import { useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { countdown, filled, podium } from "@/lib/home";
import { esportsHref } from "@/lib/links";
import { formatTaka } from "@/lib/payments";
import { Flash } from "@kriraghor/ui/motion";
import { nameOf, useEsportsDetail, useOpenEsports } from "./queries";

// A one-second clock. The server snapshot is null, so the first client render matches the server
// HTML (no React #418) and the countdown starts ticking right after hydration.
const subscribe = (cb: () => void) => {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
};
const useNowSeconds = () => useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 1000), () => null);

/** "12 open for registration" over the hero headline; hidden until the count is known. */
export function OpenCount({ fallback }: { fallback?: string }) {
  const t = useTranslations("home.hero");
  const q = useOpenEsports();
  const n = q.data?.items.length ?? 0;
  if (!n) return fallback ? <span className="inline-flex min-h-8 items-center">{fallback}</span> : <span className="block h-8" aria-hidden />;
  return (
    <span className="inline-flex min-h-8 items-center gap-2 rounded-pill border border-band-line px-3 text-sm font-semibold">
      <span className="kg-pulse size-2 rounded-pill bg-live" aria-hidden />
      {t("openCount", { n, more: q.data?.nextCursor ? "+" : "" })}
    </span>
  );
}

/** The next tournament to start (home-v3 §1): countdown, entry, prizes and places taken. */
export function NextUp() {
  const t = useTranslations("home.hero");
  const locale = useLocale();
  const open = useOpenEsports();
  const next = open.data?.items[0];
  const detail = useEsportsDetail(next?.slug);
  const now = useNowSeconds();
  const money = (n: number) => formatTaka(n, locale);

  if (open.isPending) return <div className="h-[340px] kg-shimmer rounded-card bg-band-2" role="status" aria-label={t("loading")} />;
  if (!next) {
    return (
      <article className="glass-band flex flex-col gap-4 rounded-card p-6" data-testid="next-up-empty">
        <h2 className="text-2xl font-extrabold">{t("noneTitle")}</h2>
        <p className="text-band-muted">{t("noneBody")}</p>
        <a href={esportsHref("/events")} className="inline-flex min-h-12 w-fit items-center bg-prize px-5 font-bold text-prize-ink">
          {t("browse")}
        </a>
      </article>
    );
  }

  const places = podium(detail.data?.prizes);
  const map = detail.data?.matches?.find((m) => m.map)?.map;
  const left = now === null ? null : countdown(next.startsAt, now * 1000);
  const title = locale === "bn" ? next.titleBn : next.titleEn;
  const unit = t(next.entryUnit === "squad" ? "perSquad" : "perPlayer");
  const free = next.entryFee.amount === 0;

  return (
    <article className="rv glass-band flex flex-col gap-5 rounded-card p-6 shadow-lg" aria-labelledby="next-title" data-testid="next-up">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-band-muted">{[t("nextUp"), nameOf(next.game, locale), nameOf(next.mode, locale), nameOf(map, locale)].filter(Boolean).join(" · ")}</p>
          <h2 id="next-title" className="mt-1 text-2xl font-extrabold">
            {title}
          </h2>
        </div>
        <div className="text-right">
          <p className="text-sm text-band-muted">{t("startsIn")}</p>
          {/* Not announced every second (aria-live off); the start time is in the title. */}
          <b className="font-display text-2xl tabular-nums" aria-live="off" data-testid="countdown">
            {left ?? (now === null ? "--:--:--" : t("started"))}
          </b>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-4 border-y border-band-line py-4">
        <div>
          <dt className="text-sm text-band-muted">{t("entry")}</dt>
          <dd className="font-display text-2xl font-extrabold tabular-nums">{free ? t("free") : `${money(next.entryFee.amount)}`}</dd>
          {!free ? <dd className="text-sm text-band-muted">{unit}</dd> : null}
        </div>
        <div>
          <dt className="text-sm text-band-muted">{places.length ? t("firstPrize") : t("prizePool")}</dt>
          <dd className="font-display text-2xl font-extrabold tabular-nums text-prize">
            <Flash value={places[0]?.amount.amount ?? next.prizePool.amount}>{money(places[0]?.amount.amount ?? next.prizePool.amount)}</Flash>
          </dd>
          {places.length > 1 ? (
            <dd className="text-sm text-band-muted tabular-nums">
              {places
                .slice(1)
                .map((p) => t("place", { place: p.place, amount: money(p.amount.amount) }))
                .join(" · ")}
            </dd>
          ) : null}
        </div>
      </dl>
      <div>
        <div className="flex justify-between text-sm">
          <span>{t(next.entryUnit === "squad" ? "squadsIn" : "playersIn")}</span>
          <Flash value={next.slotsTaken}>
            <b className="tabular-nums">{t("ofMax", { taken: next.slotsTaken, max: next.maxSlots })}</b>
          </Flash>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-pill bg-band" role="progressbar" aria-label={t(next.entryUnit === "squad" ? "squadsIn" : "playersIn")} aria-valuemin={0} aria-valuemax={next.maxSlots} aria-valuenow={next.slotsTaken}>
          <i className="block h-full bg-prize transition-[width] duration-700" style={{ width: `${filled(next.slotsTaken, next.maxSlots) * 100}%` }} />
        </div>
        <p className="mt-3 text-sm text-band-muted">
          {next.killReward && next.killReward.amount > 0 ? `${t("perKill", { amount: money(next.killReward.amount) })} ` : ""}
          {t("roomNote")}
        </p>
      </div>
      <a href={esportsHref(`/events/${next.slug}`)} className="inline-flex min-h-12 items-center justify-center bg-prize px-5 font-bold text-prize-ink hover:brightness-95">
        {free ? t("registerFree") : t("register", { fee: money(next.entryFee.amount) })}
      </a>
    </article>
  );
}
