"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { CaretDown, CaretUp, Pause, Play } from "@phosphor-icons/react";
import { cn } from "../cn";

/*
 * Motion from the Claude Design home (kriraghor-docs 09 §8), rebuilt for the kit: the hire
 * scoreboard flip, a flash when a value changes, numbers that count up. Every piece is off under
 * reduced motion, pauses when it can't be seen, and never hides content.
 */

const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (fn: () => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
};
const readMotion = () => (typeof window === "undefined" || !window.matchMedia ? true : !window.matchMedia(REDUCE).matches);

/** False when the visitor asks for reduced motion. */
export function useMotionOk() {
  return useSyncExternalStore(subscribeMotion, readMotion, () => false);
}

const canAnimate = (el: Element | null): el is HTMLElement => Boolean(el && typeof (el as HTMLElement).animate === "function");

export type FlipTickerLabels = { prev: string; next: string; pause: string; play: string };

/**
 * The scoreboard flip (hire section): `perPage` rows at a time, a window that moves round the
 * list (as in the Claude Design: by `perPage`, or by one when the list is that short), so it flips
 * whenever there are two people or more. On each turn the rows rotate out
 * one after another (rotateX, 280 ms, 90 ms apart) and the next set rotates in (420 ms, spring).
 * It advances every `interval` ms, pauses while hovered, focused, off-screen or in a hidden tab,
 * and has up/down buttons and a Pause/Play button (WCAG 2.2.2).
 * `effect`: "flip" is the scoreboard (rows rotate on the X axis, the hire section); "turn" turns each
 * row over sideways like a card (Y axis, sliding out to one side and in from the other, 120 ms apart:
 * the gym list), so the two sections never move the same way.
 */
const EFFECTS = {
  flip: { gap: 90, out: 280, in: 420, perspective: "[perspective:900px]", frames: (deg: number) => `rotateX(${deg}deg)` },
  turn: { gap: 120, out: 320, in: 520, perspective: "[perspective:1200px]", frames: (deg: number) => `translateX(${deg / 6}%) rotateY(${deg}deg)` },
} as const;

