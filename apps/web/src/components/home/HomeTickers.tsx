"use client";

import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Barbell, Handshake } from "@phosphor-icons/react";
import { SkeletonList } from "@kriraghor/ui/kit";
import { FlipTicker } from "@kriraghor/ui/motion";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { hire } from "@/lib/hire";
import { gymHref } from "@/lib/links";
import { sectionUrl } from "@/lib/home";
import { formatTaka } from "@/lib/payments";
import { PHOTOS } from "@/lib/photos";
import { HomeSection } from "./HomeSection";
import { rolePhoto, type HireCard } from "./SectionCards";
import { nameOf } from "./queries";
import { RAIL_MAX, sectionItems } from "./section-data";

const PER_PAGE = 3;

/** One scoreboard column: the top-rated people in a category, three at a time, flipping to the next three. */
function HireColumn({ category, title, delay, interval }: { category: "officials" | "players"; title: string; delay: number; interval: number }) {
  const t = useTranslations("home.tickers");
  const tc = useTranslations("home.cards");
  const ts = useTranslations("home.search");
  const none = useTranslations("home.sections.hire");
  const locale = useLocale();
  const pros = useQuery({ queryKey: ["home-hire", category], queryFn: () => hire.list({ category }) });
  const people = ((pros.data?.items ?? []) as unknown as HireCard[]).slice(0, RAIL_MAX);
  return (
    <div className="surface-card min-w-0 p-5">
      {pros.isPending ? (
        <SkeletonList rows={PER_PAGE} />
      ) : !people.length ? (
        <>
          <h3 className="text-lg font-bold">{title}</h3>
          <p className="mt-3 text-sm text-muted">{pros.isError ? ts("failed") : none("none")}</p>
        </>
      ) : (
        <FlipTicker
          items={people}
          perPage={PER_PAGE}
          interval={interval}
          delay={delay}
          keyOf={(p) => p.id}
          labels={{ prev: t("hirePrev"), next: t("hireNext"), pause: t("pause"), play: t("play") }}
          title={
            <h3 className="flex flex-wrap items-baseline gap-x-2 text-lg font-bold">
              {title}
              <span className="text-sm font-medium text-muted">{t("available", { n: people.length })}</span>
            </h3>
          }
          render={(p) => (
            <Link href={`/hiring/${p.slug}`} className="grid min-h-[88px] grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3.5 py-3 no-underline transition-colors hover:bg-ink/[0.03]" data-testid="home-hire-card">
              <span className="relative size-16 overflow-hidden rounded-[12px] bg-surface-2">
                <Image src={rolePhoto(p.role?.key)} alt="" fill sizes="64px" className="object-cover" />
              </span>
              <span className="min-w-0">
                <b className="block truncate">{p.name}</b>
                <span className="block truncate text-sm text-muted">{nameOf(p.role, locale)}</span>
                {p.headline ? <span className="block truncate text-xs font-semibold text-brand-text">{p.headline}</span> : null}
              </span>
              {p.rateFrom != null ? <span className="shrink-0 text-right font-display font-bold tabular-nums">{tc(p.rateUnit === "hourly" ? "perHour" : "perMatch", { price: formatTaka(p.rateFrom, locale) })}</span> : null}
            </Link>
          )}
        />
      )}
    </div>
  );
}

/** Hire keeps its scoreboard: umpires and referees, and players, flipping a little apart. */
export function HireSection() {
  const t = useTranslations("home.tickers");
  return (
    <HomeSection
      section="hire"
      icon={<Handshake size={26} aria-hidden />}
      allHref={sectionUrl("hire")}
      body={
        <div className="grid gap-5 md:grid-cols-2">
          <HireColumn category="officials" title={t("officials")} delay={0} interval={4200} />
          <HireColumn category="players" title={t("players")} delay={1900} interval={5600} />
        </div>
      }
    />
  );
}

/** Gym keeps its list that turns over sideways like cards, unlike the hire scoreboard's flip. */
export function GymSection() {
  const t = useTranslations("home.tickers");
  const tc = useTranslations("home.cards");
  const ts = useTranslations("home.search");
  const none = useTranslations("home.sections.gym");
  const locale = useLocale();
  const gyms = useQuery({ queryKey: ["home-rail", "gym"], queryFn: () => sectionItems.gym() });
  const list = (gyms.data ?? []).slice(0, RAIL_MAX);
  const money = (n: number) => formatTaka(n, locale);
  return (
    <HomeSection
      section="gym"
      icon={<Barbell size={26} aria-hidden />}
      allHref={sectionUrl("gym")}
      body={
        <div className="grid gap-5 md:grid-cols-[2fr_3fr]">
          <div className="relative min-h-52 overflow-hidden rounded-card bg-surface-2">
            <Image src={PHOTOS.gym} alt="" fill sizes="(min-width: 900px) 40vw, 100vw" className="object-cover" />
          </div>
          <div className="surface-card min-w-0 p-5">
            {gyms.isPending ? (
              <SkeletonList rows={PER_PAGE} />
            ) : !list.length ? (
              <p className="text-sm text-muted">{gyms.isError ? ts("failed") : none("none")}</p>
            ) : (
              <FlipTicker
                items={list}
                perPage={PER_PAGE}
                interval={5600}
                delay={900}
                effect="turn"
                keyOf={(g) => g.id}
                labels={{ prev: t("gymPrev"), next: t("gymNext"), pause: t("pause"), play: t("play") }}
                title={
                  <h3 className="flex flex-wrap items-baseline gap-x-2 text-lg font-bold">
                    {t("gymList")}
                    <span className="text-sm font-medium text-muted">{t("gymCount", { n: list.length })}</span>
                  </h3>
                }
                render={(g) => (
                  <a href={gymHref(`/gyms/${encodeURIComponent(g.slug)}`)} className="grid min-h-[88px] grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3.5 py-3 no-underline transition-colors hover:bg-ink/[0.03]" data-testid="home-gym">
                    <span className="relative size-16 overflow-hidden rounded-[12px] bg-surface-2">
                      {g.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={g.cover} alt="" loading="lazy" width={64} height={64} className="h-full w-full object-cover" />
                      ) : (
                        <Image src={PHOTOS.gym} alt="" fill sizes="64px" className="object-cover" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <b className="block truncate">{g.name}</b>
                      <span className="block truncate text-sm text-muted">
                        {nameOf(g.area, locale)}
                        {g.openNow ? <span className="ml-2 font-semibold text-brand-text">{tc("openNow")}</span> : null}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-sm tabular-nums">
                      {g.monthPrice != null ? <b className="block">{tc("monthly", { price: money(g.monthPrice) })}</b> : null}
                    </span>
                  </a>
                )}
              />
            )}
          </div>
        </div>
      }
    />
  );
}
