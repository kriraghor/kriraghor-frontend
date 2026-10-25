"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, SealCheck } from "@phosphor-icons/react";
import Image from "next/image";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { PHOTOS } from "@/lib/photos";
import { ButtonLink, Skeleton, SkeletonList } from "@kriraghor/ui/kit";
import { gymHref } from "@/lib/links";
import { FlipTicker } from "@kriraghor/ui/motion";
import { api } from "@kriraghor/api-client";
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

/**
 * Hire (home-v3 §7, M11), the Claude Design scoreboard: two columns, umpires and referees, and
 * players, three people each, flipping to the next three like a scoreboard (FlipTicker: pause,
 * up/down, holds on hover and focus). Then every role group with its Bangla name.
 */
export function HomeHire() {
  const t = useTranslations("home.hire");
  const taxonomy = useQuery({ queryKey: ["home-hire-taxonomy-full"], staleTime: 3600_000, queryFn: () => items<Category>(api().GET("/hire/taxonomy")) });

  return (
    <section className="mx-auto max-w-wide px-5 pt-[72px]" id="hire" aria-labelledby="hire-title" data-testid="home-hire">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="hire-title" className="text-[clamp(28px,3.4vw,40px)]">
            {t("title")}
          </h2>
          <p className="mt-2 max-w-[60ch] text-muted">{t("sub")}</p>
        </div>
        <ButtonLink href="/hiring" variant="link" iconEnd={<ArrowRight size={16} aria-hidden />}>
          {t("all")}
        </ButtonLink>
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <HireColumn category="officials" title={t("officials")} delay={0} />
        <HireColumn category="players" title={t("playersTitle")} delay={1900} />
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm text-muted">
        <SealCheck size={18} className="shrink-0 text-brand-text" aria-hidden />
        {t("checked")}
      </p>

      <h3 className="mt-10 text-xl">{t("byRole")}</h3>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(taxonomy.data ?? []).map((c) => (
          <Link key={c.key} href={`/hiring?category=${encodeURIComponent(c.key)}`} className="rv group flex min-h-28 flex-col justify-between glass-card p-4 no-underline">
            <span className="font-bangla text-sm text-muted" lang="bn">
              {c.nameBn}
            </span>
            <span className="flex items-center justify-between gap-2">
              <b lang="en">{c.nameEn}</b>
              <ArrowRight size={16} aria-hidden className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
            </span>
          </Link>
        ))}
        {taxonomy.isPending ? [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28 rounded-card" />) : null}
      </div>
    </section>
  );
}

/** A sport photo for a hire role's row (as in the Claude Design); profiles have no photos yet. */
function sportPhoto(roleKey: string | undefined) {
  const k = roleKey ?? "";
  if (k.includes("cricket")) return PHOTOS.cricket;
  if (k.includes("badminton")) return PHOTOS.badminton;
  if (k.includes("football") || k.includes("futsal")) return PHOTOS.groundsFloodlit;
  return PHOTOS.hire;
}

/** One scoreboard column: the top-rated nine in a category, three at a time. */
function HireColumn({ category, title, delay }: { category: "officials" | "players"; title: string; delay: number }) {
  const t = useTranslations("home.hire");
  const locale = useLocale();
  const pros = useQuery({ queryKey: ["home-hire", category], queryFn: () => items<Pro>(api().GET("/hire/profiles", { params: { query: { category, sort: "rating", limit: 9 } as never } })) });
  const people = pros.data ?? [];
  return (
    <div className="glass-card p-5">
      {pros.isPending ? (
        <SkeletonList rows={3} />
      ) : !people.length ? (
        <>
          <h3 className="text-lg">{title}</h3>
          <p className="mt-3 text-sm text-muted">{t("none")}</p>
        </>
      ) : (
        <FlipTicker
          items={people}
          perPage={3}
          interval={category === "officials" ? 4200 : 5600}
          delay={delay}
          keyOf={(p) => p.id}
          labels={{ prev: t("prev"), next: t("next"), pause: t("pause"), play: t("play") }}
          title={
            <h3 className="flex items-baseline gap-2 text-lg">
              {title}
              <span className="text-sm font-medium text-muted">{t("available", { n: people.length })}</span>
            </h3>
          }
          render={(p) => (
            <Link href={`/hiring/${p.slug}`} className="grid min-h-[88px] grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3.5 py-3 no-underline transition-colors hover:bg-ink/[0.03]">
              <span className="relative size-16 overflow-hidden rounded-[12px] bg-surface-2">
                <Image src={sportPhoto(p.role?.key)} alt="" fill sizes="64px" className="object-cover" />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block truncate">{p.name}</b>
                <span className="block truncate text-sm text-muted">{nameOf(p.role, locale)}</span>
                {p.headline ? <span className="block truncate text-xs font-semibold text-brand-text">{p.headline}</span> : null}
              </span>
              {p.rateFrom != null ? (
                <span className="shrink-0 text-right font-display text-lg font-bold tabular-nums">
                  {formatTaka(p.rateFrom, locale)}
                  <span className="block font-sans text-xs font-normal text-muted">{t(p.rateUnit === "hourly" ? "perHour" : "perMatch")}</span>
                </span>
              ) : null}
            </Link>
          )}
        />
      )}
    </div>
  );
}

/**
 * Gym (home-v3 §8, M20 is live): the sub-brand band's gym list. Three gyms at a time out of up to
 * nine, turning over sideways like cards every 5.6 s (FlipTicker "turn", deliberately not the hire
 * section's scoreboard flip), with pause and up/down. The band sets data-theme="gym" around it.
 */
export function HomeGym() {
  const t = useTranslations("home.gym");
  const locale = useLocale();
  const gyms = useQuery({ queryKey: ["home-gyms"], queryFn: () => items<Gym>(api().GET("/gym/gyms", { params: { query: { sort: "rating", limit: 9 } as never } })) });
  const list = gyms.data ?? [];
  const money = (n: number) => formatTaka(n, locale);

  if (gyms.isPending) return <SkeletonList rows={3} />;
  if (!list.length) return <p className="rounded-card border border-white/20 p-5 text-white/75">{t("none")}</p>;
  return (
    <FlipTicker
      items={list}
      perPage={3}
      interval={5600}
      delay={900}
      effect="turn"
      keyOf={(g) => g.id}
      labels={{ prev: t("prev"), next: t("next"), pause: t("pause"), play: t("play") }}
      title={
        <h3 className="flex items-baseline gap-2 text-lg text-white">
          {t("listTitle")}
          <span className="text-sm font-medium text-white/60">{t("count", { n: list.length })}</span>
        </h3>
      }
      className="[&_li]:border-0"
      render={(g) => (
        <div className="py-1.5">
          <a href={gymHref(`/gyms/${encodeURIComponent(g.slug)}`)} className="glass-band flex min-h-[84px] items-center gap-4 rounded-[18px] p-4 no-underline transition-colors hover:border-gym-accent" data-testid="home-gym">
            <span className="min-w-0 flex-1">
              <b className="block truncate text-lg">{g.name}</b>
              <span className="block text-sm text-white/70">
                {nameOf(g.area, locale)}
                {g.openNow ? <span className="ml-2 font-semibold text-gym-accent">{t("openNow")}</span> : null}
              </span>
            </span>
            <span className="shrink-0 text-right text-sm tabular-nums">
              {g.dayPrice != null ? <span className="block">{t("day", { price: money(g.dayPrice) })}</span> : null}
              {g.monthPrice != null ? <span className="block text-white/70">{t("month", { price: money(g.monthPrice) })}</span> : null}
            </span>
          </a>
        </div>
      )}
    />
  );
}