export function FlipTicker<T>({
  items,
  perPage = 3,
  interval = 4200,
  delay = 0,
  render,
  keyOf,
  title,
  labels,
  className,
  effect = "flip",
}: {
  items: T[];
  perPage?: number;
  interval?: number;
  /** Start later than a neighbour so two tickers don't flip together. */
  delay?: number;
  render: (item: T) => ReactNode;
  keyOf: (item: T) => string;
  title: ReactNode;
  labels: FlipTickerLabels;
  className?: string;
  effect?: keyof typeof EFFECTS;
}) {
  const fx = EFFECTS[effect];
  const motionOk = useMotionOk();
  const n = items.length;
  const step = n > perPage ? perPage : 1;
  const moves = n > 1;
  const [offset, setOffset] = useState(0);
  const [paused, setPaused] = useState(false);
  const hold = useRef({ hover: false, focus: false, hidden: false, offscreen: false });
  const busy = useRef(false);
  const list = useRef<HTMLUListElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const shown = Array.from({ length: Math.min(perPage, n) }, (_, i) => items[(offset + i) % n]);

  const turn = (dir: 1 | -1) => {
    if (!moves || busy.current) return;
    const next = (o: number) => (((o + dir * step) % n) + n) % n;
    const rows = list.current ? Array.from(list.current.children) : [];
    if (!motionOk || !rows.length || !rows.every(canAnimate)) {
      setOffset(next);
      return;
    }
    busy.current = true;
    const out = dir > 0 ? -90 : 90;
    const OUT = fx.out, GAP = fx.gap;
    rows.forEach((r, i) => (r as HTMLElement).animate([{ transform: fx.frames(0), opacity: 1 }, { transform: fx.frames(out), opacity: 0.2 }], { duration: OUT, delay: i * GAP, easing: "cubic-bezier(.55,0,1,.45)", fill: "forwards" }));
    window.setTimeout(() => {
      setOffset(next);
      requestAnimationFrame(() => {
        const fresh = list.current ? Array.from(list.current.children) : [];
        fresh.forEach((r, i) => {
          if (!canAnimate(r)) return;
          r.getAnimations().forEach((a) => a.cancel());
          r.animate([{ transform: fx.frames(-out), opacity: 0.2 }, { transform: fx.frames(0), opacity: 1 }], { duration: fx.in, delay: i * GAP, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" });
        });
        window.setTimeout(() => (busy.current = false), fx.in + fresh.length * GAP);
      });
    }, OUT + (rows.length - 1) * GAP);
  };
  const turnRef = useRef(turn);
  useEffect(() => {
    turnRef.current = turn;
  });

  // Auto-advance, unless paused, held, reduced motion or only one page.
  useEffect(() => {
    if (!motionOk || paused || !moves) return;
    let id = 0;
    const start = window.setTimeout(() => {
      id = window.setInterval(() => {
        const h = hold.current;
        if (!h.hover && !h.focus && !h.hidden && !h.offscreen) turnRef.current(1);
      }, interval);
    }, delay);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(id);
    };
  }, [motionOk, paused, moves, interval, delay]);

  // Hidden tab and off-screen hold it.
  useEffect(() => {
    const onVis = () => (hold.current.hidden = document.hidden);
    document.addEventListener("visibilitychange", onVis);
    let io: IntersectionObserver | null = null;
    if (rootRef.current && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(([e]) => (hold.current.offscreen = !e.isIntersecting));
      io.observe(rootRef.current);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      io?.disconnect();
    };
  }, []);

  const btn = "inline-flex size-10 items-center justify-center rounded-control border border-line bg-surface text-ink transition-colors hover:bg-surface-2 disabled:opacity-40";
  return (
    <div
      ref={rootRef}
      className={cn("flex flex-col", className)}
      onMouseEnter={() => (hold.current.hover = true)}
      onMouseLeave={() => (hold.current.hover = false)}
      onFocus={() => (hold.current.focus = true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hold.current.focus = false;
      }}
      data-testid="flip-ticker"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
        <div className="min-w-0">{title}</div>
        {moves ? (
          <div className="flex shrink-0 gap-1.5">
            {motionOk ? (
              <button type="button" className={btn} onClick={() => setPaused((p) => !p)} aria-pressed={paused} aria-label={paused ? labels.play : labels.pause} data-testid="ticker-pause">
                {paused ? <Play size={16} weight="fill" aria-hidden /> : <Pause size={16} weight="fill" aria-hidden />}
              </button>
            ) : null}
            <button type="button" className={btn} onClick={() => turn(-1)} aria-label={labels.prev} data-testid="ticker-prev">
              <CaretUp size={18} aria-hidden />
            </button>
            <button type="button" className={btn} onClick={() => turn(1)} aria-label={labels.next} data-testid="ticker-next">
              <CaretDown size={18} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
      {/* The rows are the content: announced politely when they change by a button. */}
      <ul ref={list} className={cn("flex flex-col", fx.perspective)} aria-live={paused ? "polite" : "off"}>
        {shown.map((it, i) => (
          <li key={`${keyOf(it)}-${i}`} className="border-b border-line [backface-visibility:hidden] [transform-origin:50%_50%] last:border-b-0">
            {render(it)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Wraps a value that changes live (slots taken, a score, a prize pool): a green glint when it does. */
export function Flash({ value, children, className }: { value: unknown; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  const motionOk = useMotionOk();
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    if (!el || !motionOk) return;
    el.classList.remove("kg-flash");
    void el.offsetWidth; // restart the animation
    el.classList.add("kg-flash");
  }, [value, motionOk]);
  return (
    <span ref={ref} className={cn("inline-block", className)} data-flash>
      {children}
    </span>
  );
}

/** A number that counts up from 0 the first time it scrolls into view (900 ms, ease-out). */
export function CountUp({ value, format = (n) => String(Math.round(n)), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionOk = useMotionOk();
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !motionOk || typeof IntersectionObserver === "undefined") return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / 900);
        setShown(value * (1 - Math.pow(1 - k, 3)));
        if (k < 1) raf = requestAnimationFrame(step);
        else setShown(null);
      };
      raf = requestAnimationFrame(step);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, motionOk]);
  // Server and first paint show the real number; the count only runs once it is on screen.
  return (
    <span ref={ref} className={cn("tabular", className)}>
      {format(shown ?? value)}
    </span>
  );
}

/**
 * A row of cards that scrolls sideways (the sport cards, the venues open tonight): `move(±1)` goes
 * one card on, wrapping to the start at the end, and every `interval` ms it moves on by itself while
 * it is on screen and nobody is hovering, touching or focusing it. Reduced motion: arrows only.
 * Spread `handlers` on the row element and give it `ref`.
 */
export function useCarouselRow<T extends HTMLElement>({ interval = 4200, gap = 20 }: { interval?: number; gap?: number } = {}) {
  const ref = useRef<T>(null);
  const motionOk = useMotionOk();
  const hold = useRef({ touch: false, hover: false, focus: false, offscreen: true });

  const move = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const stepPx = (card?.getBoundingClientRect().width ?? 300) + gap;
    const behavior: ScrollBehavior = motionOk ? "smooth" : "auto";
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
    const atStart = el.scrollLeft <= 8;
    if (dir > 0 && atEnd) el.scrollTo({ left: 0, behavior });
    else if (dir < 0 && atStart) el.scrollTo({ left: el.scrollWidth, behavior });
    else el.scrollBy({ left: dir * stepPx, behavior });
  };
  const moveRef = useRef(move);
  useEffect(() => {
    moveRef.current = move;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(([e]) => (hold.current.offscreen = !e.isIntersecting));
      io.observe(el);
    } else hold.current.offscreen = false;
    if (!motionOk) return () => io?.disconnect();
    const id = window.setInterval(() => {
      const h = hold.current;
      if (!h.touch && !h.hover && !h.focus && !h.offscreen && !document.hidden) moveRef.current(1);
    }, interval);
    return () => {
      window.clearInterval(id);
      io?.disconnect();
    };
  }, [motionOk, interval]);

  const handlers = {
    onMouseEnter: () => (hold.current.hover = true),
    onMouseLeave: () => (hold.current.hover = false),
    onTouchStart: () => (hold.current.touch = true),
    // A swipe holds it a little longer, so it doesn't move away under the finger.
    onTouchEnd: () => window.setTimeout(() => (hold.current.touch = false), 2500),
    onFocus: () => (hold.current.focus = true),
    onBlur: () => (hold.current.focus = false),
  };
  return { ref, move, handlers };
}
