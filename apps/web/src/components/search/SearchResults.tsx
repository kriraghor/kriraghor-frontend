"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react";
import { Skeleton } from "@kriraghor/ui/kit";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { isExternal } from "@/lib/links";
import { searchGroups, type SectionKey } from "@/lib/home";
import { EsportsTile, EventTile, GymTile, HireTile, ProductTile, VenueTile } from "@/components/home/SectionCards";
import { SEARCH_MAX, sectionItems, type SectionItems } from "@/components/home/section-data";

const TILES: { [K in SectionKey]: (item: SectionItems[K]) => ReactNode } = {
  esports: (x) => <EsportsTile item={x} />,
  gym: (x) => <GymTile item={x} />,
  venues: (x) => <VenueTile item={x} />,
  shop: (x) => <ProductTile item={x} />,
  hire: (x) => <HireTile item={x} />,
  events: (x) => <EventTile item={x} />,
};

/** One search across the six sections: each group shows its best matches and leads to its own list page. */
export function SearchResults() {
  const t = useTranslations("search");
  const router = useRouter();
  const params = useSearchParams();
  const asked = params.get("q") ?? "";
  const groups = searchGroups(asked);
  const results = useQueries({ queries: groups.map((g) => ({ queryKey: ["search", g.key, g.text], queryFn: () => sectionItems[g.key](g.text) as Promise<unknown[]> })) });
  const done = results.length > 0 && results.every((r) => !r.isPending);
  const nothing = done && results.every((r) => !r.data?.length);
  const failed = results.some((r) => r.isError);

  return (
    <div className="mx-auto max-w-wide px-5 py-10" data-testid="search-page">
      <h1 className="text-[clamp(32px,4vw,48px)] font-extrabold leading-tight">{groups[0] ? t("titleFor", { q: groups[0].text }) : t("title")}</h1>
      <form
        key={asked}
        role="search"
        action="/search"
        className="surface-card mt-5 flex max-w-2xl gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
          router.replace(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
        }}
      >
        <label htmlFor="search-q" className="sr-only">
          {t("label")}
        </label>
        <span className="relative min-w-0 flex-1">
          <MagnifyingGlass size={20} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input id="search-q" name="q" type="search" defaultValue={asked} placeholder={t("hint")} autoComplete="off" enterKeyHint="search" maxLength={60} className="min-h-12 w-full field pl-11 pr-3 text-base text-ink" data-testid="search-input" />
        </span>
        <button type="submit" className="inline-flex min-h-12 items-center rounded-control bg-brand px-5 font-bold text-on-brand transition-colors hover:bg-brand-hover" data-testid="search-go">
          {t("go")}
        </button>
      </form>

      {!groups.length ? <p className="mt-6 text-muted">{asked.trim() ? t("tooShort") : t("prompt")}</p> : null}
      {nothing && !failed ? (
        <p className="mt-6 rounded-card border border-dashed border-line-strong/50 p-6 text-muted" data-testid="search-none">
          {t("none", { q: groups[0].text })}
        </p>
      ) : null}
      {failed ? (
        <p className="mt-6 text-sm text-muted" role="status">
          {t("partial")}
        </p>
      ) : null}

      {groups.map((g, i) => {
        const r = results[i];
        const items = (r?.data ?? []).slice(0, SEARCH_MAX);
        if (r && !r.isPending && !items.length) return null;
        const see = (
          <>
            {t("seeAll")} <ArrowRight size={16} aria-hidden />
          </>
        );
        const seeClass = "inline-flex min-h-11 items-center gap-1 font-bold text-brand-text underline-offset-4 hover:underline";
        return (
          <section key={g.key} className="mt-10" aria-labelledby={`search-${g.key}`} data-testid={`search-group-${g.key}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`search-${g.key}`} className="text-2xl font-extrabold">
                {t(`group.${g.key}`)}
              </h2>
              {isExternal(g.href) ? (
                <a href={g.href} className={seeClass}>
                  {see}
                </a>
              ) : (
                <Link href={g.href} className={seeClass}>
                  {see}
                </Link>
              )}
            </div>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {r?.isPending
                ? [0, 1, 2].map((n) => (
                    <li key={n}>
                      <Skeleton className="h-[316px] rounded-card" />
                    </li>
                  ))
                : items.map((item) => <li key={(item as { id: string }).id}>{(TILES[g.key] as (x: unknown) => ReactNode)(item)}</li>)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
