"use client";

import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname, useRouter } from "@kriraghor/ui/i18n/navigation";
import { filtersFromParams, hire, LEVELS, paramsFromFilters, SORTS, type Filters, type Level } from "@/lib/hire";
import { HireCard } from "./HireCard";
import { PageHeader } from "@kriraghor/ui/page-header";
import { PHOTOS } from "@/lib/photos";

/**
 * /hiring (M11 FR-01 to FR-07): players, umpires, scorers, coaches, physios and crew by category and
 * role, experience, how they are hired (by the hour or the match), base area and search; sorted by
 * rating, rate (the normalised hourly rate), jobs done or experience. The filters live in the URL.
 */
export function HireBrowse() {
  const t = useTranslations("hire");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const f = filtersFromParams(new URLSearchParams(params.toString()));
  const [q, setQ] = useState(f.q ?? "");
  const list = useInfiniteQuery({
    queryKey: ["hire", f],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => hire.list({ ...f, cursor: pageParam }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const tax = useQuery({ queryKey: ["hire-taxonomy"], queryFn: () => hire.taxonomy(), staleTime: 300_000 });
  const areas = useQuery({ queryKey: ["hire-areas"], queryFn: () => hire.areas(), staleTime: 300_000 });
  const first = list.data?.pages[0];
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const go = (next: Filters) => router.replace(`${pathname}${paramsFromFilters(next)}`, { scroll: false });
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const cat = tax.data?.items.find((c) => c.key === f.category);
  const active = Boolean(f.category || f.role || f.exp?.length || f.unit || f.areaId || f.q);
  const toggleExp = (l: Level) => (f.exp?.includes(l) ? f.exp.filter((x) => x !== l) : [...(f.exp ?? []), l]);
  const chip = (on: boolean) => `min-h-10 border-2 px-3 text-sm font-semibold ${on ? "border-brand bg-brand/10" : "border-line"}`;

  return (
    <section className="mx-auto max-w-[1320px] px-5 py-10">
      <PageHeader photo={PHOTOS.hire}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="mr-auto">
            <h1 className="text-4xl font-extrabold" data-testid="hire-title">
              {t("title")}
            </h1>
            <p className="mt-2 max-w-2xl text-muted">{t("lead")}</p>
          </div>
          <Link href="/me/hire" className="min-h-11 border-2 border-line px-4 py-2 font-bold hover:border-brand">
            {t("myHires")}
          </Link>
          <Link href="/pro" className="min-h-11 border-2 border-line px-4 py-2 font-bold hover:border-brand">
            {t("getHired")}
          </Link>
        </div>
      </PageHeader>

      <nav aria-label={t("categories")} className="mt-8">
        <ul className="flex gap-2 overflow-x-auto pb-1">
          <li>
            <button type="button" aria-pressed={!f.category} onClick={() => go({ ...f, category: undefined, role: undefined })} className={`min-h-11 whitespace-nowrap border-2 px-4 font-bold ${!f.category ? "border-brand bg-brand/10" : "border-line"}`}>
              {t("everyone")}
            </button>
          </li>
          {(tax.data?.items ?? []).map((c) => (
            <li key={c.key}>
              <button
                type="button"
                aria-pressed={f.category === c.key}
                onClick={() => go({ ...f, category: f.category === c.key ? undefined : c.key, role: undefined })}
                className={`min-h-11 whitespace-nowrap border-2 px-4 font-bold ${f.category === c.key ? "border-brand bg-brand/10" : "border-line"}`}
                data-testid={`hire-category-${c.key}`}
              >
                {name(c)} {first?.counts?.[c.key] !== undefined ? <span className="font-semibold text-muted">({first.counts[c.key]})</span> : null}
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
            <label htmlFor="hire-q" className="text-sm font-semibold text-muted">
              {t("search")}
            </label>
            <div className="flex">
              <input id="hire-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchHint")} className="min-h-12 w-full field px-3 text-base text-ink focus:border-brand" />
              <button type="submit" className="min-h-12 border-2 border-l-0 border-line px-3 font-bold">
                {t("go")}
              </button>
            </div>
          </form>
          {cat ? (
            <fieldset>
              <legend className="text-sm font-bold">{t("role")}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {cat.roles.map((r) => (
                  <button key={r.key} type="button" aria-pressed={f.role === r.key} onClick={() => go({ ...f, role: f.role === r.key ? undefined : r.key })} className={chip(f.role === r.key)}>
                    {name(r)}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}
          <fieldset>
            <legend className="text-sm font-bold">{t("experience")}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <button key={l} type="button" aria-pressed={Boolean(f.exp?.includes(l))} onClick={() => go({ ...f, exp: toggleExp(l) })} className={chip(Boolean(f.exp?.includes(l)))}>
                  {t(`level.${l}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-bold">{t("hiredBy")}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" aria-pressed={!f.unit} onClick={() => go({ ...f, unit: undefined })} className={chip(!f.unit)}>
                {t("anyUnit")}
              </button>
              {(["match", "hourly"] as const).map((u) => (
                <button key={u} type="button" aria-pressed={f.unit === u} onClick={() => go({ ...f, unit: u })} className={chip(f.unit === u)}>
                  {t(`unit.${u}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            {t("baseArea")}
            <select value={f.areaId ?? ""} onChange={(e) => go({ ...f, areaId: e.target.value || undefined })} className="min-h-12 field px-3 text-base text-ink">
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
              {first ? t("count", { n: first.total ?? items.length }) : ""}
            </p>
            <label className="ml-auto flex items-center gap-2 text-sm font-semibold text-muted">
              {t("sortBy")}
              <select value={f.sort ?? "rating"} onChange={(e) => go({ ...f, sort: e.target.value as Filters["sort"] })} className="min-h-11 field px-2 text-ink">
                {SORTS.map((s) => (
                  <option key={s} value={s}>
                    {t(`sort.${s}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {list.isPending ? (
            <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-48 animate-pulse bg-surface-2" />
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
            <div className="mt-6 border-2 border-dashed border-line p-10 text-center" data-testid="hire-empty">
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
            <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="hire-cards">
              {items.map((c) => (
                <HireCard key={c.id} card={c} />
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
