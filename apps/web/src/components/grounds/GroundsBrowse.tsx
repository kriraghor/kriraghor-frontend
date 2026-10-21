"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, CalendarBlank, Faders, MapPin, NavigationArrow, SquaresFour, Rows, X } from "@phosphor-icons/react";
import { Link, usePathname, useRouter } from "@kriraghor/ui/i18n/navigation";
import { Badge, Button, ButtonLink, Checkbox, Chip, Dropdown, EmptyState, ErrorState, SegmentedControl, Sheet, Skeleton } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { grounds, filtersFromParams, paramsFromFilters, type Filters, type GroundCard, type Origin } from "@/lib/grounds";
import { bookings, dhakaDate, daysBetween } from "@/lib/bookings";
import { DISTANCES, PRICE_BANDS, TIMES_OF_DAY, estimate, hourSlots, pickHref, toggleHour, type HourSlot, type Pick, type PriceBand, type TimeOfDay } from "@/lib/venue-board";
import { hourLabel } from "@/lib/grounds";
import { formatTaka } from "@/lib/payments";
import { PHOTOS } from "@/lib/photos";

const noop = () => () => undefined;
/** Today on the Dhaka clock, read on the client (the page is not tied to the server's day). */
const useToday = () => useSyncExternalStore(noop, () => dhakaDate(Date.now()), () => "");

/**
 * /venues, after the Claude Design "Grounds" page (M09/M10): a day strip, time of day and "distance
 * from" on top; filters at the side (a sheet on phones); a slot board where each venue's open hours
 * for the chosen day can be tapped into one booking, or photo cards. Every choice is in the URL
 * except the visitor's own location, which stays in the page.
 */
