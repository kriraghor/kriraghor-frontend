"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, SealCheck } from "@phosphor-icons/react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { PHOTOS } from "@/lib/photos";
import { api } from "@kriraghor/api-client";
import { initials } from "@/lib/home";
import { formatTaka } from "@/lib/payments";
import { nameOf, type Named } from "./queries";

type Pro = { id: string; slug: string; name: string; headline: string | null; years: number | null; role: Named | null; area: Named | null; rateFrom: number | null; rateUnit: "hourly" | "match" | null; ratingAvg: number | null; ratingCount: number; jobsDone: number };
type Category = Named & { id: string; tint: string | null };
type Gym = { id: string; slug: string; name: string; area: Named | null; cover: string | null; dayPrice: number | null; monthPrice: number | null; openNow: boolean; ratingAvg: number | null };

const items = async <T,>(p: Promise<{ data?: unknown; error?: unknown }>) => {
  const r = await p;
  if (r.error || !r.data) throw r.error ?? new Error("unavailable");
  return (r.data as { items: T[] }).items;
};

/** Hire (home-v3 §7, M11): three top-rated people (initials, no stock photos) and the role groups. */
export function HomeHire() {
  const t = useTranslations("home.hire");
  const locale = useLocale();
  const pros = useQuery({ queryKey: ["home-hire"], queryFn: () => items<Pro>(api().GET("/hire/profiles", { params: { query: { sort: "rating", limit: 3 } as never } })) });
  const taxonomy = useQuery({ queryKey: ["home-hire-taxonomy-full"], staleTime: 3600_000, queryFn: () => items<Category>(api().GET("/hire/taxonomy")) });
  const people = (pros.data ?? []).slice(0, 3);

  return (
    <section className="mx-auto max-w-[1320px] px-5 pt-[72px]" id="hire" aria-labelledby="hire-title" data-testid="home-hire">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="hire-title" className="text-[clamp(28px,3.4vw,40px)] font-extrabold">
            {t("title")}
          </h2>
          <p className="mt-2 max-w-[60ch] text-muted">{t("sub")}</p>
        </div>
        <Link href="/hiring" className="inline-flex min-h-11 items-center gap-1 font-bold text-brand-text underline">
          {t("all")} <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-[5fr_7fr]">
        <div className="flex flex-col gap-3">
          {pros.isPending ? [0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-[20px] bg-surface-2" />) : null}
          {!pros.isPending && !people.length ? <p className="border-2 border-dashed border-line p-6 text-muted">{t("none")}</p> : null}
          {people.map((p) => (
            <Link key={p.id} href={`/hiring/${p.slug}`} className="rv flex items-center gap-4 glass-card p-4 hover:border-ink">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-soft font-display text-xl font-extrabold text-brand-text" aria-hidden>
                {initials(p.name)}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block">{p.name}</b>
                <span className="block text-sm text-muted">{nameOf(p.role, locale)}</span>
                {p.jobsDone > 0 || p.years ? (
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-text">
                    <SealCheck size={14} aria-hidden />
                    {p.jobsDone > 0 ? t("jobs", { n: p.jobsDone }) : t("years", { n: p.years ?? 0 })}
                  </span>
                ) : null}
              </span>
              {p.rateFrom != null ? (
                <span className="shrink-0 text-right font-bold tabular-nums">
                  {formatTaka(p.rateFrom, locale)}
                  <span className="block text-xs font-normal text-muted">{t(p.rateUnit === "hourly" ? "perHour" : "perMatch")}</span>
                </span>
              ) : null}
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="relative col-span-2 aspect-[21/9] overflow-hidden rounded-[24px] sm:col-span-3">
            <Image src={PHOTOS.hire} alt="" fill sizes="(min-width: 900px) 55vw, 100vw" className="object-cover object-[50%_35%]" />
          </div>
          {(taxonomy.data ?? []).map((c) => (
            <Link key={c.key} href={`/hiring?category=${encodeURIComponent(c.key)}`} className="rv flex min-h-28 flex-col justify-between glass-card p-4 hover:border-ink">
              <span className="font-bangla text-sm text-muted" lang="bn">
                {c.nameBn}
              </span>
              <b lang="en">{c.nameEn}</b>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Gym (home-v3 §8, M20 is live): the sub-brand band with three gyms and the way in. */
export function HomeGym() {
  const t = useTranslations("home.gym");
  const locale = useLocale();
  const gyms = useQuery({ queryKey: ["home-gyms"], queryFn: () => items<Gym>(api().GET("/gym/gyms", { params: { query: { sort: "rating", limit: 3 } as never } })) });
  const list = (gyms.data ?? []).slice(0, 3);
  const money = (n: number) => formatTaka(n, locale);

  return (
    <div className="flex flex-col gap-3">
      {gyms.isPending ? [0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse bg-white/5" />) : null}
      {!gyms.isPending && !list.length ? <p className="border border-white/20 p-5 text-white/75">{t("none")}</p> : null}
      {list.map((g) => (
        <Link key={g.id} href={`/gym/gyms/${g.slug}`} className="rv glass-band flex items-center gap-4 rounded-[18px] p-4 hover:border-gym-accent" data-testid="home-gym">
          <span className="min-w-0 flex-1">
            <b className="block text-lg">{g.name}</b>
            <span className="block text-sm text-white/70">
              {nameOf(g.area, locale)}
              {g.openNow ? <span className="ml-2 font-semibold text-gym-accent">{t("openNow")}</span> : null}
            </span>
          </span>
          <span className="shrink-0 text-right text-sm tabular-nums">
            {g.dayPrice != null ? <span className="block">{t("day", { price: money(g.dayPrice) })}</span> : null}
            {g.monthPrice != null ? <span className="block text-white/70">{t("month", { price: money(g.monthPrice) })}</span> : null}
          </span>
        </Link>
      ))}
    </div>
  );
}
