"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, GameController, Handshake, MagnifyingGlass, MapPin, SoccerBall, Storefront, Trophy } from "@phosphor-icons/react";
import { Dropdown } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { useRouter } from "@kriraghor/ui/i18n/navigation";
import { api } from "@kriraghor/api-client";
import { finderUrl, nextTab, type FinderTab, type FinderValues } from "@/lib/home";
import { isExternal } from "@/lib/links";
import { nameOf, useEsportsGames, type Named } from "./queries";

const TABS: { key: FinderTab; icon: ReactNode }[] = [
  { key: "tournaments", icon: <GameController size={22} aria-hidden /> },
  { key: "events", icon: <Trophy size={22} aria-hidden /> },
  { key: "grounds", icon: <SoccerBall size={22} aria-hidden /> },
  { key: "shop", icon: <Storefront size={22} aria-hidden /> },
  { key: "hire", icon: <Handshake size={22} aria-hidden /> },
];

type Area = { id: string; nameEn: string; nameBn: string };
const list = async <T,>(p: Promise<{ data?: unknown }>) => (((await p).data as { items?: T[] } | undefined)?.items ?? []) as T[];

/**
 * One search for every vertical (home-v3 §2): ARIA tabs with a roving tabindex, choices kept per
 * tab, and a shareable destination URL. Only filters the destination page supports are offered.
 */
