"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { filtersFromParams, grounds, paramsFromFilters, type Filters, type GroundCard } from "@/lib/grounds";
import { formatTaka } from "@/lib/payments";

/**
 * /grounds (M09 §4.7, FR-25): live grounds with filters (sport, area, surface, facilities, indoor),
 * facet counts and sorts; the filters live in the URL. The slot board and booking come with M10.
 */
export function GroundsBrowse() {
  const t = useTranslations("grounds");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const f = filtersFromParams(new URLSearchParams(params.toString()));
  const q = useInfiniteQuery({
    queryKey: ["grounds", f],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => grounds.list({ ...f, cursor: pageParam }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const areas = useQuery({ queryKey: ["ground-areas"], queryFn: () => grounds.areas() });
  const first = q.data?.pages[0];
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const go = (next: Filters) => router.replace(`${pathname}${paramsFromFilters(next)}`, { scroll: false });
  const toggle = (list: string[] | undefined, key: string) => (list?.includes(key) ? list.filter((k) => k !== key) : [...(list ?? []), key]);
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const active = Boolean(f.sport || f.areaId || f.surface?.length || f.facilities?.length || f.indoor !== undefined);

  return (
    <section className="mx-auto max-w-[1320px] px-5 py-10">
      <h1 className="text-4xl font-extrabold" data-testid="grounds-title">
        {t("title")}
      </h1>
      <p className="mt-2 max-w-2xl text-muted">{t("lead")}</p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside aria-label={t("filters")} className="space-y-6">
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
          <Facet title={t("sport")} items={first?.facets.sports ?? []} isOn={(k) => f.sport === k} onToggle={(k) => go({ ...f, sport: f.sport === k ? undefined : k })} name={name} />
          <Facet title={t("surface")} items={first?.facets.surfaces ?? []} isOn={(k) => Boolean(f.surface?.includes(k))} onToggle={(k) => go({ ...f, surface: toggle(f.surface, k) })} name={name} />
          <Facet title={t("facilities")} items={first?.facets.facilities ?? []} isOn={(k) => Boolean(f.facilities?.includes(k))} onToggle={(k) => go({ ...f, facilities: toggle(f.facilities, k) })} name={name} />
          <fieldset>
            <legend className="text-sm font-bold">{t("where")}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {([undefined, true, false] as const).map((v) => (
                <button key={String(v)} type="button" aria-pressed={f.indoor === v} onClick={() => go({ ...f, indoor: v })} className={`min-h-10 border-2 px-3 text-sm font-semibold ${f.indoor === v ? "border-brand bg-brand/10" : "border-line"}`}>
                  {v === undefined ? t("anyPlace") : v ? t("indoor", { n: first?.facets.indoor.indoor ?? 0 }) : t("outdoor", { n: first?.facets.indoor.outdoor ?? 0 })}
                </button>
              ))}
            </div>
          </fieldset>
          {active ? (
            <button type="button" className="text-sm font-semibold text-brand underline" onClick={() => go({ sort: f.sort })}>
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
              <select value={f.sort ?? "cheapest"} onChange={(e) => go({ ...f, sort: e.target.value as Filters["sort"] })} className="min-h-11 border-2 border-line bg-surface px-2 text-ink">
                <option value="cheapest">{t("sort.cheapest")}</option>
                <option value="newest">{t("sort.newest")}</option>
                <option value="most_open">{t("sort.most_open")}</option>
              </select>
            </label>
          </div>
          {q.isPending ? (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-72 animate-pulse bg-surface-2" />
              ))}
            </ul>
          ) : q.isError ? (
            <div className="mt-6 border-2 border-danger p-6">
              <p className="font-bold">{t("error")}</p>
              <button type="button" className="mt-3 min-h-11 border-2 border-line px-4 font-bold" onClick={() => void q.refetch()}>
                {t("retry")}
              </button>
            </div>
          ) : !items.length ? (
            <div className="mt-6 border-2 border-dashed border-line p-10 text-center" data-testid="grounds-empty">
              <p className="text-lg font-bold">{t("empty")}</p>
              {active ? (
                <button type="button" className="mt-3 font-semibold text-brand underline" onClick={() => go({})}>
                  {t("clear")}
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="ground-cards">
              {items.map((g) => (
                <Card key={g.id} g={g} />
              ))}
            </ul>
          )}
          {q.hasNextPage ? (
            <button type="button" disabled={q.isFetchingNextPage} className="mt-6 min-h-12 border-2 border-line px-5 font-bold disabled:opacity-50" onClick={() => void q.fetchNextPage()}>
              {t("more")}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );

  function Card({ g }: { g: GroundCard }) {
    return (
      <li>
        <Link href={`/grounds/${g.slug}`} className="flex h-full flex-col border-2 border-line bg-surface hover:border-brand" data-testid="ground-card">
          {g.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={g.coverUrl} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover" />
          ) : (
            <span className="aspect-[16/10] w-full bg-surface-2" />
          )}
          <span className="flex flex-1 flex-col p-4">
            <span className="text-lg font-extrabold leading-snug">{g.name}</span>
            <span className="mt-1 text-sm text-muted">
              {g.area ? name(g.area) : ""} · {g.sports.map(name).join(", ")}
            </span>
            <span className="mt-1 text-sm text-muted">
              {t("courts", { n: g.courtsCount })} · {g.isIndoor ? t("indoorShort") : t("outdoorShort")}
              {g.surfaces[0] ? ` · ${name(g.surfaces[0])}` : ""}
            </span>
            {g.openHoursToday ? (
              <span className="mt-2 inline-block self-start bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand" data-testid="open-today">
                {t("openToday", { n: g.openHoursToday })}
              </span>
            ) : null}
            <span className="mt-auto pt-3 text-xl font-extrabold tabular-nums">{t("from", { price: formatTaka(g.priceFromPoisha, locale) })}</span>
          </span>
        </Link>
      </li>
    );
  }
}

function Facet({ title, items, isOn, onToggle, name }: { title: string; items: { key: string; nameEn: string; nameBn: string; count: number }[]; isOn: (k: string) => boolean; onToggle: (k: string) => void; name: (x: { nameEn: string; nameBn: string }) => string }) {
  if (!items.length) return null;
  return (
    <fieldset>
      <legend className="text-sm font-bold">{title}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((x) => (
          <button key={x.key} type="button" aria-pressed={isOn(x.key)} onClick={() => onToggle(x.key)} className={`min-h-10 border-2 px-3 text-sm font-semibold ${isOn(x.key) ? "border-brand bg-brand/10" : "border-line"}`}>
            {name(x)} <span className="text-muted">({x.count})</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
