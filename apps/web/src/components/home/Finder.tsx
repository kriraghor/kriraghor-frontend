"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Handshake, SoccerBall, Storefront, Trophy } from "@phosphor-icons/react";
import { useRouter } from "@kriraghor/ui/i18n/navigation";
import { api } from "@kriraghor/api-client";
import { finderUrl, nextTab, type FinderTab, type FinderValues } from "@/lib/home";
import { isExternal } from "@/lib/links";
import { nameOf, useEsportsGames, type Named } from "./queries";

const TABS: { key: FinderTab; icon: ReactNode }[] = [
  { key: "tournaments", icon: <Trophy size={22} aria-hidden /> },
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
  const [values, setValues] = useState<Record<FinderTab, FinderValues>>({ tournaments: {}, grounds: {}, shop: {}, hire: {} });
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const games = useEsportsGames();
  const sports = useQuery({ queryKey: ["home-sports"], staleTime: 3600_000, enabled: tab === "grounds", queryFn: () => list<Named>(api().GET("/catalog/sports")) });
  const groundAreas = useQuery({ queryKey: ["home-areas", "grounds"], staleTime: 3600_000, enabled: tab === "grounds", queryFn: () => list<Area>(api().GET("/catalog/areas", { params: { query: { service: "grounds" } } })) });
  const hireAreas = useQuery({ queryKey: ["home-areas", "delivery"], staleTime: 3600_000, enabled: tab === "hire", queryFn: () => list<Area>(api().GET("/catalog/areas", { params: { query: { service: "delivery" } } })) });
  const taxonomy = useQuery({ queryKey: ["home-hire-taxonomy"], staleTime: 3600_000, enabled: tab === "hire", queryFn: () => list<Named>(api().GET("/hire/taxonomy")) });

  const v = values[tab];
  const set = (k: keyof FinderValues) => (e: { target: { value: string } }) => setValues((all) => ({ ...all, [tab]: { ...all[tab], [k]: e.target.value } }));
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

  const select = (id: string, label: string, k: keyof FinderValues, anyLabel: string, options: { value: string; label: string }[]) => (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1 text-sm font-semibold text-muted">
      {label}
      <select id={id} value={v[k] ?? ""} onChange={set(k)} className="min-h-12 w-full field px-3 text-base font-normal text-ink focus:border-brand">
        <option value="">{anyLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  const named = (items: (Named | Area)[] | undefined, value: "key" | "id") => (items ?? []).map((x) => ({ value: (x as Record<string, string>)[value], label: nameOf(x, locale) }));

  return (
    <section className="glass-strong relative z-10 -mt-16 overflow-hidden rounded-[28px]" aria-label={t("label")} data-testid="finder">
      <div role="tablist" aria-label={t("tabsLabel")} className="grid grid-cols-4 border-b border-[var(--glass-edge)] px-2 sm:flex">
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
            className={`-mb-0.5 flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 border-b-4 px-1 text-xs font-bold sm:flex-row sm:gap-2 sm:px-4 sm:text-sm ${tab === x.key ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {x.icon}
            {t(`tab.${x.key}`)}
          </button>
        ))}
      </div>
      <form id={`finder-panel-${tab}`} role="tabpanel" aria-labelledby={`finder-tab-${tab}`} onSubmit={go} className="grid gap-4 p-5 sm:grid-cols-2 md:grid-cols-[repeat(2,minmax(0,1fr))_auto] md:items-end">
        {tab === "tournaments" ? select("f-game", t("game"), "game", t("anyGame"), named(games.data?.items, "key")) : null}
        {tab === "grounds" ? (
          <>
            {select("f-sport", t("sport"), "sport", t("anySport"), named(sports.data, "key"))}
            {select("f-area", t("area"), "areaId", t("anyArea"), named(groundAreas.data, "id"))}
          </>
        ) : null}
        {tab === "shop" ? (
          <label htmlFor="f-q" className="flex min-w-0 flex-col gap-1 text-sm font-semibold text-muted sm:col-span-2">
            {t("search")}
            <input id="f-q" type="search" value={v.q ?? ""} onChange={set("q")} placeholder={t("searchPlaceholder")} autoComplete="off" enterKeyHint="search" className="min-h-12 w-full field px-3 text-base font-normal text-ink focus:border-brand" />
          </label>
        ) : null}
        {tab === "hire" ? (
          <>
            {select("f-category", t("need"), "category", t("anyone"), named(taxonomy.data, "key"))}
            {select("f-hire-area", t("area"), "areaId", t("anyArea"), named(hireAreas.data, "id"))}
          </>
        ) : null}
        <button type="submit" className={`inline-flex min-h-12 items-center justify-center gap-2 bg-brand px-5 font-bold text-white hover:bg-brand-hover ${tab === "tournaments" ? "md:col-start-3" : ""}`} data-testid="finder-go">
          {t(`go.${tab}`)}
          <ArrowRight size={18} aria-hidden />
        </button>
      </form>
    </section>
  );
}