export function Finder() {
  const t = useTranslations("home.finder");
  const locale = useLocale();
  const router = useRouter();
  const [tab, setTab] = useState<FinderTab>("tournaments");
  const [values, setValues] = useState<Record<FinderTab, FinderValues>>({ tournaments: {}, events: {}, grounds: {}, shop: {}, hire: {} });
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const games = useEsportsGames();
  const sports = useQuery({ queryKey: ["home-sports"], staleTime: 3600_000, enabled: tab === "grounds" || tab === "events", queryFn: () => list<Named>(api().GET("/catalog/sports")) });
  const groundAreas = useQuery({ queryKey: ["home-areas", "grounds"], staleTime: 3600_000, enabled: tab === "grounds", queryFn: () => list<Area>(api().GET("/catalog/areas", { params: { query: { service: "grounds" } } })) });
  const hireAreas = useQuery({ queryKey: ["home-areas", "delivery"], staleTime: 3600_000, enabled: tab === "hire", queryFn: () => list<Area>(api().GET("/catalog/areas", { params: { query: { service: "delivery" } } })) });
  const taxonomy = useQuery({ queryKey: ["home-hire-taxonomy"], staleTime: 3600_000, enabled: tab === "hire", queryFn: () => list<Named>(api().GET("/hire/taxonomy")) });

  const v = values[tab];
  const put = (k: keyof FinderValues, value: string) => setValues((all) => ({ ...all, [tab]: { ...all[tab], [k]: value } }));
  const set = (k: keyof FinderValues) => (e: { target: { value: string } }) => put(k, e.target.value);
  const go = (e: FormEvent) => {
    e.preventDefault();
    const href = finderUrl(tab, v);
    if (isExternal(href)) window.location.assign(href);
    else router.push(href);
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = nextTab(i, e.key, TABS.length);
    if (n === null) return;
    e.preventDefault();
    setTab(TABS[n].key);
    tabRefs.current[n]?.focus();
  };

  const select = (id: string, label: string, k: keyof FinderValues, anyLabel: string, options: { value: string; label: string }[], icon: ReactNode) => (
    <Dropdown id={id} label={label} value={v[k] ?? ""} onChange={(value) => put(k, value)} anyLabel={anyLabel} options={options.map((o) => ({ ...o, icon }))} testId={id} />
  );
  const named = (items: (Named | Area)[] | undefined, value: "key" | "id") => (items ?? []).map((x) => ({ value: (x as Record<string, string>)[value], label: nameOf(x, locale) }));

  return (
    <section className="glass-strong relative z-10 -mt-16 overflow-hidden rounded-card" aria-label={t("label")} data-testid="finder">
      {/* The five tabs, centred; the chosen one is a filled green pill. */}
      <div className="flex justify-center border-b border-[var(--glass-edge)] px-2 py-3">
      <div role="tablist" aria-label={t("tabsLabel")} className="grid w-full max-w-2xl grid-cols-5 gap-1 rounded-pill bg-surface-2 p-1">
        {TABS.map((x, i) => (
          <button
            key={x.key}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`finder-tab-${x.key}`}
            aria-selected={tab === x.key}
            aria-controls={`finder-panel-${x.key}`}
            tabIndex={tab === x.key ? 0 : -1}
            onClick={() => setTab(x.key)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-pill px-1 text-xs font-bold transition-[background-color,color,box-shadow] duration-200 sm:flex-row sm:gap-2 sm:px-4 sm:text-sm",
              tab === x.key ? "bg-brand text-on-brand shadow-[0_6px_18px_-8px_rgb(11_122_75/0.7)]" : "text-muted hover:bg-surface hover:text-ink",
            )}
          >
            {x.icon}
            {t(`tab.${x.key}`)}
          </button>
        ))}
      </div>
      </div>
      <form id={`finder-panel-${tab}`} role="tabpanel" aria-labelledby={`finder-tab-${tab}`} onSubmit={go} className="grid gap-4 p-5 sm:grid-cols-2 md:grid-cols-[repeat(2,minmax(0,1fr))_auto] md:items-end">
        {tab === "tournaments" ? select("f-game", t("game"), "game", t("anyGame"), named(games.data?.items, "key"), <GameController />) : null}
        {tab === "events" ? (
          <>
            {select("f-event-sport", t("sport"), "sport", t("anySport"), named(sports.data, "key"), <SoccerBall />)}
            <label htmlFor="f-event-q" className="flex min-w-0 flex-col gap-1 text-sm font-semibold text-muted">
              {t("eventSearch")}
              <span className="relative">
                <MagnifyingGlass size={20} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input id="f-event-q" type="search" value={v.q ?? ""} onChange={set("q")} placeholder={t("eventPlaceholder")} autoComplete="off" enterKeyHint="search" className="min-h-12 w-full field pl-11 pr-3 text-base font-normal text-ink" data-testid="f-event-q" />
              </span>
            </label>
          </>
        ) : null}
        {tab === "grounds" ? (
          <>
            {select("f-sport", t("sport"), "sport", t("anySport"), named(sports.data, "key"), <SoccerBall />)}
            {select("f-area", t("area"), "areaId", t("anyArea"), named(groundAreas.data, "id"), <MapPin />)}
          </>
        ) : null}
        {tab === "shop" ? (
          <label htmlFor="f-q" className="flex min-w-0 flex-col gap-1 text-sm font-semibold text-muted sm:col-span-2">
            {t("search")}
            <span className="relative">
              <MagnifyingGlass size={20} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input id="f-q" type="search" value={v.q ?? ""} onChange={set("q")} placeholder={t("searchPlaceholder")} autoComplete="off" enterKeyHint="search" className="min-h-12 w-full field pl-11 pr-3 text-base font-normal text-ink" />
            </span>
          </label>
        ) : null}
        {tab === "hire" ? (
          <>
            {select("f-category", t("need"), "category", t("anyone"), named(taxonomy.data, "key"), <Handshake />)}
            {select("f-hire-area", t("area"), "areaId", t("anyArea"), named(hireAreas.data, "id"), <MapPin />)}
          </>
        ) : null}
        <button type="submit" className={cn("inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-brand px-6 font-bold text-on-brand shadow-[0_6px_18px_-10px_rgb(11_122_75/0.7)] transition-colors hover:bg-brand-hover", tab === "tournaments" && "md:col-start-3")} data-testid="finder-go">
          {t(`go.${tab}`)}
          <ArrowRight size={18} aria-hidden />
        </button>
      </form>
    </section>
  );
}
