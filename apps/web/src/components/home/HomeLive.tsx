"use client";

import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "@phosphor-icons/react";
import { Skeleton } from "@kriraghor/ui/kit";
import { countdown } from "@/lib/home";
import { esportsHref } from "@/lib/links";
import { sectionItems } from "./section-data";
import { useOpenEsports } from "./queries";

// A one-second clock. The server snapshot is null, so the first client render matches the server
// HTML (no React #418) and the countdown starts ticking right after hydration.
const subscribe = (cb: () => void) => {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
};
const useNowSeconds = () => useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 1000), () => null);

/** The hero's right panel: only live numbers the API really gives, and the next esports event. */
export function HomeLive() {
  const t = useTranslations("home.live");
  const locale = useLocale();
  const open = useOpenEsports();
  // Shares its cache entry with the Sports events rail.
  const sports = useQuery({ queryKey: ["home-rail", "events"], queryFn: () => sectionItems.events() });
  const now = useNowSeconds();
  const next = open.data?.items[0];
  const left = next && now !== null ? countdown(next.startsAt, now * 1000) : null;
  const esportsCount = open.data ? `${open.data.items.length}${open.data.nextCursor ? "+" : ""}` : null;
  const sportsCount = sports.data ? String(sports.data.length) : null;
  const stat = (value: string | null, label: string) => (
    <div className="flex flex-col-reverse">
      <dt className="mt-1 text-sm text-white/75">{label}</dt>
      <dd>{value === null ? <Skeleton className="h-10 w-14 bg-white/15" /> : <span className="font-display text-4xl font-bold tabular-nums">{value}</span>}</dd>
    </div>
  );
  return (
    <aside className="glass-band flex flex-col gap-5 rounded-[24px] p-6" aria-labelledby="live-title">
      <h2 id="live-title" className="font-display text-lg font-bold">
        {t("title")}
      </h2>
      <dl className="grid grid-cols-2 gap-4">
        {stat(esportsCount, t("esports"))}
        {stat(sportsCount, t("sports"))}
      </dl>
      {next ? (
        <a href={esportsHref(`/events/${next.slug}`)} className="group block border-t border-white/15 pt-4 no-underline" data-testid="next-up">
          <span className="block text-sm text-white/75">{t("next")}</span>
          <span className="mt-1 flex items-center justify-between gap-3">
            <b className="min-w-0 truncate">{locale === "bn" ? next.titleBn : next.titleEn}</b>
            <ArrowRight size={18} aria-hidden className="shrink-0 transition-transform group-hover:translate-x-0.5" />
          </span>
          {left ? (
            <span className="mt-1 block font-display text-xl font-bold tabular-nums text-prize" data-testid="countdown">
              {left}
            </span>
          ) : null}
        </a>
      ) : open.isPending ? null : (
        <p className="border-t border-white/15 pt-4 text-sm text-white/75" data-testid="next-up-empty">
          {t("none")}
        </p>
      )}
    </aside>
  );
}
