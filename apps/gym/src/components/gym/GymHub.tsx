"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Crosshair, ShoppingBag } from "@phosphor-icons/react";
import { Link, usePathname, useRouter } from "@kriraghor/ui/i18n/navigation";
import { PageHeader } from "@kriraghor/ui/page-header";
import { gym, type GymSort } from "@/lib/gym";
import { takaToPoisha } from "@/lib/gym-manage";
import { webHref } from "@/lib/links";
import { GymCardItem } from "./GymCardItem";

const SORTS: GymSort[] = ["nearest", "price", "rating", "newest"];
const RADII = [2, 5, 10, 25];
type Position = { lat: number; lng: number };
type Locating = "idle" | "asking" | "denied" | "unavailable";

/**
 * /gyms (M20 §4, M24 §4.1 as extended in prompt 3): the gym directory. Area, facility, the highest
 * monthly price, the sort and the radius live in the URL. **Near me** asks the browser for the
 * position once per visit and sends it with the list request only: it never goes into the URL, storage
 * or the analytics. Without a position the list sorts by price. Trainers moved to /trainers, and gym
 * gear is the gym category of the kriraghor.com shop. Dark theme with the lime accent.
 */
export function GymHub() {
  const t = useTranslations("gym");
  const tg = useTranslations("gp.hub");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [at, setAt] = useState<Position | null>(null);
  const [locating, setLocating] = useState<Locating>("idle");
  const asked = params.get("sort") as GymSort | null;
  const sort: GymSort = asked && SORTS.includes(asked) ? asked : at ? "nearest" : "price";
  const text = params.get("q") ?? undefined;
  const areaId = params.get("areaId") ?? undefined;
  const facility = params.get("facility") ?? undefined;
  const priceMax = Number(params.get("priceMax")) > 0 ? Number(params.get("priceMax")) : undefined;
  const radiusKm = RADII.includes(Number(params.get("radiusKm"))) ? Number(params.get("radiusKm")) : undefined;
  const [priceText, setPriceText] = useState(priceMax ? String(priceMax / 100) : "");

  // The hub's old tabs: /gyms?tab=trainers is /trainers now; ?tab=gear goes to the shop.
  const tab = params.get("tab");
  useEffect(() => {
    if (tab === "trainers") router.replace("/trainers");
    else if (tab === "gear") window.location.replace(webHref("/shop?category=gym"));
  }, [tab, router]);

  const go = (next: Record<string, string | undefined>) => {
    const q = new URLSearchParams(params.toString());
    q.delete("tab");
    for (const [k, v] of Object.entries(next)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  const locate = () => {
    if (!("geolocation" in navigator)) return setLocating("unavailable");
    setLocating("asking");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setAt({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating("idle");
        go({ sort: "nearest" });
      },
      (e) => setLocating(e.code === e.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 },
    );
  };

  // A position outside Bangladesh is refused by the API (lat 20–27, lng 88–93): treat it as no position.
  const inBd = at && at.lat >= 20 && at.lat <= 27 && at.lng >= 88 && at.lng <= 93 ? at : null;
  const gyms = useQuery({
    queryKey: ["gyms", sort, text, areaId, facility, priceMax, radiusKm, inBd?.lat, inBd?.lng],
    queryFn: () => gym.list({ sort, q: text, areaId, facility, priceMax, at: inBd, radiusKm }),
    enabled: tab !== "trainers" && tab !== "gear",
  });
  const areas = useQuery({ queryKey: ["gym-areas"], queryFn: () => gym.areas(), staleTime: 300_000 });
  const facilities = useQuery({ queryKey: ["gym-facilities"], queryFn: () => gym.facilities(), staleTime: 300_000 });
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);

  const applyPrice = () => {
    const p = priceText.trim() ? takaToPoisha(priceText) : null;
    go({ priceMax: p ? String(p) : undefined });
  };
  const field = "min-h-11 field px-3 text-ink";

  return (
    <div data-theme="gym" className="min-h-[70dvh]">
      <section className="mx-auto max-w-[1320px] px-5 pb-6 pt-12">
        <PageHeader photo="/images/gym-training.jpg">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">{t("kicker")}</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl" data-testid="gym-title">
            {t.rich("title", { em: (chunks) => <span className="text-brand">{chunks}</span> })}
          </h1>
          <p className="mt-4 max-w-2xl text-muted">{tg("lead")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={locate} disabled={locating === "asking"} className="inline-flex min-h-12 items-center gap-2 bg-brand px-5 font-bold text-on-brand hover:bg-brand-hover disabled:opacity-60" data-testid="gym-near-me">
              <Crosshair size={20} aria-hidden /> {locating === "asking" ? tg("locating") : inBd ? tg("nearMeAgain") : tg("nearMe")}
            </button>
            <Link href="/trainers" className="rounded-control inline-flex min-h-12 items-center border border-line-strong/60 px-5 font-bold no-underline hover:border-brand" data-testid="gym-trainers-link">
              {t("bookTrainer")}
            </Link>
            <Link href="/me/passes" className="rounded-control inline-flex min-h-12 items-center border border-line-strong/60 px-5 font-bold no-underline hover:border-brand">
              {t("myPasses")}
            </Link>
          </div>
        </PageHeader>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-10">
        <form
          className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
            const price = priceText.trim() ? takaToPoisha(priceText) : null;
            go({ q: q.length >= 2 ? q : undefined, priceMax: price ? String(price) : undefined });
          }}
          aria-label={tg("filters")}
        >
          <label className="col-span-2 flex flex-col gap-1 text-sm font-semibold text-muted">
            {tg("search")}
            <input key={text ?? ""} name="q" type="search" defaultValue={text ?? ""} placeholder={tg("searchHint")} autoComplete="off" enterKeyHint="search" maxLength={60} className={field} data-testid="gym-search" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            {t("area")}
            <select value={areaId ?? ""} onChange={(e) => go({ areaId: e.target.value || undefined })} className={field} data-testid="gym-area">
              <option value="">{t("anyArea")}</option>
              {(areas.data?.items ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {name(a)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            {tg("facility")}
            <select value={facility ?? ""} onChange={(e) => go({ facility: e.target.value || undefined })} className={field} data-testid="gym-facility">
              <option value="">{tg("anyFacility")}</option>
              {(facilities.data?.items ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {name(f)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            {tg("priceMax")}
            <input inputMode="numeric" value={priceText} onChange={(e) => setPriceText(e.target.value)} onBlur={applyPrice} placeholder={tg("priceAny")} className={`${field} w-full sm:w-40`} data-testid="gym-price-max" />
          </label>
          {inBd ? (
            <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
              {tg("radius")}
              <select value={radiusKm ?? ""} onChange={(e) => go({ radiusKm: e.target.value || undefined })} className={field} data-testid="gym-radius">
                <option value="">{tg("anyDistance")}</option>
                {RADII.map((r) => (
                  <option key={r} value={r}>
                    {tg("withinKm", { n: r })}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted sm:ml-auto">
            {t("sortBy")}
            <select value={sort} onChange={(e) => (e.target.value === "nearest" && !inBd ? locate() : go({ sort: e.target.value }))} className={field} data-testid="gym-sort">
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {s === "nearest" ? tg("nearest") : t(`sort.${s}`)}
                </option>
              ))}
            </select>
          </label>
        </form>

        {locating === "denied" || locating === "unavailable" ? (
          <p className="rounded-card mt-4 border border-line p-4 text-sm" role="status" data-testid="gym-no-location">
            {tg(locating === "denied" ? "locationDenied" : "locationUnavailable")}
          </p>
        ) : sort === "nearest" && !inBd ? (
          <p className="rounded-card mt-4 border border-line p-4 text-sm" role="status">
            {at ? tg("outsideBd") : tg("nearestNeedsLocation")}
          </p>
        ) : null}

        {gyms.isPending ? (
          <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <li key={i} className="rounded-card h-80 kg-shimmer bg-surface-2" />
            ))}
          </ul>
        ) : gyms.isError ? (
          <p className="rounded-card mt-6 border border-danger p-6 font-bold">{t("error")}</p>
        ) : !gyms.data.items.length ? (
          <div className="rounded-card mt-6 border border-dashed border-line p-10 text-center" data-testid="gym-empty">
            <p className="font-bold">{t("noGyms")}</p>
            {areaId || facility || priceMax || radiusKm ? (
              <button type="button" onClick={() => go({ areaId: undefined, facility: undefined, priceMax: undefined, radiusKm: undefined })} className="mt-3 font-semibold text-brand underline">
                {tg("clearFilters")}
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <p className="mt-6 text-sm text-muted" aria-live="polite">
              {tg("count", { n: gyms.data.total })}
            </p>
            <ul className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="gym-cards">
              {gyms.data.items.map((g) => (
                <GymCardItem key={g.id} card={g} />
              ))}
            </ul>
          </>
        )}

        <div className="surface-card mt-10 flex flex-col items-start gap-3 p-6 md:flex-row md:items-center md:justify-between" data-testid="gym-gear">
          <div>
            <h2 className="text-2xl font-extrabold">{t("gearTitle")}</h2>
            <p className="mt-1 max-w-2xl text-muted">{t("gearLead")}</p>
          </div>
          <a href={webHref("/shop?category=gym")} className="inline-flex min-h-12 shrink-0 items-center gap-2 bg-brand px-5 font-bold text-on-brand hover:bg-brand-hover" data-testid="gym-gear-shop">
            <ShoppingBag size={20} aria-hidden /> {t("allGear")}
          </a>
        </div>
      </section>
    </div>
  );
}
