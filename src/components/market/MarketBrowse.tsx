"use client";

import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { PRICE_BANDS, bandOf, filtersFromParams, market, paramsFromFilters, type Filters } from "@/lib/market";
import { ProductCard } from "./ProductCard";
import { PageHeader } from "../PageHeader";

/**
 * /shop (M12 §4, FR-30 to FR-32): new gear from verified shops, sports gear, gym equipment and
 * supplements. Category tiles, filters (item type, price band, area), search and sort; the filters live
 * in the URL. Used gear from members comes with step 2.
 */
export function MarketBrowse() {
  const t = useTranslations("market");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const f = filtersFromParams(new URLSearchParams(params.toString()));
  const [q, setQ] = useState(f.q ?? "");
  const list = useInfiniteQuery({
    queryKey: ["market", f],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => market.list({ ...f, cursor: pageParam }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const cats = useQuery({ queryKey: ["market-categories"], queryFn: () => market.categories(), staleTime: 300_000 });
  const areas = useQuery({ queryKey: ["market-areas"], queryFn: () => market.areas(), staleTime: 300_000 });
  const first = list.data?.pages[0];
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const go = (next: Filters) => router.replace(`${pathname}${paramsFromFilters(next)}`, { scroll: false });
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const active = Boolean(f.category || f.types?.length || f.priceMin !== undefined || f.priceMax !== undefined || f.areaId || f.q);
  const counts = new Map((first?.facets.categories ?? []).map((c) => [c.key, c.count]));
  const band = bandOf(f);
  const toggleType = (k: string) => (f.types?.includes(k) ? f.types.filter((x) => x !== k) : [...(f.types ?? []), k]);

  return (
    <section className="mx-auto max-w-[1320px] px-5 py-10">
      <PageHeader photo="shopGear">
        <div className="flex flex-wrap items-end gap-4">
          <div className="mr-auto">
            <h1 className="text-4xl font-extrabold" data-testid="market-title">
              {t("title")}
            </h1>
            <p className="mt-2 max-w-2xl text-muted">{t("lead")}</p>
          </div>
          <Link href="/shop/saved" className="min-h-11 border-2 border-line px-4 py-2 font-bold hover:border-brand">
            {t("savedLink")}
          </Link>
        </div>
      </PageHeader>

      <nav aria-label={t("categories")} className="mt-8">
        <ul className="flex gap-2 overflow-x-auto pb-1">
          <li>
            <button type="button" aria-pressed={!f.category} onClick={() => go({ ...f, category: undefined, types: undefined })} className={`min-h-11 whitespace-nowrap border-2 px-4 font-bold ${!f.category ? "border-brand bg-brand/10" : "border-line"}`}>
              {t("everything")}
            </button>
          </li>
          {(cats.data?.items ?? []).map((c) => (
            <li key={c.key}>
              <button
                type="button"
                aria-pressed={f.category === c.key}
                onClick={() => go({ ...f, category: f.category === c.key ? undefined : c.key, types: undefined })}
                className={`min-h-11 whitespace-nowrap border-2 px-4 font-bold ${f.category === c.key ? "border-brand bg-brand/10" : "border-line"}`}
                data-testid={`category-${c.key}`}
              >
                {name(c)} {counts.has(c.key) ? <span className="font-semibold text-muted">({counts.get(c.key)})</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside aria-label={t("filters")} className="space-y-6">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              go({ ...f, q: q.trim().length >= 2 ? q.trim() : undefined });
            }}
            className="flex flex-col gap-1"
          >
            <label htmlFor="market-q" className="text-sm font-semibold text-muted">
              {t("search")}
            </label>
            <div className="flex">
              <input id="market-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchHint")} className="min-h-12 w-full border-2 border-line bg-surface px-3 text-base text-ink focus:border-brand" />
              <button type="submit" className="min-h-12 border-2 border-l-0 border-line px-3 font-bold">
                {t("go")}
              </button>
            </div>
          </form>
          {first?.facets.itemTypes.length ? (
            <fieldset>
              <legend className="text-sm font-bold">{t("itemType")}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {first.facets.itemTypes.map((x) => (
                  <button key={x.key} type="button" aria-pressed={Boolean(f.types?.includes(x.key))} onClick={() => go({ ...f, types: toggleType(x.key) })} className={`min-h-10 border-2 px-3 text-sm font-semibold ${f.types?.includes(x.key) ? "border-brand bg-brand/10" : "border-line"}`}>
                    {name(x)} <span className="text-muted">({x.count})</span>
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}
          <fieldset>
            <legend className="text-sm font-bold">{t("price")}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" aria-pressed={!band && f.priceMin === undefined && f.priceMax === undefined} onClick={() => go({ ...f, priceMin: undefined, priceMax: undefined })} className={`min-h-10 border-2 px-3 text-sm font-semibold ${!band && f.priceMin === undefined && f.priceMax === undefined ? "border-brand bg-brand/10" : "border-line"}`}>
                {t("anyPrice")}
              </button>
              {PRICE_BANDS.map((b) => (
                <button key={b.key} type="button" aria-pressed={band === b.key} onClick={() => go({ ...f, priceMin: "min" in b ? b.min : undefined, priceMax: "max" in b ? b.max : undefined })} className={`min-h-10 border-2 px-3 text-sm font-semibold ${band === b.key ? "border-brand bg-brand/10" : "border-line"}`}>
                  {t(`band.${b.key}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            {t("area")}
            <select value={f.areaId ?? ""} onChange={(e) => go({ ...f, areaId: e.target.value || undefined })} className="min-h-12 border-2 border-line bg-surface px-3 text-base text-ink">
              <option value="">{t("anyArea")}</option>
              {(areas.data?.items ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {name(a)}
                </option>
              ))}
            </select>
          </label>
          {active ? (
            <button
              type="button"
              className="text-sm font-semibold text-brand underline"
              onClick={() => {
                setQ("");
                go({ sort: f.sort });
              }}
            >
              {t("clear")}
            </button>
          ) : null}
        </aside>

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted" role="status">
              {first ? t("count", { n: first.total }) : ""}
            </p>
            <label className="ml-auto flex items-center gap-2 text-sm font-semibold text-muted">
              {t("sortBy")}
              <select value={f.sort ?? "newest"} onChange={(e) => go({ ...f, sort: e.target.value as Filters["sort"] })} className="min-h-11 border-2 border-line bg-surface px-2 text-ink">
                <option value="newest">{t("sort.newest")}</option>
                <option value="price">{t("sort.price")}</option>
                <option value="-price">{t("sort.-price")}</option>
              </select>
            </label>
          </div>
          {list.isPending ? (
            <ul className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="h-72 animate-pulse bg-surface-2" />
              ))}
            </ul>
          ) : list.isError ? (
            <div className="mt-6 border-2 border-danger p-6">
              <p className="font-bold">{t("error")}</p>
              <button type="button" className="mt-3 min-h-11 border-2 border-line px-4 font-bold" onClick={() => void list.refetch()}>
                {t("retry")}
              </button>
            </div>
          ) : !items.length ? (
            <div className="mt-6 border-2 border-dashed border-line p-10 text-center" data-testid="market-empty">
              <p className="text-lg font-bold">{t("empty")}</p>
              {active ? (
                <button
                  type="button"
                  className="mt-3 font-semibold text-brand underline"
                  onClick={() => {
                    setQ("");
                    go({});
                  }}
                >
                  {t("clear")}
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4" data-testid="market-cards">
              {items.map((c) => (
                <ProductCard key={c.id} card={c} />
              ))}
            </ul>
          )}
          {list.hasNextPage ? (
            <button type="button" disabled={list.isFetchingNextPage} className="mt-6 min-h-12 border-2 border-line px-5 font-bold disabled:opacity-50" onClick={() => void list.fetchNextPage()}>
              {t("more")}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
