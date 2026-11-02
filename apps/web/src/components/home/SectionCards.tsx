"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { esportsHref, gymHref, isExternal } from "@/lib/links";
import { PHOTOS } from "@/lib/photos";
import { formatTaka } from "@/lib/payments";
import type { Card as EventCard } from "@/lib/tournaments";
import type { MarketCard } from "@/lib/market";
import { nameOf, type BigEvent, type EsportsCard, type Named } from "./queries";

export type GymCard = { id: string; slug: string; name: string; area: Named | null; cover: string | null; dayPrice: number | null; monthPrice: number | null; openNow: boolean };
export type VenueCard = { id: string; slug: string; name: string; area: Named | null; coverUrl: string | null; sports: Named[]; priceFromPoisha: number };
export type HireCard = { id: string; slug: string; name: string; headline: string | null; role: Named | null; area: Named | null; rateFrom: number | null; rateUnit: "hourly" | "match" | null };

/** One card of a home rail or a /search group: the whole card is the link, the button only shows where it goes. */
function RailCard({ href, photo, cover, tag, title, meta, stat, cta, testId }: { href: string; photo: string; cover?: string | null; tag?: string; title: string; meta: ReactNode; stat: ReactNode; cta: string; testId: string }) {
  const body = (
    <>
      <span className="relative block h-40 shrink-0 overflow-hidden bg-surface-2">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" loading="lazy" width={560} height={320} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <Image src={photo} alt="" fill sizes="280px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
        )}
        {tag ? <span className="absolute left-2.5 top-2.5 max-w-[calc(100%-20px)] truncate rounded-pill bg-band/80 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">{tag}</span> : null}
      </span>
      <span className="flex flex-1 flex-col gap-1 p-4">
        <span className="line-clamp-2 font-display text-lg font-bold leading-snug">{title}</span>
        <span className="line-clamp-2 min-h-10 text-sm text-muted">{meta}</span>
        <span className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
          <span className="min-w-0 font-bold tabular-nums">{stat}</span>
          <span className="inline-flex min-h-9 shrink-0 items-center rounded-control bg-brand px-3 font-bold text-on-brand transition-colors group-hover:bg-brand-hover">{cta}</span>
        </span>
      </span>
    </>
  );
  const className = "rv group glass-card flex h-full flex-col overflow-hidden no-underline transition-colors hover:border-brand";
  return isExternal(href) ? (
    <a href={href} className={className} data-testid={testId}>
      {body}
    </a>
  ) : (
    <Link href={href} className={className} data-testid={testId}>
      {body}
    </Link>
  );
}

const useCard = () => {
  const t = useTranslations("home.cards");
  const locale = useLocale();
  return { t, locale, money: (n: number) => formatTaka(n, locale) };
};

export function EsportsTile({ item }: { item: EsportsCard }) {
  const { t, locale, money } = useCard();
  return (
    <RailCard
      href={esportsHref(`/events/${item.slug}`)}
      photo={PHOTOS.esports}
      tag={nameOf(item.game, locale)}
      title={locale === "bn" ? item.titleBn : item.titleEn}
      meta={t("esportsMeta", { fee: item.entryFee.amount === 0 ? t("free") : money(item.entryFee.amount), prize: money(item.prizePool.amount) })}
      stat={t(item.entryUnit === "squad" ? "squads" : "players", { taken: item.slotsTaken, max: item.maxSlots })}
      cta={t("register")}
      testId="open-card"
    />
  );
}

export function ShowcaseTile({ item }: { item: BigEvent }) {
  const { t, locale, money } = useCard();
  return (
    <RailCard
      href={esportsHref(`/showcases/${item.slug}`)}
      photo={PHOTOS.esports}
      tag={t("showcase")}
      title={locale === "bn" ? item.titleBn : item.titleEn}
      meta={t("showcaseMeta")}
      stat={money(item.prizeTotal.amount)}
      cta={t("view")}
      testId="home-showcase"
    />
  );
}

export function GymTile({ item }: { item: GymCard }) {
  const { t, locale, money } = useCard();
  return (
    <RailCard
      href={gymHref(`/gyms/${encodeURIComponent(item.slug)}`)}
      photo={PHOTOS.gym}
      cover={item.cover}
      tag={item.openNow ? t("openNow") : undefined}
      title={item.name}
      meta={nameOf(item.area, locale)}
      stat={item.dayPrice != null ? t("dayPass", { price: money(item.dayPrice) }) : item.monthPrice != null ? t("monthly", { price: money(item.monthPrice) }) : ""}
      cta={t("viewGym")}
      testId="home-gym"
    />
  );
}

export function VenueTile({ item }: { item: VenueCard }) {
  const { t, locale, money } = useCard();
  const sports = item.sports.map((s) => nameOf(s, locale));
  return (
    <RailCard
      href={`/venues/${item.slug}`}
      photo={PHOTOS.groundsFloodlit}
      cover={item.coverUrl}
      tag={sports[0]}
      title={item.name}
      meta={[nameOf(item.area, locale), sports.join(", ")].filter(Boolean).join(" · ")}
      stat={t("perHour", { price: money(item.priceFromPoisha) })}
      cta={t("bookSlot")}
      testId="home-ground"
    />
  );
}

export function ProductTile({ item }: { item: MarketCard }) {
  const { t, locale, money } = useCard();
  return (
    <RailCard
      href={`/shop/p/${item.slug}`}
      photo={PHOTOS.shopGear}
      cover={item.coverUrl}
      tag={item.itemType ? nameOf(item.itemType as { nameEn: string; nameBn: string }, locale) : undefined}
      title={item.title}
      meta={[item.shop.name, nameOf(item.shop.area, locale)].filter(Boolean).join(" · ")}
      stat={money(item.priceFromPoisha)}
      cta={t("viewItem")}
      testId="home-product"
    />
  );
}

/** A sport photo for a hire role (profiles have no photos yet). */
export function rolePhoto(roleKey: string | undefined) {
  const k = roleKey ?? "";
  if (k.includes("cricket")) return PHOTOS.cricket;
  if (k.includes("badminton")) return PHOTOS.badminton;
  if (k.includes("football") || k.includes("futsal")) return PHOTOS.groundsFloodlit;
  return PHOTOS.hire;
}

export function HireTile({ item }: { item: HireCard }) {
  const { t, locale, money } = useCard();
  return (
    <RailCard
      href={`/hiring/${item.slug}`}
      photo={rolePhoto(item.role?.key)}
      tag={nameOf(item.role, locale)}
      title={item.name}
      meta={item.headline || nameOf(item.area, locale)}
      stat={item.rateFrom != null ? t(item.rateUnit === "hourly" ? "perHour" : "perMatch", { price: money(item.rateFrom) }) : ""}
      cta={t("hireNow")}
      testId="home-hire-card"
    />
  );
}

export function EventTile({ item }: { item: EventCard }) {
  const { t, locale, money } = useCard();
  return (
    <RailCard
      href={`/events/${item.slug}`}
      photo={PHOTOS.tournaments}
      tag={locale === "bn" ? item.sport.nameBn : item.sport.nameEn}
      title={item.name}
      meta={item.organisation?.name ?? ""}
      stat={item.entryFeePoisha ? money(item.entryFeePoisha) : t("free")}
      cta={t("view")}
      testId="tournament-card"
    />
  );
}
