"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowUpRight, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { IconButton } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { useCarouselRow } from "@kriraghor/ui/motion";
import { api } from "@kriraghor/api-client";
import { PHOTOS } from "@/lib/photos";
import { esportsHref } from "@/lib/links";
import { useOpenEsports } from "./queries";

type Facet = { key: string; count: number };

const WIDE = "(min-width: 900px)";
const subscribeWide = (fn: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
};
const useWide = () => useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => true);

/**
 * "Pick your sport" as in the Claude Design home. Desktop: three cards in view; the card under the
 * pointer (or keyboard focus) widens to 1.5× while the others give way, and its photo zooms.
 * Phones: 78% wide cards that swipe; the one in the middle is the "open" card (full colour, count and
 * arrow), the others step back a little. The row moves on by itself every 4.2 s while it is on screen
 * and nobody is touching it; reduced motion keeps it still.
 */
export function SportCards() {
  const t = useTranslations("home.sports");
  const wide = useWide();
  const { ref: row, move, handlers } = useCarouselRow<HTMLUListElement>({ interval: 4200, gap: 20 });
  const [hover, setHover] = useState<number | null>(null);
  const [centre, setCentre] = useState(0);

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

  // Phones: which card is in the middle.
  useEffect(() => {
    const el = row.current;
    if (!el || wide || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCentre(Number((e.target as HTMLElement).dataset.i));
      },
      { root: el, rootMargin: "0px -40% 0px -40%", threshold: 0 },
    );
    el.querySelectorAll("li").forEach((li) => io.observe(li));
    return () => io.disconnect();
  }, [wide]);

  const widthOf = (i: number) => {
    if (!wide) return "78%";
    const base = "((100% - 40px) / 3)";
    if (hover === i) return `calc(${base} * 1.5)`;
    if (hover !== null) return `calc(${base} * 0.9)`;
    return `calc${base}`;
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
      <ul
        ref={row}
        className="-mx-5 mt-6 flex h-[400px] snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain scroll-px-5 px-5 [scrollbar-width:none] md:h-[440px] md:snap-proximity [&::-webkit-scrollbar]:hidden"
        {...handlers}
        onMouseLeave={() => {
          handlers.onMouseLeave();
          setHover(null);
        }}
      >
        {cards.map((c, i) => {
          const open = wide ? hover === i : centre === i;
          return (
            <li
              key={c.key}
              data-i={i}
              className={cn(
                "relative h-full shrink-0 snap-start overflow-hidden rounded-card bg-band shadow-sm transition-[width,transform,opacity] duration-[750ms] ease-[cubic-bezier(.16,1,.3,1)]",
                !wide && !open && "scale-[0.95] opacity-80",
              )}
              style={{ width: widthOf(i) }}
            >
              <Link
                href={c.href}
                className="group absolute inset-0 flex no-underline"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover((h) => (h === i ? null : h))}
                data-testid={`sport-${c.key}`}
              >
                <Image src={c.photo} alt="" fill sizes="(min-width: 900px) 50vw, 78vw" className={cn("object-cover transition-transform duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)]", open ? "scale-[1.06]" : "scale-100")} />
                <span className="absolute inset-0 bg-gradient-to-t from-band via-band/30 to-transparent" aria-hidden />
                <span className="relative mt-auto flex w-full items-end justify-between gap-3 p-5">
                  <span className="min-w-0">
                    <span className={cn("block whitespace-nowrap text-[32px] font-bold leading-none text-white", c.key === "gym" ? "font-gym uppercase tracking-normal" : "font-display")}>{t(`names.${c.key}`)}</span>
                    {c.count ? <span className="mt-2 block text-sm text-white/80">{c.count}</span> : null}
                  </span>
                  <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-control bg-prize text-prize-ink transition-transform duration-300", open && "-translate-y-0.5 translate-x-0.5")} aria-hidden>
                    <ArrowUpRight size={20} weight="bold" />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
