"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { cn } from "@kriraghor/ui/cn";
import type { SectionKey } from "@/lib/home";

/** Where each node sits: three rows on phones, a ring on desktop. */
const NODES: { key: SectionKey; at: string }[] = [
  { key: "esports", at: "left-[27%] top-[9%] md:left-[16%] md:top-[20%]" },
  { key: "gym", at: "left-[73%] top-[9%] md:left-1/2 md:top-[8%]" },
  { key: "venues", at: "left-[80%] top-1/2 md:left-[84%] md:top-[20%]" },
  { key: "shop", at: "left-[73%] top-[91%] md:left-[84%] md:top-[80%]" },
  { key: "hire", at: "left-[27%] top-[91%] md:left-1/2 md:top-[92%]" },
  { key: "events", at: "left-[20%] top-1/2 md:left-[16%] md:top-[80%]" },
];

const DOT_SECONDS = 3.5;

const motionQuery = "(prefers-reduced-motion: reduce)";
const onMotionChange = (cb: () => void) => {
  const m = window.matchMedia(motionQuery);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const useReducedMotion = () => useSyncExternalStore(onMotionChange, () => window.matchMedia(motionQuery).matches, () => true);

/**
 * "One network": the hub joined to the six sections by curved lines, with a dot travelling along each
 * to show they are one platform. Each node jumps to its section below. The lines are measured from the
 * laid-out nodes and redrawn on resize; with reduced motion they stay and the dots are not drawn.
 */
export function HomeNetwork() {
  const t = useTranslations("home.network");
  const box = useRef<HTMLDivElement>(null);
  const hub = useRef<HTMLDivElement>(null);
  const nodes = useRef<(HTMLAnchorElement | null)[]>([]);
  const [lines, setLines] = useState<string[]>([]);
  const [hot, setHot] = useState<number | null>(null);
  const still = useReducedMotion();

  useEffect(() => {
    const root = box.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const draw = () => {
      // Leaving the page clears the refs just before the observer is disconnected.
      if (!hub.current || nodes.current.some((n) => !n)) return;
      const b = root.getBoundingClientRect();
      const centre = (el: Element) => {
        const r = el.getBoundingClientRect();
        return [r.left - b.left + r.width / 2, r.top - b.top + r.height / 2];
      };
      const [hx, hy] = centre(hub.current as Element);
      setLines(
        nodes.current.map((n) => {
          const [x, y] = centre(n as Element);
          const dx = x - hx;
          const dy = y - hy;
          return `M${hx} ${hy} Q${(hx + x) / 2 - dy * 0.12} ${(hy + y) / 2 + dx * 0.12} ${x} ${y}`;
        })
      );
    };
    const watch = new ResizeObserver(draw);
    watch.observe(root);
    return () => watch.disconnect();
  }, []);

  return (
    <section className="mx-auto max-w-wide px-5 pt-24 text-center" aria-labelledby="network-title" data-testid="home-network">
      <h2 id="network-title" className="text-[clamp(26px,3vw,36px)] font-extrabold uppercase leading-tight">
        {t("title")}
      </h2>
      <p className="mx-auto mt-2 max-w-[60ch] text-muted">{t("sub")}</p>
      <div ref={box} className="relative mx-auto mt-8 aspect-[4/5] max-w-[950px] sm:aspect-[5/4] md:aspect-[2/1]">
        <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          {lines.map((d, i) => (
            <g key={NODES[i].key}>
              <path id={`net-line-${i}`} d={d} fill="none" strokeWidth={hot === i ? 2 : 1.5} className={cn("transition-[stroke] duration-200", hot === i ? "stroke-brand" : "stroke-line-strong/50")} />
              {still ? null : (
                <circle r="3.5" className="fill-brand">
                  <animateMotion dur={`${DOT_SECONDS}s`} repeatCount="indefinite" begin={`-${(i * DOT_SECONDS) / NODES.length}s`} {...(i % 2 ? { keyPoints: "1;0", keyTimes: "0;1", calcMode: "linear" } : {})}>
                    <mpath href={`#net-line-${i}`} />
                  </animateMotion>
                  <animate attributeName="opacity" values="0;1;0" dur={`${DOT_SECONDS}s`} repeatCount="indefinite" begin={`-${(i * DOT_SECONDS) / NODES.length}s`} />
                </circle>
              )}
            </g>
          ))}
        </svg>
        <div ref={hub} className="glass-strong absolute left-1/2 top-1/2 z-10 grid size-24 -translate-x-1/2 -translate-y-1/2 place-content-center justify-items-center gap-1 rounded-[24px] sm:size-28">
          <Image src="/logo.png" alt="" width={40} height={40} />
          <span className="font-display text-sm font-bold">{t("hub")}</span>
        </div>
        {NODES.map((n, i) => (
          <a
            key={n.key}
            ref={(el) => {
              nodes.current[i] = el;
            }}
            href={`#${n.key}`}
            onMouseEnter={() => setHot(i)}
            onMouseLeave={() => setHot(null)}
            onFocus={() => setHot(i)}
            onBlur={() => setHot(null)}
            className={cn("glass-card absolute z-10 grid w-[128px] -translate-x-1/2 -translate-y-1/2 gap-0.5 rounded-[16px] px-3 py-2 text-left no-underline transition-colors hover:border-brand sm:w-[160px] md:w-[176px]", n.at)}
            data-testid={`net-${n.key}`}
          >
            <b className="font-display text-base uppercase leading-tight">{t(`${n.key}.title`)}</b>
            <span className="text-xs leading-snug text-muted sm:text-sm">{t(`${n.key}.sub`)}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
