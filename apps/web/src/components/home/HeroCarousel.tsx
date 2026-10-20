"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ArrowRight, CaretLeft, CaretRight, Pause, Play } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { cn } from "@kriraghor/ui/cn";
import { useMotionOk } from "@kriraghor/ui/motion";

export type HeroSlide = {
  key: string;
  tab: string;
  kicker: ReactNode;
  title: ReactNode;
  sub: string;
  cta: string;
  href: string;
  photo: string;
  /** Beside the text on wide screens (the esports slide: the next event). */
  aside?: ReactNode;
};

const DWELL = 6500;

/**
 * The home hero, rebuilt from the Claude Design: full-bleed photo slides that cross-fade (1.2 s)
 * while the photo slowly zooms (8 s), each slide's lines rising in one after another, and labelled
 * progress bars that fill over 6.5 s. Esports is the first slide (priority 1).
 * It stops while hovered or focused and in a hidden tab, has previous/next and a Pause/Play button
 * (WCAG 2.2.2), and never moves under reduced motion.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const t = useTranslations("home.carousel");
  const motionOk = useMotionOk();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  // Bumped whenever the dwell restarts, so the progress bar starts again from empty.
  const [run, setRun] = useState(0);
  const playing = motionOk && !paused && !held;

  const go = (i: number) => {
    setIndex((i + slides.length) % slides.length);
    setRun((r) => r + 1);
  };

  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => {
      if (document.hidden) {
        setRun((r) => r + 1);
        return;
      }
      setIndex((i) => (i + 1) % slides.length);
      setRun((r) => r + 1);
    }, DWELL);
    return () => window.clearTimeout(id);
  }, [playing, index, run, slides.length]);

  const hold = (on: boolean) => {
    setHeld(on);
    if (!on) setRun((r) => r + 1); // as in the design: the bar starts again after a hover
  };

  return (
    <section
      className="relative h-[clamp(600px,82vh,780px)] overflow-hidden bg-band text-band-text"
      aria-roledescription="carousel"
      aria-label={t("label")}
      onMouseEnter={() => hold(true)}
      onMouseLeave={() => hold(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hold(false);
      }}
      data-testid="hero"
    >
      {slides.map((s, i) => {
        const on = i === index;
        return (
          <div
            key={s.key}
            className={cn("absolute inset-0 transition-[opacity,visibility] duration-[1200ms] ease-[cubic-bezier(.65,0,.35,1)]", on ? "visible opacity-100" : "invisible opacity-0")}
            aria-hidden={!on}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${slides.length}: ${s.tab}`}
            data-testid={`hero-slide-${s.key}`}
          >
            <Image
              src={s.photo}
              alt=""
              fill
              priority={i === 0}
              sizes="100vw"
              className={cn("object-cover transition-transform duration-[8000ms] ease-linear", on && motionOk ? "scale-[1.08]" : "scale-100")}
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(5_22_14/0.92)_0%,rgb(5_22_14/0.66)_45%,rgb(5_22_14/0.1)_100%)]" aria-hidden />
            <div className="absolute inset-0 bg-gradient-to-t from-band/70 via-transparent to-transparent md:hidden" aria-hidden />
            <div className="relative mx-auto grid h-full max-w-wide items-end gap-10 px-5 pb-[200px] md:grid-cols-[7fr_5fr] md:pb-[176px]">
              <div className={cn("flex flex-col gap-4 sm:gap-5", on && "kg-slide-in")}>
                <div className="kg-slide-line text-sm font-bold text-prize">{s.kicker}</div>
                {i === 0 ? (
                  <h1 className="kg-slide-line max-w-[15ch] text-[clamp(38px,5.6vw,76px)] leading-[1.02] tracking-[-0.04em] text-band-text [text-wrap:balance]" data-testid="home-title">
                    {s.title}
                  </h1>
                ) : (
                  <h2 className="kg-slide-line max-w-[15ch] text-[clamp(38px,5.6vw,76px)] leading-[1.02] tracking-[-0.04em] text-band-text [text-wrap:balance]">{s.title}</h2>
                )}
                <p className="kg-slide-line max-w-[46ch] text-base text-band-muted sm:text-lg">{s.sub}</p>
                <div className="kg-slide-line">
                  <Link href={s.href} tabIndex={on ? 0 : -1} className="inline-flex min-h-12 items-center gap-3 rounded-control bg-prize px-6 font-bold text-prize-ink no-underline shadow-[0_10px_30px_-12px_rgb(242_163_58/0.7)] transition-[background-color,transform] duration-200 hover:brightness-105 active:translate-y-px">
                    {s.cta}
                    <ArrowRight size={18} weight="bold" aria-hidden />
                  </Link>
                </div>
              </div>
              {s.aside ? <div className={cn("hidden self-center md:block", on && "kg-slide-in")}><div className="kg-slide-line">{s.aside}</div></div> : null}
            </div>
          </div>
        );
      })}

      {/* Progress bars with their labels, previous / next, pause. */}
      <div className="absolute inset-x-0 bottom-0">
        <div className="mx-auto flex max-w-wide items-end gap-4 px-5 pb-[100px] md:gap-5 md:pb-[96px]">
          <div className="grid flex-1 gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${slides.length}, minmax(0, 1fr))` }}>
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => go(i)}
                aria-label={t("goTo", { name: s.tab })}
                aria-current={i === index ? "true" : undefined}
                className={cn("flex min-h-11 flex-col justify-end gap-2 pt-3 text-left text-band-text transition-opacity duration-300 hover:opacity-100", i === index ? "opacity-100" : "opacity-60")}
                data-testid={`hero-tab-${s.key}`}
              >
                <span className="relative h-[3px] overflow-hidden rounded-pill bg-band-text/30">
                  <span
                    key={i === index ? `${index}-${run}` : "idle"}
                    className={cn("absolute inset-0 origin-left rounded-pill bg-prize", i === index ? (playing ? "kg-hero-fill" : "scale-x-100") : i < index ? "scale-x-100 opacity-40" : "scale-x-0")}
                    style={i === index && playing ? { animationDuration: `${DWELL}ms` } : undefined}
                  />
                </span>
                <span className="hidden truncate text-[13px] font-semibold md:block">{s.tab}</span>
              </button>
            ))}
          </div>
          <div className="flex shrink-0 gap-2">
            {motionOk ? (
              <HeroButton label={paused ? t("play") : t("pause")} onClick={() => setPaused((p) => !p)} pressed={paused} testId="hero-pause">
                {paused ? <Play size={18} weight="fill" aria-hidden /> : <Pause size={18} weight="fill" aria-hidden />}
              </HeroButton>
            ) : null}
            <HeroButton label={t("prev")} onClick={() => go(index - 1)} testId="hero-prev">
              <CaretLeft size={18} weight="bold" aria-hidden />
            </HeroButton>
            <HeroButton label={t("next")} onClick={() => go(index + 1)} testId="hero-next">
              <CaretRight size={18} weight="bold" aria-hidden />
            </HeroButton>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroButton({ label, onClick, pressed, testId, children }: { label: string; onClick: () => void; pressed?: boolean; testId: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className="inline-flex size-11 items-center justify-center rounded-control border border-band-text/40 bg-band-text/10 text-band-text backdrop-blur transition-colors hover:bg-band-text/20"
      data-testid={testId}
    >
      {children}
    </button>
  );
}