export function GroundsBrowse() {
  const t = useTranslations("grounds");
  const tb = useTranslations("grounds.browse");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const f = filtersFromParams(new URLSearchParams(params.toString()));
  const today = useToday();
  const [here, setHere] = useState<Origin>(null);
  const [locating, setLocating] = useState<"idle" | "asking" | "denied">("idle");
  const [sheet, setSheet] = useState(false);
  const [pick, setPick] = useState<Pick | null>(null);

  const areas = useQuery({ queryKey: ["ground-areas"], queryFn: () => grounds.areas() });
  const nearArea = f.near ? areas.data?.items.find((a) => a.id === f.near) : undefined;
  const origin: Origin = here ?? (nearArea ? { lat: nearArea.lat, lng: nearArea.lng } : null);
  const sort = f.sort ?? (origin ? "nearest" : "cheapest");
  const date = f.date ?? today;
  const time: TimeOfDay = f.time ?? "all";
  const view = f.view ?? "board";

  const q = useInfiniteQuery({
    queryKey: ["grounds", { ...f, view: undefined, date: undefined, time: undefined }, origin?.lat, origin?.lng, sort],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => grounds.list({ ...f, sort, cursor: pageParam }, origin),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const first = q.data?.pages[0];
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const go = (next: Filters) => {
    setPick(null);
    router.replace(`${pathname}${paramsFromFilters(next)}`, { scroll: false });
  };
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const money = (n: number) => formatTaka(n, locale);
  const activeCount = [f.sport, f.price, f.km, f.indoor !== undefined ? 1 : undefined, ...(f.surface ?? []), ...(f.facilities ?? []), f.areaId].filter(Boolean).length;

  const locate = () => {
    if (!("geolocation" in navigator)) return setLocating("denied");
    setLocating("asking");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setHere({ lat: Math.round(p.coords.latitude * 1000) / 1000, lng: Math.round(p.coords.longitude * 1000) / 1000 });
        setLocating("idle");
        go({ ...f, near: undefined });
      },
      () => setLocating("denied"),
      { maximumAge: 600_000, timeout: 10_000 },
    );
  };

  const days = today ? daysBetween(today, new Date(Date.parse(`${today}T00:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10)) : [];
  const dayParts = (d: string) => {
    const at = new Date(`${d}T12:00:00Z`);
    const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { ...o, timeZone: "UTC" }).format(at);
    return { week: d === today ? tb("today") : fmt({ weekday: "short" }), num: fmt({ day: "numeric" }) };
  };
  const dayTitle = date === today ? tb("titleToday") : tb("titleOn", { day: new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)) });

  const filters = (
    <VenueFilters
      f={f}
      facets={first?.facets}
      hasOrigin={Boolean(origin)}
      name={name}
      money={money}
      areas={(areas.data?.items ?? []).map((a) => ({ value: a.id, label: name(a) }))}
      onChange={go}
    />
  );

  return (
    <div data-testid="venues-page" className={cn(pick && "pb-24")}>
      {/* The design's green bar: day, time of day, distance from. Sticks under the header on desktop. */}
      <div className="relative z-30 border-b lg:sticky lg:top-[68px] border-band-line bg-band text-band-text shadow-md">
        <div className="mx-auto flex max-w-wide flex-col gap-3 px-5 py-3 lg:flex-row lg:items-center lg:gap-6">
          <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none] lg:mx-0 lg:px-0" role="radiogroup" aria-label={tb("day")}>
            {days.map((d) => {
              const on = d === date;
              const p = dayParts(d);
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => go({ ...f, date: d === today ? undefined : d })}
                  className={cn("flex min-h-12 min-w-14 shrink-0 flex-col items-start justify-center rounded-control border px-2.5 text-left leading-tight transition-colors", on ? "border-band-text bg-band-text text-band" : "border-band-line hover:border-band-text/60")}
                  data-testid={`day-${d}`}
                >
                  <span className="text-[11px] font-semibold opacity-80">{p.week}</span>
                  <span className="font-display text-lg font-bold tabular">{p.num}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:ml-0">
            <div className="flex gap-1 rounded-control bg-band-text/10 p-1" role="radiogroup" aria-label={tb("time.label")}>
              {TIMES_OF_DAY.map((x) => (
                <button
                  key={x}
                  type="button"
                  role="radio"
                  aria-checked={time === x}
                  onClick={() => go({ ...f, time: x === "all" ? undefined : x })}
                  className={cn("min-h-10 whitespace-nowrap rounded-[9px] px-3 text-sm font-semibold transition-colors", time === x ? "bg-band-text text-band" : "text-band-text/85 hover:text-band-text")}
                >
                  {tb(`time.${x}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
            <span className="hidden text-sm text-band-muted xl:inline">{tb("distanceFrom")}</span>
            <div className="w-48 [&_button]:border-band-line [&_button]:bg-band-2 [&_button]:text-band-text [&_label]:sr-only">
              <Dropdown
                id="near"
                label={tb("distanceFrom")}
                value={here ? "__here__" : (f.near ?? "")}
                onChange={(v) => {
                  if (v === "__here__") return;
                  setHere(null);
                  go({ ...f, near: v || undefined, km: v ? f.km : undefined });
                }}
                anyLabel={tb("anywhere")}
                options={[...(here ? [{ value: "__here__", label: tb("myLocation"), icon: <NavigationArrow /> }] : []), ...(areas.data?.items ?? []).map((a) => ({ value: a.id, label: name(a), icon: <MapPin /> }))]}
                testId="near"
              />
            </div>
            <button type="button" onClick={locate} disabled={locating === "asking"} className="inline-flex min-h-12 items-center gap-2 rounded-control border border-band-line px-3 text-sm font-semibold hover:border-band-text/60 disabled:opacity-60" data-testid="use-location">
              <NavigationArrow size={18} aria-hidden />
              <span className="hidden sm:inline">{locating === "asking" ? tb("locating") : tb("useLocation")}</span>
            </button>
          </div>
        </div>
        {locating === "denied" ? <p className="mx-auto max-w-wide px-5 pb-2 text-sm text-band-muted">{tb("locationDenied")}</p> : null}
      </div>

      <div className="mx-auto grid max-w-wide gap-8 px-5 py-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
        <aside aria-label={t("filters")} className="hidden lg:block">
          <h2 className="border-b-2 border-ink pb-3 text-xl">{t("filters")}</h2>
          <div className="mt-5">{filters}</div>
        </aside>

        <div className="min-w-0">
          <h1 className="text-[clamp(32px,4.4vw,52px)] leading-tight" data-testid="grounds-title">
            {dayTitle}
          </h1>
          <p className="mt-2 max-w-[60ch] text-muted">{tb("lead")}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-b-2 border-ink pb-4">
            <p className="font-semibold" role="status">
              {first ? t("count", { n: first.total }) : ""}
            </p>
            <Button type="button" variant="secondary" size="sm" className="lg:hidden" icon={<Faders size={18} aria-hidden />} onClick={() => setSheet(true)} data-testid="filters-button">
              {activeCount ? tb("filtersCount", { n: activeCount }) : tb("filters")}
            </Button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <SegmentedControl<"board" | "cards">
                size="sm"
                label={tb("view.label")}
                value={view}
                onChange={(v) => go({ ...f, view: v === "board" ? undefined : v })}
                options={[
                  { value: "board", label: tb("view.board"), icon: <Rows size={16} aria-hidden />, testId: "view-board" },
                  { value: "cards", label: tb("view.cards"), icon: <SquaresFour size={16} aria-hidden />, testId: "view-cards" },
                ]}
              />
              <div className="w-44 [&_label]:sr-only">
                <Dropdown
                  id="sort"
                  label={t("sortBy")}
                  value={sort}
                  onChange={(v) => go({ ...f, sort: (v || undefined) as Filters["sort"] })}
                  options={[
                    ...(origin ? [{ value: "nearest", label: tb("nearest") }] : []),
                    { value: "cheapest", label: t("sort.cheapest") },
                    { value: "most_open", label: t("sort.most_open") },
                    { value: "newest", label: t("sort.newest") },
                  ]}
                />
              </div>
            </div>
          </div>

          {view === "board" && items.length ? <Legend /> : null}

          {q.isPending ? (
            <div className="mt-4 flex flex-col gap-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 rounded-card" />
              ))}
            </div>
          ) : q.isError ? (
            <ErrorState className="mt-6" onRetry={() => void q.refetch()} />
          ) : !items.length ? (
            <EmptyState
              className="mt-6"
              icon={<CalendarBlank />}
              title={t("empty")}
              action={
                activeCount ? (
                  <Button type="button" variant="secondary" onClick={() => go({ date: f.date, time: f.time, view: f.view })}>
                    {t("clear")}
                  </Button>
                ) : undefined
              }
            />
          ) : view === "board" ? (
            <SlotBoard items={items} date={date} time={time} pick={pick} onPick={setPick} name={name} money={money} />
          ) : (
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="ground-cards">
              {items.map((g) => (
                <VenueCard key={g.id} g={g} name={name} money={money} />
              ))}
            </ul>
          )}
          {q.hasNextPage ? (
            <Button type="button" variant="secondary" className="mt-6" busy={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
              {t("more")}
            </Button>
          ) : null}
        </div>
      </div>

      <Sheet open={sheet} onOpenChange={setSheet} side="bottom" title={t("filters")}>
        <div className="px-5 pb-4">{filters}</div>
        <div className="sticky bottom-0 border-t border-line bg-surface px-5 py-3">
          <Button type="button" block size="lg" onClick={() => setSheet(false)}>
            {tb("show", { n: first?.total ?? 0 })}
          </Button>
        </div>
      </Sheet>

      {pick ? <PickBar pick={pick} items={items} date={date} onClear={() => setPick(null)} money={money} /> : null}
    </div>
  );
}

