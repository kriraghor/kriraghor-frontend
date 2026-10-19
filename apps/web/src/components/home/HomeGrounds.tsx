"use client";

import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, NavigationArrow } from "@phosphor-icons/react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { PHOTOS } from "@/lib/photos";
import { api } from "@/lib/api/client";
import { bookings } from "@/lib/bookings";
import { bookingHref, freeHours, hourOf, type FreeSlot } from "@/lib/home";
import { formatTaka } from "@/lib/payments";
import { nameOf } from "./queries";

type Ground = { id: string; slug: string; name: string; area: { nameEn: string; nameBn: string } | null; coverUrl: string | null; sports: { nameEn: string; nameBn: string }[]; priceFromPoisha: number; distanceM: number | null };
type Here = { lat: number; lng: number };

/**
 * Grounds (home-v3 §5, M09/M10): three grounds with the free hours left tonight, one tap from the
 * booking widget. "Use my location" sorts by distance; the position stays in the browser and goes to
 * the API only as the list query (never stored).
 */
export function HomeGrounds() {
  const t = useTranslations("home.grounds");
  const locale = useLocale();
  const [here, setHere] = useState<Here | null>(null);
  const [locating, setLocating] = useState<"idle" | "asking" | "denied">("idle");
  const [picked, setPicked] = useState<{ ground: Ground; slot: FreeSlot } | null>(null);

  const list = useQuery({
    queryKey: ["home-grounds", here?.lat, here?.lng],
    queryFn: async () => {
      const query = here ? { lat: here.lat, lng: here.lng, sort: "nearest" as const, limit: 3 } : { sort: "cheapest" as const, limit: 3 };
      const r = await api().GET("/grounds", { params: { query: query as never } });
      if (r.error || !r.data) throw r.error ?? new Error("unavailable");
      return (r.data as unknown as { items: Ground[] }).items.slice(0, 3);
    },
  });
  const items = list.data ?? [];
  const grids = useQueries({ queries: items.map((g) => ({ queryKey: ["availability", g.id, "today"], queryFn: () => bookings.availability(g.id), staleTime: 60_000 })) });

  const locate = () => {
    if (!("geolocation" in navigator)) return setLocating("denied");
    setLocating("asking");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setHere({ lat: Math.round(p.coords.latitude * 1000) / 1000, lng: Math.round(p.coords.longitude * 1000) / 1000 });
        setLocating("idle");
      },
      () => setLocating("denied"),
      { maximumAge: 600_000, timeout: 10_000 }
    );
  };
  const km = (m: number) => (m < 1000 ? t("metres", { m: Math.round(m / 10) * 10 }) : t("km", { km: (m / 1000).toFixed(1) }));

  return (
    <section className="mx-auto max-w-[1320px] px-5 pt-[72px]" id="grounds" aria-labelledby="grounds-title" data-testid="home-grounds">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-brand-text">{t("eyebrow")}</p>
          <h2 id="grounds-title" className="mt-2 text-[clamp(28px,3.4vw,40px)] font-extrabold">
            {here ? t("titleNear") : t("title")}
          </h2>
          <p className="mt-2 max-w-[60ch] text-muted">{t("sub")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={locate} disabled={locating === "asking"} className="inline-flex min-h-11 items-center gap-2 border-2 border-line-strong px-4 text-sm font-bold disabled:opacity-60" data-testid="use-location">
            <NavigationArrow size={18} aria-hidden />
            {locating === "asking" ? t("locating") : t("locate")}
          </button>
          <Link href="/grounds" className="inline-flex min-h-11 items-center gap-1 font-bold text-brand-text underline">
            {t("all")} <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted" role="status">
        {locating === "denied" ? t("locationDenied") : here ? t("locationNote") : ""}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {list.isPending ? [0, 1, 2].map((i) => <div key={i} className="h-80 animate-pulse bg-surface-2" />) : null}
        {!list.isPending && !items.length ? <p className="border-2 border-dashed border-line p-6 text-muted md:col-span-3">{t("none")}</p> : null}
        {items.map((g, i) => {
          const grid = grids[i];
          const slots = freeHours(grid?.data);
          return (
            <article key={g.id} className="rv flex flex-col border-2 border-line bg-surface" data-testid="home-ground">
              <div className="aspect-[4/3] overflow-hidden bg-brand-soft">
                {g.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.coverUrl} alt="" loading="lazy" width={600} height={450} className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" />
                ) : (
                  <span className="relative block h-full">
                    <Image src={PHOTOS.groundsFloodlit} alt="" fill sizes="(min-width: 900px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/grounds/${g.slug}`} className="text-lg font-extrabold hover:underline">
                    {g.name}
                  </Link>
                  <b className="shrink-0 tabular-nums">{t("perHour", { price: formatTaka(g.priceFromPoisha, locale) })}</b>
                </div>
                <p className="flex justify-between gap-3 text-sm text-muted">
                  <span>{[nameOf(g.area, locale), g.sports.map((s) => nameOf(s, locale)).join(", ")].filter(Boolean).join(" · ")}</span>
                  {g.distanceM != null ? <span className="shrink-0">{km(g.distanceM)}</span> : null}
                </p>
                <div className="mt-auto pt-2">
                  {grid?.isPending ? <div className="h-11 animate-pulse bg-surface-2" /> : null}
                  {grid && !grid.isPending && slots.length ? (
                    <div className="flex flex-wrap gap-2" role="group" aria-label={t("timesAt", { name: g.name })}>
                      {slots.map((s) => {
                        const on = picked?.ground.id === g.id && picked.slot.start === s.start;
                        return (
                          <button key={s.start} type="button" aria-pressed={on} onClick={() => setPicked(on ? null : { ground: g, slot: s })} className={`min-h-11 min-w-16 border-2 px-3 text-sm font-bold tabular-nums ${on ? "border-brand bg-brand text-white" : "border-line hover:border-brand"}`}>
                            {hourOf(s.time, locale)}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  {grid && !grid.isPending && !slots.length ? (
                    <p className="text-sm">
                      {t("full")}{" "}
                      <Link href={`/grounds/${g.slug}`} className="font-bold text-brand-text underline">
                        {t("otherDays")}
                      </Link>
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {picked ? (
        <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 mt-4 flex flex-wrap items-center justify-between gap-3 border-2 border-line-strong bg-surface p-4 shadow-lg md:bottom-4" aria-live="polite" data-testid="booking-bar">
          <span className="font-semibold">{t("picked", { name: picked.ground.name, time: hourOf(picked.slot.time, locale) })}</span>
          <Link href={bookingHref(picked.ground.slug, picked.slot)} className="inline-flex min-h-11 items-center bg-brand px-4 text-sm font-bold text-white hover:bg-brand-hover">
            {t("continue")}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
