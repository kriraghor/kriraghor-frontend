"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, CaretLeft, CaretRight, MagnifyingGlass } from "@phosphor-icons/react";
import { Dropdown, IconButton, Skeleton } from "@kriraghor/ui/kit";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { isExternal } from "@/lib/links";
import { sectionUrl, type SectionKey } from "@/lib/home";
import { nameOf } from "./queries";
import { sectionFilters } from "./section-data";

const FILTER_STALE_MS = 3600_000;

export type RailState = "loading" | "error" | "empty" | "ready";

/** A section's search bar: text and one dropdown, then on to its list page with both in the URL. */
function SectionSearch({ section }: { section: SectionKey }) {
  const t = useTranslations(`home.sections.${section}`);
  const ts = useTranslations("home.search");
  const locale = useLocale();
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const filters = useQuery({ queryKey: ["home-filter", section], staleTime: FILTER_STALE_MS, queryFn: sectionFilters[section] });
  const go = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const href = sectionUrl(section, { q: String(new FormData(e.currentTarget).get("q") ?? ""), filter });
    if (isExternal(href)) window.location.assign(href);
    else router.push(href);
  };
  return (
    <form role="search" aria-label={t("title")} action={sectionUrl(section)} onSubmit={go} className="glass-card mt-5 grid grid-cols-2 items-end gap-3 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,260px)_auto]" data-testid={`section-search-${section}`}>
      <label htmlFor={`${section}-q`} className="col-span-2 flex min-w-0 flex-col gap-1 text-sm font-semibold text-muted md:col-span-1">
        {ts("label")}
        <span className="relative">
          <MagnifyingGlass size={20} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input id={`${section}-q`} name="q" type="search" placeholder={t("hint")} autoComplete="off" enterKeyHint="search" maxLength={60} className="min-h-12 w-full field pl-11 pr-3 text-base text-ink" />
        </span>
      </label>
      <Dropdown id={`${section}-filter`} label={t("filter")} value={filter} onChange={setFilter} anyLabel={t("any")} options={(filters.data ?? []).map((o) => ({ value: o.value, label: nameOf(o, locale) }))} testId={`${section}-filter`} />
      <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-control bg-brand px-3 font-bold text-on-brand transition-colors hover:bg-brand-hover sm:px-5" data-testid={`section-go-${section}`}>
        {t("go")}
      </button>
    </form>
  );
}

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

/** One of the six home sections: title, search bar and a rail of live cards, or its own `body`. */
export function HomeSection({ section, icon, allHref, extra, state = "ready", body, children }: { section: SectionKey; icon: ReactNode; allHref: string; extra?: ReactNode; state?: RailState; body?: ReactNode; children?: ReactNode }) {
  const t = useTranslations(`home.sections.${section}`);
  const all = (
    <>
      {t("all")} <ArrowRight size={16} aria-hidden />
    </>
  );
  const allClass = "inline-flex min-h-11 items-center gap-1 font-bold text-brand-text underline-offset-4 hover:underline";
  return (
    <section id={section} className="mx-auto max-w-wide scroll-mt-24 px-5 pt-16" aria-labelledby={`${section}-title`} data-testid={`home-section-${section}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">{icon}</span>
          <div>
            <h2 id={`${section}-title`} className="text-[clamp(26px,3vw,36px)] font-extrabold leading-tight">
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
      <SectionSearch section={section} />
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