function Legend() {
  const tb = useTranslations("grounds.browse");
  const item = (cls: string, label: string) => (
    <span className="inline-flex items-center gap-2">
      <span className={cn("size-3.5 rounded-[4px] border", cls)} aria-hidden />
      {label}
    </span>
  );
  return (
    <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted" aria-hidden>
      {item("border-line-strong bg-surface", tb("legend.open"))}
      {item("border-brand bg-brand", tb("legend.selected"))}
      {item("border-transparent bg-surface-2", tb("legend.booked"))}
      {item("border-prize bg-prize", tb("legend.yours"))}
    </p>
  );
}

const CELL: Record<string, string> = {
  open: "border-line-strong/50 bg-surface text-ink hover:border-brand hover:text-brand-text",
  booked: "border-transparent bg-surface-2 text-muted/70 line-through",
  yours: "border-prize bg-prize text-prize-ink",
  past: "border-transparent bg-surface-2/60 text-muted/50 line-through",
  closed: "border-transparent bg-surface-2/60 text-muted/50",
};

function SlotBoard({ items, date, time, pick, onPick, name, money }: { items: GroundCard[]; date: string; time: TimeOfDay; pick: Pick | null; onPick: (p: Pick | null) => void; name: (x: { nameEn: string; nameBn: string }) => string; money: (n: number) => string }) {
  const tb = useTranslations("grounds.browse");
  const t = useTranslations("grounds");
  const locale = useLocale();
  const grids = useQueries({ queries: items.map((g) => ({ queryKey: ["availability", g.id, date], queryFn: () => bookings.availability(g.id, date), staleTime: 60_000, refetchInterval: 60_000 })) });
  const km = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
  return (
    <ul className="mt-3 divide-y divide-line" data-testid="slot-board">
      {items.map((g, i) => {
        const slots: HourSlot[] = hourSlots(grids[i]?.data, time);
        const mine = pick?.groundId === g.id ? new Set(pick.hours) : null;
        return (
          <li key={g.id} className="grid gap-3 py-4 md:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] md:items-center md:gap-5" data-testid="board-row">
            <Link href={`/venues/${g.slug}`} className="group flex items-center gap-3.5 no-underline">
              <span className="relative size-16 shrink-0 overflow-hidden rounded-[12px] bg-surface-2">
                {g.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.coverUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : (
                  <Image src={PHOTOS.groundsFloodlit} alt="" fill sizes="64px" className="object-cover" />
                )}
              </span>
              <span className="min-w-0">
                <b className="block font-display text-lg leading-tight group-hover:text-brand-text">{g.name}</b>
                <span className="block truncate text-sm text-muted">
                  {[g.area ? name(g.area) : null, g.distanceM != null ? km(g.distanceM) : null].filter(Boolean).join(", ")}
                </span>
                <span className="block text-sm font-bold tabular">{t("page.perHourShort", { price: money(g.priceFromPoisha) })}</span>
              </span>
            </Link>
            <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:px-0" role="group" aria-label={tb("hoursOf", { name: g.name })}>
              {grids[i]?.isPending ? (
                <Skeleton className="h-11" />
              ) : !slots.length ? (
                <p className="py-2 text-sm text-muted">{tb("noHours")}</p>
              ) : (
                <div className="flex gap-1.5">
                  {slots.map((s) => {
                    const on = mine?.has(s.hour) ?? false;
                    return (
                      <button
                        key={s.hour}
                        type="button"
                        disabled={s.state !== "open"}
                        aria-pressed={on}
                        onClick={() => onPick(toggleHour(pick, g.id, s.hour, slots))}
                        className={cn("min-h-11 min-w-[52px] shrink-0 rounded-[10px] border px-1.5 text-xs font-semibold tabular transition-colors disabled:cursor-not-allowed", on ? "border-brand bg-brand text-on-brand" : CELL[s.state])}
                        data-state={on ? "selected" : s.state}
                      >
                        {hourText(s.hour, locale)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const hourText = (h: number, locale: string) => (locale === "bn" ? hourLabel(h).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]) : hourLabel(h));

/** "Venue · 6–8 pm · about ৳1,800 · Continue", above the phone tab bar. */
function PickBar({ pick, items, date, onClear, money }: { pick: Pick; items: GroundCard[]; date: string; onClear: () => void; money: (n: number) => string }) {
  const tb = useTranslations("grounds.browse");
  const locale = useLocale();
  const g = items.find((x) => x.id === pick.groundId);
  const grid = useQuery({ queryKey: ["availability", pick.groundId, date], queryFn: () => bookings.availability(pick.groundId, date), enabled: Boolean(g) });
  const slots = hourSlots(grid.data);
  if (!g) return null;
  const lo = Math.min(...pick.hours), hi = Math.max(...pick.hours) + 1;
  const href = pickHref(g.slug, pick, slots);
  return (
    <div className="fixed inset-x-3 bottom-[calc(80px+env(safe-area-inset-bottom))] z-40 md:inset-x-auto md:bottom-6 md:left-1/2 md:w-[min(720px,calc(100vw-48px))] md:-translate-x-1/2" aria-live="polite" data-testid="pick-bar">
      <div className="flex flex-wrap items-center gap-3 rounded-card bg-band px-4 py-3 text-band-text shadow-lg">
        <span className="min-w-0 flex-1">
          <b className="block truncate">{g.name}</b>
          <span className="text-sm text-band-muted">{tb("picked", { from: hourText(lo, locale), to: hourText(hi % 24, locale), amount: money(estimate(pick.hours, slots)) })}</span>
        </span>
        <button type="button" onClick={onClear} aria-label={tb("clear")} className="inline-flex size-10 items-center justify-center rounded-control text-band-muted hover:text-band-text">
          <X size={18} aria-hidden />
        </button>
        {href ? (
          <ButtonLink href={href} variant="prize" iconEnd={<ArrowRight size={18} weight="bold" aria-hidden />} data-testid="pick-continue">
            {tb("continue")}
          </ButtonLink>
        ) : null}
      </div>
    </div>
  );
}

function VenueCard({ g, name, money }: { g: GroundCard; name: (x: { nameEn: string; nameBn: string }) => string; money: (n: number) => string }) {
  const t = useTranslations("grounds");
  return (
    <li>
      <Link href={`/venues/${g.slug}`} className="group flex h-full flex-col overflow-hidden glass-card no-underline" data-testid="ground-card">
        <span className="relative block aspect-[16/10] w-full overflow-hidden bg-surface-2">
          {g.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={g.coverUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <Image src={PHOTOS.groundsFloodlit} alt="" fill sizes="(min-width: 1180px) 30vw, (min-width: 640px) 45vw, 100vw" className="object-cover" />
          )}
          {g.openHoursToday ? (
            <Badge tone="brand" className="absolute left-3 top-3 bg-surface/90 backdrop-blur" >
              <span data-testid="open-today">{t("openToday", { n: g.openHoursToday })}</span>
            </Badge>
          ) : null}
        </span>
        <span className="flex flex-1 flex-col p-4">
          <span className="font-display text-lg font-bold leading-snug group-hover:text-brand-text">{g.name}</span>
          <span className="mt-1 text-sm text-muted">
            {[g.area ? name(g.area) : null, g.sports.map(name).join(", ")].filter(Boolean).join(" · ")}
          </span>
          <span className="mt-1 text-sm text-muted">
            {t("courts", { n: g.courtsCount })} · {g.isIndoor ? t("indoorShort") : t("outdoorShort")}
            {g.surfaces[0] ? ` · ${name(g.surfaces[0])}` : ""}
          </span>
          <span className="mt-auto pt-3 font-display text-xl font-bold tabular">{t("from", { price: money(g.priceFromPoisha) })}</span>
        </span>
      </Link>
    </li>
  );
}

type FacetItem = { key: string; nameEn: string; nameBn: string; count: number };

/** The filters, the same in the sidebar and the phone sheet. */
function VenueFilters({
  f,
  facets,
  hasOrigin,
  name,
  money,
  areas,
  onChange,
}: {
  f: Filters;
  facets?: { sports: FacetItem[]; surfaces: FacetItem[]; facilities: FacetItem[]; indoor: { indoor: number; outdoor: number } };
  hasOrigin: boolean;
  name: (x: { nameEn: string; nameBn: string }) => string;
  money: (n: number) => string;
  areas: { value: string; label: string }[];
  onChange: (f: Filters) => void;
}) {
  const t = useTranslations("grounds");
  const tb = useTranslations("grounds.browse");
  const toggle = (list: string[] | undefined, key: string) => (list?.includes(key) ? list.filter((k) => k !== key) : [...(list ?? []), key]);
  const total = (facets?.indoor.indoor ?? 0) + (facets?.indoor.outdoor ?? 0);
  const band = (b: PriceBand) => {
    const [lo, hi] = PRICE_BANDS[b];
    return lo === null ? tb("under", { a: money(hi!) }) : hi === null ? tb("over", { a: money(lo) }) : tb("between", { a: money(lo), b: money(hi) });
  };
  return (
    <div className="flex flex-col gap-6">
      <Group title={t("sport")}>
        <div className="grid grid-cols-2 gap-2">
          <Chip active={!f.sport} count={total || undefined} onClick={() => onChange({ ...f, sport: undefined })} className="justify-between">
            {tb("all")}
          </Chip>
          {(facets?.sports ?? []).map((s) => (
            <Chip key={s.key} active={f.sport === s.key} count={s.count} onClick={() => onChange({ ...f, sport: f.sport === s.key ? undefined : s.key })} className="justify-between">
              {name(s)}
            </Chip>
          ))}
        </div>
      </Group>
      <Group title={tb("price")}>
        <Radios name="price" value={f.price ?? ""} onChange={(v) => onChange({ ...f, price: (v || undefined) as PriceBand | undefined })} options={[{ value: "", label: tb("anyPrice") }, ...(Object.keys(PRICE_BANDS) as PriceBand[]).map((b) => ({ value: b, label: band(b) }))]} />
      </Group>
      <Group title={tb("distance")}>
        <Radios
          name="km"
          value={f.km ? String(f.km) : ""}
          disabled={!hasOrigin}
          onChange={(v) => onChange({ ...f, km: v ? Number(v) : undefined })}
          options={[{ value: "", label: tb("anyDistance") }, ...DISTANCES.map((d) => ({ value: String(d), label: tb("within", { n: d }) }))]}
        />
        {!hasOrigin ? <p className="mt-2 text-xs text-muted">{tb("needsOrigin")}</p> : null}
      </Group>
      {facets?.surfaces.length ? (
        <Group title={t("surface")}>
          {facets.surfaces.map((s) => (
            <Checkbox key={s.key} id={`surface-${s.key}`} checked={Boolean(f.surface?.includes(s.key))} onChange={() => onChange({ ...f, surface: toggle(f.surface, s.key) })} label={<CountLabel label={name(s)} count={s.count} />} />
          ))}
        </Group>
      ) : null}
      <Group title={t("where")}>
        <SegmentedControl<"any" | "indoor" | "outdoor">
          size="sm"
          className="w-full"
          label={t("where")}
          value={f.indoor === undefined ? "any" : f.indoor ? "indoor" : "outdoor"}
          onChange={(v) => onChange({ ...f, indoor: v === "any" ? undefined : v === "indoor" })}
          options={[
            { value: "any", label: t("anyPlace") },
            { value: "indoor", label: t("indoor", { n: facets?.indoor.indoor ?? 0 }) },
            { value: "outdoor", label: t("outdoor", { n: facets?.indoor.outdoor ?? 0 }) },
          ]}
        />
      </Group>
      {facets?.facilities.length ? (
        <Group title={t("facilities")}>
          {facets.facilities.map((s) => (
            <Checkbox key={s.key} id={`facility-${s.key}`} checked={Boolean(f.facilities?.includes(s.key))} onChange={() => onChange({ ...f, facilities: toggle(f.facilities, s.key) })} label={<CountLabel label={name(s)} count={s.count} />} />
          ))}
        </Group>
      ) : null}
      <Group title={t("area")}>
        <div className="[&_label]:sr-only">
          <Dropdown id="area" label={t("area")} value={f.areaId ?? ""} onChange={(v) => onChange({ ...f, areaId: v || undefined })} anyLabel={t("anyArea")} options={areas} />
        </div>
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-2 text-sm font-bold">{title}</legend>
        {children}
      </fieldset>
    </div>
  );
}

function CountLabel({ label, count }: { label: string; count: number }) {
  return (
    <span className="flex w-full items-center justify-between gap-3">
      {label}
      <span className="tabular text-xs text-muted">{count}</span>
    </span>
  );
}

function Radios({ name, value, options, onChange, disabled }: { name: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className={cn("flex flex-col", disabled && "opacity-50")}>
      {options.map((o) => (
        <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] has-[:disabled]:cursor-not-allowed">
          <input type="radio" name={name} value={o.value} checked={value === o.value} disabled={disabled && o.value !== ""} onChange={() => onChange(o.value)} className="size-5 accent-[var(--kg-brand)]" />
          <span className={cn(value === o.value && "font-semibold")}>{o.label}</span>
        </label>
      ))}
    </div>
  );
}
