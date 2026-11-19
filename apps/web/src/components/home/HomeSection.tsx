"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { IconButton, Skeleton } from "@kriraghor/ui/kit";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { isExternal } from "@/lib/links";
import type { SectionKey } from "@/lib/home";

export type RailState = "loading" | "error" | "empty" | "ready";

/** A sideways rail of cards: swipe on phones, arrows from `sm` up. */
function Rail({ section, state, children }: { section: SectionKey; state: RailState; children: ReactNode }) {
  const t = useTranslations(`home.sections.${section}`);
  const ts = useTranslations("home.search");
  const row = useRef<HTMLUListElement>(null);
  const [overflows, setOverflows] = useState(false);
  // The arrows only show when there is more to see than fits.
  useEffect(() => {
    const el = row.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    measure();
    return () => watch.disconnect();
  }, [state]);
  const move = (dir: 1 | -1) => {
    const el = row.current;
    if (!el) return;
    const card = el.querySelector("li");
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    el.scrollBy({ left: dir * ((card?.clientWidth ?? 280) + 16), behavior });
  };
  if (state === "empty" || state === "error") return <p className="mt-5 rounded-card border border-dashed border-line-strong/50 p-6 text-muted">{state === "empty" ? t("none") : ts("failed")}</p>;
  return (
    <div className="mt-5">
      <ul ref={row} className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-px-5 px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-testid={`rail-${section}`}>
        {state === "loading"
          ? [0, 1, 2, 3].map((i) => (
              <li key={i} className="w-[280px] shrink-0">
                <Skeleton className="h-[316px] rounded-card" />
              </li>
            ))
          : children}
      </ul>
      {overflows ? (
        <span className="mt-3 hidden justify-end gap-2 sm:flex">
          <IconButton label={ts("prev")} variant="secondary" onClick={() => move(-1)}>
            <CaretLeft size={20} aria-hidden />
          </IconButton>
          <IconButton label={ts("next")} variant="secondary" onClick={() => move(1)}>
            <CaretRight size={20} aria-hidden />
          </IconButton>
        </span>
      ) : null}
    </div>
  );
}

/** One of the six home sections: the title and a rail of live cards, or its own `body`. */
export function HomeSection({ section, icon, allHref, extra, state = "ready", body, children }: { section: SectionKey; icon: ReactNode; allHref: string; extra?: ReactNode; state?: RailState; body?: ReactNode; children?: ReactNode }) {
  const t = useTranslations(`home.sections.${section}`);
  const all = (
    <>
      {t("all")} <ArrowRight size={16} aria-hidden />
    </>
  );
  const allClass = "inline-flex min-h-11 items-center gap-1 font-bold text-brand-text underline-offset-4 hover:underline";
  return (
    <section id={section} className="mx-auto max-w-wide scroll-mt-24 px-5 pt-14 md:pt-16" aria-labelledby={`${section}-title`} data-testid={`home-section-${section}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-text">{icon}</span>
          <div>
            <h2 id={`${section}-title`} className="text-[clamp(26px,3vw,36px)] font-extrabold uppercase leading-tight">
              {t("title")}
            </h2>
            <p className="text-muted">{t("sub")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5">
          {extra}
          {isExternal(allHref) ? (
            <a href={allHref} className={allClass}>
              {all}
            </a>
          ) : (
            <Link href={allHref} className={allClass}>
              {all}
            </Link>
          )}
        </div>
      </div>
      {body ? (
        <div className="mt-5">{body}</div>
      ) : (
        <Rail section={section} state={state}>
          {children}
        </Rail>
      )}
    </section>
  );
}
