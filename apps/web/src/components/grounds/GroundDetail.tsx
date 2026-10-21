"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, CaretLeft, CaretRight, Check, Images, MapPin, ShieldCheck } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Button, Dialog, IconButton, Sheet, Skeleton } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { grounds, hourLabel, hoursLines, type GroundDetail as Ground } from "@/lib/grounds";
import { formatTaka } from "@/lib/payments";
import { PHOTOS } from "@/lib/photos";
import { BookingWidget } from "./BookingWidget";
import { GroundReviews } from "../trust/GroundReviews";

const TONE: Record<string, string> = { low: "bg-brand/10", base: "bg-surface-2", high: "bg-amber-100 dark:bg-amber-900/40", peak: "bg-amber-300 dark:bg-amber-700/70" };

const WIDE = "(min-width: 1024px)";
/** True on desktop widths, where booking sits in the side panel; phones book from a sheet. */
function useDesktop() {
  return useSyncExternalStore(
    (on) => {
      const m = window.matchMedia(WIDE);
      m.addEventListener("change", on);
      return () => m.removeEventListener("change", on);
    },
    () => window.matchMedia(WIDE).matches,
    () => true,
  );
}

/**
 * /venues/[slug] (M09 §4.8, FR-27), after the Claude Design ground page: a photo mosaic, the spec
 * table, courts and hours, facilities, rules, the week's prices, reviews and other venues nearby.
 * Desktop books in a sticky side panel; phones get a price bar at the bottom that opens the same
 * BookingWidget (M10) in a sheet. The owner's name is not shown; their reliability score is.
 */
