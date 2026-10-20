"use client";

import { useRef } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowUpRight, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { IconButton } from "@kriraghor/ui/kit";
import { useMotionOk } from "@kriraghor/ui/motion";
import { api } from "@kriraghor/api-client";
import { PHOTOS } from "@/lib/photos";
import { esportsHref } from "@/lib/links";
import { useOpenEsports } from "./queries";

type Facet = { key: string; count: number };

/**
 * "Pick your sport" (from the Claude Design home): big photo cards with the count and an amber
 * arrow, in a row that swipes on phones and moves a card at a time with the arrows; the photos ease
 * in from a slight zoom as the row moves. No auto-advance.
 */
export function SportCards() {
  const t = useTranslations("home.sports");
  const motionOk = useMotionOk();
  const row = useRef<HTMLUListElement>(null);
  const facets = useQuery({
    queryKey: ["home-sport-facets"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await api().GET("/grounds", { params: { query: { limit: 1 } as never } });
      if (error || !data) throw error;
      return ((data as { facets?: { sports?: Facet[] } }).facets?.sports ?? []) as Facet[];
    },
  });
  const gyms = useQuery({
    queryKey: ["home-gym-total"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await api().GET("/gym/gyms", { params: { query: { limit: 1 } as never } });
      if (error || !data) throw error;
      return (data as { total?: number }).total ?? null;
    },
  });
  const open = useOpenEsports();
  const venues = (key: string) => facets.data?.find((f) => f.key === key)?.count;

  const cards = [
    { key: "esports", href: esportsHref(), photo: PHOTOS.esports, count: open.data ? t("events", { n: open.data.items.length }) : null },
    { key: "cricket", href: "/venues?sport=cricket", photo: PHOTOS.cricket, count: venues("cricket") != null ? t("venues", { n: venues("cricket")! }) : null },
    { key: "football", href: "/venues?sport=football", photo: PHOTOS.groundsFloodlit, count: venues("football") != null ? t("venues", { n: venues("football")! }) : null },
    { key: "badminton", href: "/venues?sport=badminton", photo: PHOTOS.badminton, count: venues("badminton") != null ? t("venues", { n: venues("badminton")! }) : null },
    { key: "gym", href: "/gym", photo: PHOTOS.gym, count: gyms.data != null ? t("gyms", { n: gyms.data }) : null },
  ];

  const move = (dir: 1 | -1) => {
    const el = row.current;
    if (!el) return;
    const card = el.querySelector("li");
    el.scrollBy({ left: dir * ((card?.getBoundingClientRect().width ?? 300) + 16), behavior: motionOk ? "smooth" : "auto" });
    if (!motionOk) return;
    el.querySelectorAll("img").forEach((img, i) => {
      if (typeof img.animate === "function") img.animate([{ transform: "scale(1.12)" }, { transform: "scale(1)" }], { duration: 1100, delay: i * 60, easing: "cubic-bezier(.22,1,.36,1)" });
    });
  };

  return (
    <section className="mx-auto max-w-wide px-5 pt-[72px]" aria-labelledby="sports-title" data-testid="home-sports">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="sports-title" className="text-[clamp(28px,3.4vw,40px)]">
            {t("title")}
          </h2>
          <p className="mt-2 max-w-[60ch] text-muted">{t("sub")}</p>
        </div>
        <div className="hidden shrink-0 gap-2 sm:flex">
          <IconButton label={t("prev")} variant="secondary" onClick={() => move(-1)}>
            <CaretLeft size={20} aria-hidden />
          </IconButton>
          <IconButton label={t("next")} variant="secondary" onClick={() => move(1)}>
            <CaretRight size={20} aria-hidden />
          </IconButton>
        </div>
      </div>
      <ul ref={row} className="-mx-5 mt-6 grid snap-x snap-mandatory auto-cols-[78%] grid-flow-col gap-4 overflow-x-auto scroll-px-5 px-5 pb-2 [scrollbar-width:none] sm:auto-cols-[46%] lg:auto-cols-[calc((100%-48px)/4)]">
        {cards.map((c) => (
          <li key={c.key} className="snap-start">
            <Link href={c.href} className="rv group relative flex aspect-[4/5] overflow-hidden rounded-card no-underline shadow-sm" data-testid={`sport-${c.key}`}>
              <Image src={c.photo} alt="" fill sizes="(min-width: 1180px) 25vw, (min-width: 640px) 46vw, 78vw" className="object-cover transition-transform duration-700 ease-[var(--ease-kg)] group-hover:scale-105" />
              <span className="absolute inset-0 bg-gradient-to-t from-band via-band/30 to-transparent" aria-hidden />
              <span className="relative mt-auto flex w-full items-end justify-between gap-3 p-5">
                <span className="min-w-0">
                  <span className="block font-display text-3xl font-bold text-white">{t(`names.${c.key}`)}</span>
                  {c.count ? <span className="mt-1 block text-sm text-white/80">{c.count}</span> : null}
                </span>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-prize text-prize-ink transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden>
                  <ArrowUpRight size={20} weight="bold" />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