export function GroundDetail({ slug }: { slug: string }) {
  // A slot picked on /venues or the home page arrives as ?court=&at=&len=, never personal data.
  const search = useSearchParams();
  const t = useTranslations("grounds");
  const tp = useTranslations("grounds.page");
  const locale = useLocale();
  const desktop = useDesktop();
  const q = useQuery({ queryKey: ["ground", slug], queryFn: () => grounds.detail(slug), retry: false });
  const [gallery, setGallery] = useState<number | null>(null);
  const [sheet, setSheet] = useState(() => Boolean(search.get("at")));

  if (q.isPending)
    return (
      <div className="mx-auto max-w-wide px-5 py-8">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-4 h-12 w-2/3" />
        <Skeleton className="mt-6 aspect-[16/7] w-full rounded-card" />
      </div>
    );
  if (q.isError || !q.data)
    return (
      <section className="mx-auto max-w-wide px-5 py-16">
        <h1 className="text-2xl font-extrabold">{t("notFound")}</h1>
        <Link href="/venues" className="mt-3 inline-block font-semibold text-brand-text underline">
          {t("back")}
        </Link>
      </section>
    );

  const g = q.data;
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);
  const money = (n: number) => formatTaka(n, locale);
  const days = (t.raw("days") as string[]) ?? [];
  const p = g.pricing;
  const sports = [...new Map(g.courts.flatMap((c) => c.sports).map((s) => [s.key, s])).values()];
  const surfaces = [...new Map(g.courts.flatMap((c) => (c.surface ? [c.surface] : [])).map((s) => [s.key, s])).values()];
  const sizes = [...new Set(g.courts.map((c) => c.sizeText).filter(Boolean))];
  const priceRange = p.fromPoisha === p.toPoisha ? money(p.fromPoisha) : `${money(p.fromPoisha)}–${money(p.toPoisha)}`;
  const advanceFrom = Math.round((p.fromPoisha * p.advancePct) / 100);
  const initial = { courtId: search.get("court") ?? undefined, start: search.get("at") ?? undefined, minutes: Number(search.get("len")) || undefined };
  const reliability = g.owner.reliability ?? null;

  const panel = g.bookingOpen ? (
    <BookingWidget groundId={g.id} slug={slug} initial={initial} />
  ) : (
    <div>
      <p className="font-bold">{t("bookingSoon")}</p>
      <p className="text-sm text-muted">{t("bookingSoonHelp")}</p>
    </div>
  );
  const payLines = (
    <ul className="space-y-1.5 text-sm">
      <li className="flex gap-2">
        <Check size={16} weight="bold" className="mt-0.5 shrink-0 text-brand-text" aria-hidden />
        {t("payAdvance", { pct: p.advancePct })}
      </li>
      {g.payment.allowFullPayment ? (
        <li className="flex gap-2">
          <Check size={16} weight="bold" className="mt-0.5 shrink-0 text-brand-text" aria-hidden />
          {t("payFull")}
        </li>
      ) : null}
      <li className="pl-6 text-muted">{g.payment.advanceRefundable ? t("refundWindows", { full: g.payment.fullRefundHours ?? 0, half: g.payment.halfRefundHours ?? 0 }) : t("noRefund")}</li>
    </ul>
  );

  return (
    <section className="mx-auto max-w-wide px-5 pb-32 pt-6 lg:pb-16">
      <Link href="/venues" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-text no-underline hover:underline">
        <ArrowLeft size={16} aria-hidden />
        {tp("all")}
      </Link>

      <header className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(32px,4.6vw,56px)] leading-[1.05]" data-testid="ground-name">
            {g.name}
          </h1>
          <p className="mt-2 flex items-center gap-1.5 text-muted">
            <MapPin size={18} aria-hidden />
            {g.addressLine}
            {g.area ? `, ${name(g.area)}` : ""}
          </p>
        </div>
        {reliability !== null ? (
          <p className="inline-flex items-center gap-2 rounded-pill bg-brand-soft px-3 py-1.5 text-sm font-semibold text-brand-text" data-testid="owner-reliability" title={t("reliabilityHelp")}>
            <ShieldCheck size={18} aria-hidden />
            {tp("reliability", { score: reliability })}
          </p>
        ) : null}
      </header>

      <Mosaic g={g} onOpen={setGallery} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          <table className="w-full border-t-2 border-ink text-left" data-testid="ground-spec">
            <tbody className="divide-y divide-line">
              <Spec label={tp("spec.sports")} value={tp("sportsCourts", { sports: sports.map(name).join(", "), n: g.courts.length })} />
              <Spec label={tp("spec.surface")} value={[surfaces.map(name).join(", "), g.isIndoor ? t("indoorShort") : t("outdoorShort")].filter(Boolean).join(" · ")} />
              {sizes.length ? <Spec label={tp("spec.size")} value={sizes.join(", ")} /> : null}
              <Spec label={tp("spec.price")} value={tp("perHour", { price: priceRange })} />
              <Spec label={t("fact.minimum")} value={t("minutes", { n: p.minBookingMin })} />
            </tbody>
          </table>

          {g.description ? <p className="mt-6 max-w-[65ch] whitespace-pre-line leading-relaxed">{g.description}</p> : null}

          {g.facilities.length ? (
            <Block title={t("facilities")}>
              <ul className="flex flex-wrap gap-2">
                {g.facilities.map((f) => (
                  <li key={f.key} className="inline-flex min-h-10 items-center gap-1.5 rounded-pill border border-line bg-surface px-3.5 text-sm font-semibold">
                    <Check size={14} weight="bold" className="text-brand-text" aria-hidden />
                    {name(f)}
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}

          <Block title={t("courtsTitle")}>
            <ul className="grid gap-3 sm:grid-cols-2" data-testid="ground-courts">
              {g.courts.map((c) => (
                <li key={c.id} className="rounded-card border border-line bg-surface p-4">
                  <p className="font-display text-lg font-bold">{c.name}</p>
                  <p className="text-sm text-muted">
                    {[c.sports.map(name).join(", "), c.surface ? name(c.surface) : null, c.sizeText, c.capacityText].filter(Boolean).join(" · ")}
                  </p>
                  <ul className="mt-2 text-sm tabular">
                    {hoursLines(c.hours, days, t("closed")).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Block>

          <Block title={t("rulesTitle")}>
            <ul className="space-y-2 text-[15px]">
              {g.bookingCutoffMin ? <Rule>{t("cutoff", { n: g.bookingCutoffMin })}</Rule> : null}
              <Rule>{t("minimum", { n: p.minBookingMin })}</Rule>
              {g.rulesText ? <Rule className="whitespace-pre-line">{g.rulesText}</Rule> : null}
            </ul>
          </Block>

          <Block title={t("priceTitle")}>
            <p className="-mt-1 text-sm text-muted">{t("priceLead", { peak: p.peakPct, from: hourLabel(p.peakFromHour), weekend: p.weekendPct, early: p.earlyPct, to: hourLabel(p.earlyToHour) })}</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] border-separate border-spacing-0.5 text-center text-xs tabular" data-testid="price-table">
                <thead>
                  <tr>
                    <th />
                    {p.week[0]?.cells.map((c) => (
                      <th key={c.hour} scope="col" className="font-semibold text-muted">
                        {hourLabel(c.hour)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.week.map((r) => (
                    <tr key={r.date}>
                      <th scope="row" className="pr-2 text-left font-semibold">
                        {new Date(`${r.date}T00:00:00+06:00`).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "short", day: "numeric", timeZone: "Asia/Dhaka" })}
                      </th>
                      {r.cells.map((c) => (
                        <td key={c.hour} className={cn("h-8 rounded-[4px]", TONE[c.tone])} title={money(c.rate)}>
                          {Math.round(c.rate / 100).toLocaleString(locale === "bn" ? "bn-BD" : "en-IN")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Block>

          <GroundReviews groundId={g.id} />
          <Nearby g={g} sport={sports[0]} name={name} money={money} />
        </div>

        {desktop ? (
          <aside className="lg:sticky lg:top-24 lg:self-start" data-testid="booking-aside">
            <div className="rounded-card border border-line bg-surface p-5 shadow-md">
              <h2 className="text-xl">{tp("book")}</h2>
              <p className="mt-2 font-display text-3xl font-bold tabular">{priceRange}</p>
              <p className="text-sm text-muted">{t("perHour")}</p>
              <div className="mt-3">{payLines}</div>
              <div className="mt-4 border-t border-line pt-4">{panel}</div>
            </div>
          </aside>
        ) : null}
      </div>

      {!desktop ? (
        <>
          <div className="fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-40 md:bottom-4" data-testid="price-bar">
            <div className="flex items-center gap-3 rounded-card border border-line bg-surface/95 px-4 py-3 shadow-lg backdrop-blur">
              <span className="min-w-0 flex-1">
                <b className="block font-display text-xl tabular">{tp("perHourShort", { price: money(p.fromPoisha) })}</b>
                <span className="block truncate text-sm text-muted">{tp("fromAdvance", { amount: money(advanceFrom) })}</span>
              </span>
              <Button type="button" onClick={() => setSheet(true)} disabled={!g.bookingOpen} data-testid="open-booking">
                {tp("book")}
              </Button>
            </div>
          </div>
          <Sheet open={sheet} onOpenChange={setSheet} side="bottom" title={tp("book")}>
            <div className="px-5 pb-6">
              <div className="mb-4">{payLines}</div>
              {panel}
            </div>
          </Sheet>
        </>
      ) : null}

      <Gallery g={g} at={gallery} onAt={setGallery} />
    </section>
  );
}

/** One large photo and two small ones; the last shows how many more there are. */
function Mosaic({ g, onOpen }: { g: Ground; onOpen: (i: number) => void }) {
  const t = useTranslations("grounds");
  const tp = useTranslations("grounds.page");
  const photos = g.photos;
  if (!photos.length)
    return (
      <div className="relative mt-6 aspect-[16/7] overflow-hidden rounded-card bg-surface-2">
        <Image src={PHOTOS.groundsFloodlit} alt="" fill priority sizes="100vw" className="object-cover" />
      </div>
    );
  const tile = (i: number, cls: string, extra?: ReactNode) => (
    <button key={photos[i].id} type="button" onClick={() => onOpen(i)} className={cn("group relative overflow-hidden bg-surface-2", cls)} aria-label={t("photoOf", { name: g.name, n: i + 1 })} data-testid={i === 0 ? "ground-photo" : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photos[i].url} alt="" className="size-full object-cover transition-transform duration-700 ease-[var(--ease-kg)] group-hover:scale-[1.04]" />
      {extra}
    </button>
  );
  const more = photos.length - 3;
  return (
    <div className={cn("mt-6 grid h-[clamp(240px,42vw,480px)] gap-2 overflow-hidden rounded-card", photos.length > 1 ? "grid-cols-[2fr_1fr] grid-rows-2" : "grid-cols-1")}>
      {tile(0, photos.length > 1 ? "row-span-2" : "")}
      {photos[1] ? tile(1, photos[2] ? "" : "row-span-2") : null}
      {photos[2]
        ? tile(
            2,
            "",
            more > 0 ? (
              <span className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 font-semibold text-white">
                <Images size={20} aria-hidden />
                {tp("morePhotos", { n: more })}
              </span>
            ) : undefined,
          )
        : null}
    </div>
  );
}

function Gallery({ g, at, onAt }: { g: Ground; at: number | null; onAt: (i: number | null) => void }) {
  const tp = useTranslations("grounds.page");
  const t = useTranslations("grounds");
  const n = g.photos.length;
  if (!n) return null;
  const i = at ?? 0;
  const step = (d: number) => onAt((i + d + n) % n);
  return (
    <Dialog open={at !== null} onOpenChange={(o) => onAt(o ? i : null)} title={tp("gallery", { name: g.name })} className="max-w-4xl">
      <div className="px-6 pb-6" onKeyDown={(e) => (e.key === "ArrowRight" ? step(1) : e.key === "ArrowLeft" ? step(-1) : undefined)}>
        <div className="relative overflow-hidden rounded-[14px] bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={g.photos[i]?.url} alt={t("photoOf", { name: g.name, n: i + 1 })} className="aspect-[16/10] w-full object-cover" />
        </div>
        {n > 1 ? (
          <div className="mt-3 flex items-center justify-between">
            <IconButton label={tp("prev")} variant="secondary" onClick={() => step(-1)}>
              <CaretLeft size={20} aria-hidden />
            </IconButton>
            <span className="tabular text-sm text-muted" aria-live="polite">
              {i + 1} / {n}
            </span>
            <IconButton label={tp("next")} variant="secondary" onClick={() => step(1)}>
              <CaretRight size={20} aria-hidden />
            </IconButton>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

/** Other venues for the same sport, nearest to this one first. */
function Nearby({ g, sport, name, money }: { g: Ground; sport?: { key: string; nameEn: string; nameBn: string }; name: (x: { nameEn: string; nameBn: string }) => string; money: (n: number) => string }) {
  const tp = useTranslations("grounds.page");
  const q = useQuery({
    queryKey: ["grounds-nearby", g.id, sport?.key],
    queryFn: () => grounds.list({ sport: sport?.key, sort: "nearest" }, { lat: g.lat, lng: g.lng }),
    enabled: Boolean(sport),
    staleTime: 300_000,
  });
  const items = (q.data?.items ?? []).filter((x) => x.id !== g.id).slice(0, 3);
  if (!sport || !items.length) return null;
  return (
    <Block title={tp("nearby", { sport: name(sport) })}>
      <ul className="grid gap-3 sm:grid-cols-3" data-testid="nearby">
        {items.map((x) => (
          <li key={x.id}>
            <Link href={`/venues/${x.slug}`} className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface no-underline">
              <span className="relative block aspect-[16/10] overflow-hidden bg-surface-2">
                {x.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={x.coverUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <Image src={PHOTOS.groundsFloodlit} alt="" fill sizes="(min-width: 640px) 30vw, 100vw" className="object-cover" />
                )}
              </span>
              <span className="p-3">
                <b className="block font-display leading-snug group-hover:text-brand-text">{x.name}</b>
                <span className="text-sm text-muted">{tp("nearbyLine", { area: x.area ? name(x.area) : "", price: money(x.priceFromPoisha) })}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Block>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-2xl">{title}</h2>
      {children}
    </section>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th scope="row" className="w-28 py-3 pr-4 sm:w-40 align-top text-sm font-semibold text-muted">
        {label}
      </th>
      <td className="py-3 font-semibold">{value || "–"}</td>
    </tr>
  );
}

function Rule({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <li className={cn("flex gap-2.5", className)}>
      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
