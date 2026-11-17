"use client";

import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@kriraghor/ui/brand/logo-mark";
import { useTranslations } from "next-intl";
import { cn } from "@kriraghor/ui/cn";
import type { SectionKey } from "@/lib/home";

/** The six sections, clockwise from the top, each a link to its rail below. */
const KEYS: SectionKey[] = ["esports", "gym", "venues", "shop", "hire", "events"];

type Dot = { x: number; y: number; vx: number; vy: number; r: number; flash: number };
type Node = { x: number; y: number; bx: number; by: number; ph: number; r: number; flash: number; c: number; s: number };
type Pulse = { a: Dot | Node; b: Dot | Node; t: number; hop: number };
type Colours = { ink: string; muted: string; line: string; brand: string; hot: string; bg: string };

/**
 * "One network for every game you play" (product owner's design, 6 Nov 2026): a live network drawn on a
 * canvas. Players drift and link up when they come close; the hub sends a glowing pulse to a section
 * every moment, and from there it hops on to nearby players. The pointer links the players around it
 * and nudges them away. Hovering or focusing a section sends a burst to it.
 *
 * The sections themselves are real links (HTML on top of the canvas), so they are read in the page's
 * language, take focus and jump to their rail. Colours come from the theme tokens and follow the theme.
 * The canvas stops when it is off screen or the tab is hidden; with reduced motion it is drawn once,
 * still, without pulses.
 */
export function HomeNetwork() {
  const t = useTranslations("home.network");
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const hubEl = useRef<HTMLDivElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const burst = useRef<(i: number) => void>(() => {});
  const [hot, setHot] = useState<number | null>(null);
  const hotRef = useRef<number | null>(null);

  useEffect(() => {
    const root = box.current;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!root || !cv || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    let dots: Dot[] = [];
    let nodes: Node[] = [];
    let hub: Node = { x: 0, y: 0, bx: 0, by: 0, ph: 0, r: 0, flash: 0, c: 0, s: 0 };
    let pulses: Pulse[] = [];
    let pointer: { x: number; y: number } | null = null;
    let col: Colours = { ink: "#111a15", muted: "#56635b", line: "#87938b", brand: "#0b7a4b", hot: "#e8932a", bg: "#f3f5f3" };
    let raf = 0;
    let running = false;
    let visible = true;
    let last = 0;
    let tick = 0;
    const phone = () => W < 640;

    const colours = () => {
      const s = getComputedStyle(root);
      const v = (k: string, d: string) => s.getPropertyValue(k).trim() || d;
      const dark = document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      col = { ink: v("--kg-ink", col.ink), muted: v("--kg-muted", col.muted), line: v("--kg-line-strong", col.line), brand: v("--kg-brand", col.brand), hot: dark ? "#ffb84d" : "#e8932a", bg: v("--kg-bg", col.bg) };
    };

    const setup = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = root.clientWidth;
      H = root.clientHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      colours();
      const hubR = Math.max(34, Math.min(W, H) * 0.075);
      hub = { x: W / 2, y: H / 2, bx: W / 2, by: H / 2, ph: 0, r: hubR, flash: 0, c: 0, s: 0 };
      // A ring; on phones it is squeezed sideways so the labels keep their room inside the box.
      const rx = W * (phone() ? 0.3 : 0.34);
      const ry = H * (phone() ? 0.36 : 0.33);
      nodes = KEYS.map((_, i) => {
        const a = ((-90 + i * 60) * Math.PI) / 180;
        const bx = W / 2 + Math.cos(a) * rx;
        const by = H / 2 + Math.sin(a) * ry;
        return { x: bx, y: by, bx, by, ph: i * 1.3, r: phone() ? 8 : 10, flash: 0, c: Math.cos(a), s: Math.sin(a) };
      });
      const n = Math.round((W * H) / (phone() ? 7000 : 9000));
      dots = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, r: 1.6 + Math.random() * 1.4, flash: 0 }));
      pulses = [];
    };

    const reach = () => Math.max(70, Math.min(140, W / 7));
    const everyone = (): (Dot | Node)[] => [...dots, ...nodes, hub];
    const send = (a: Dot | Node, b: Dot | Node, hop = 0) => pulses.push({ a, b, t: 0, hop });
    burst.current = (i: number) => {
      if (still || !nodes[i]) return;
      for (let k = 0; k < 3; k++) setTimeout(() => send(hub, nodes[i]), k * 140);
    };
    const arrive = (p: Pulse) => {
      p.b.flash = 1;
      if (p.hop >= 3) return;
      const d = reach();
      const near = everyone().filter((o) => o !== p.b && o !== p.a && Math.hypot(o.x - p.b.x, o.y - p.b.y) < d);
      for (let k = 0; k < 2 && near.length; k++) send(p.b, near[Math.floor(Math.random() * near.length)], p.hop + 1);
    };

    /** Labels (the HTML links) follow their nodes, kept inside the box. */
    const place = () => {
      nodes.forEach((n, i) => {
        const el = links.current[i];
        if (!el) return;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        let x: number;
        let y: number;
        if (phone() || Math.abs(n.c) < 0.2) {
          // Centred on the node: on phones the upper three sit above it and the lower three below, so
          // no label reaches the hub; on wider screens the top one has room above and the bottom one below.
          x = n.x - w / 2;
          y = n.s < -0.1 ? n.y - n.r - h - 6 : n.y + n.r + 6;
        } else if (n.c > 0) {
          x = n.x + n.r + 12;
          y = n.y - h / 2;
        } else {
          x = n.x - n.r - 12 - w;
          y = n.y - h / 2;
        }
        x = Math.max(4, Math.min(W - w - 4, x));
        y = Math.max(4, Math.min(H - h - 4, y));
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        el.dataset.flash = n.flash > 0.3 ? "on" : "off";
      });
      if (hubEl.current) {
        hubEl.current.style.transform = `translate(${(hub.x - hubEl.current.offsetWidth / 2).toFixed(1)}px, ${(hub.y - hubEl.current.offsetHeight / 2).toFixed(1)}px)`;
        hubEl.current.dataset.flash = hub.flash > 0.3 ? "on" : "off";
      }
    };

    const draw = (now: number) => {
      const dt = Math.min(40, now - last || 16);
      last = now;
      const time = now / 1000;
      ctx.clearRect(0, 0, W, H);

      if (!still) {
        const drift = phone() ? 7 : 12;
        nodes.forEach((n) => {
          n.x = n.bx + Math.sin(time * 0.6 + n.ph) * drift;
          n.y = n.by + Math.cos(time * 0.5 + n.ph) * drift;
        });
        dots.forEach((s) => {
          s.x += s.vx;
          s.y += s.vy;
          if (s.x < 0 || s.x > W) s.vx *= -1;
          if (s.y < 0 || s.y > H) s.vy *= -1;
          if (pointer) {
            const dx = s.x - pointer.x;
            const dy = s.y - pointer.y;
            const d = Math.hypot(dx, dy);
            if (d < 110 && d > 1) {
              s.x += (dx / d) * 1.2;
              s.y += (dy / d) * 1.2;
            }
          }
        });
        tick += dt;
        if (tick > 650) {
          tick = 0;
          send(hub, nodes[Math.floor(Math.random() * nodes.length)]);
        }
      }

      // Links between anyone close enough.
      const all = everyone();
      const d = reach();
      ctx.lineWidth = 1;
      ctx.strokeStyle = col.line;
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i];
          const b = all[j];
          const dd = Math.hypot(a.x - b.x, a.y - b.y);
          if (dd < d) {
            ctx.globalAlpha = (1 - dd / d) * ("ph" in a || "ph" in b ? 0.75 : 0.45);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      // The hub's spokes: dashed, the hovered one solid in the brand colour.
      nodes.forEach((n, i) => {
        const on = i === hotRef.current;
        ctx.globalAlpha = on ? 1 : 0.6;
        ctx.strokeStyle = on ? col.brand : col.line;
        ctx.lineWidth = on ? 2 : 1;
        ctx.setLineDash(on ? [] : [3, 6]);
        ctx.beginPath();
        ctx.moveTo(hub.x, hub.y);
        ctx.lineTo(n.x, n.y);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      if (pointer) {
        const p = pointer;
        ctx.strokeStyle = col.brand;
        [...dots, ...nodes].forEach((s) => {
          const dd = Math.hypot(s.x - p.x, s.y - p.y);
          if (dd < 150) {
            ctx.globalAlpha = (1 - dd / 150) * 0.8;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(s.x, s.y);
            ctx.stroke();
          }
        });
      }
      ctx.globalAlpha = 1;

      // Pulses, with a short glowing tail.
      pulses = pulses.filter((p) => {
        p.t += dt / (p.a === hub ? 900 : 420);
        if (p.t >= 1) {
          arrive(p);
          return false;
        }
        const at = (k: number) => [p.a.x + (p.b.x - p.a.x) * k, p.a.y + (p.b.y - p.a.y) * k];
        const [tx, ty] = at(Math.max(0, p.t - 0.12));
        const [px, py] = at(p.t);
        const g = ctx.createLinearGradient(tx, ty, px, py);
        g.addColorStop(0, "transparent");
        g.addColorStop(1, col.hot);
        ctx.strokeStyle = g;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.fillStyle = col.hot;
        ctx.shadowColor = col.hot;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(px, py, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        return true;
      });
      ctx.lineWidth = 1;

      // Players.
      dots.forEach((s) => {
        s.flash *= 0.93;
        ctx.fillStyle = s.flash > 0.05 ? col.brand : col.muted;
        ctx.globalAlpha = 0.5 + s.flash * 0.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r + s.flash * 3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Sections and the hub: a ripple when a pulse lands, then the node.
      [...nodes, hub].forEach((n) => {
        n.flash *= 0.94;
        if (n.flash > 0.02) {
          ctx.strokeStyle = col.brand;
          ctx.globalAlpha = n.flash;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 4 + (1 - n.flash) * 22, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (n === hub) return; // the hub's face is the logo (HTML)
        ctx.lineWidth = 2;
        ctx.fillStyle = col.bg;
        ctx.strokeStyle = col.ink;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = n.flash > 0.2 ? col.brand : col.ink;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.lineWidth = 1;
      place();
    };

    const loop = (now: number) => {
      if (!running) return;
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    const resume = () => {
      const want = visible && document.visibilityState === "visible" && !still;
      if (want && !running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(loop);
      } else if (!want && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };
    const start = () => {
      setup();
      draw(performance.now());
      resume();
    };

    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => {
      pointer = null;
    };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    const resize = new ResizeObserver(() => start());
    resize.observe(root);
    const seen = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      resume();
    });
    seen.observe(root);
    document.addEventListener("visibilitychange", resume);
    // The theme toggle sets <html data-theme>; the system setting can change too.
    const themeWatch = new MutationObserver(() => {
      colours();
      if (!running) draw(performance.now());
    });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      colours();
      if (!running) draw(performance.now());
    };
    scheme.addEventListener("change", onScheme);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      resize.disconnect();
      seen.disconnect();
      themeWatch.disconnect();
      scheme.removeEventListener("change", onScheme);
      document.removeEventListener("visibilitychange", resume);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  // The canvas reads the hovered section on each frame without restarting.
  const enter = (i: number) => {
    hotRef.current = i;
    setHot(i);
    burst.current(i);
  };
  const leave = () => {
    hotRef.current = null;
    setHot(null);
  };

  return (
    <section className="mx-auto max-w-wide px-5 pt-24 text-center" aria-labelledby="network-title" data-testid="home-network">
      <h2 id="network-title" className="text-[clamp(26px,3vw,36px)] font-extrabold uppercase leading-tight">
        {t("title")}
      </h2>
      <p className="mx-auto mt-2 max-w-[60ch] text-muted">{t("sub")}</p>
      <div ref={box} className="relative mx-auto mt-6 h-[clamp(460px,70vw,640px)] max-w-[1100px] touch-pan-y select-none">
        <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden />
        <div ref={hubEl} className="group absolute left-0 top-0 grid justify-items-center gap-1" data-flash="off" aria-hidden>
          <span className="grid size-[clamp(64px,9vw,84px)] place-items-center rounded-full border border-brand bg-bg shadow-[0_0_0_6px_color-mix(in_oklab,var(--kg-brand)_12%,transparent)] transition-transform duration-300 group-data-[flash=on]:scale-105">
            <LogoMark size={44} />
          </span>
          <span className="font-display text-sm font-extrabold uppercase tracking-wide">{t("hub")}</span>
        </div>
        {KEYS.map((key, i) => (
          <a
            key={key}
            ref={(el) => {
              links.current[i] = el;
            }}
            href={`#${key}`}
            onMouseEnter={() => enter(i)}
            onMouseLeave={leave}
            onFocus={() => enter(i)}
            onBlur={leave}
            data-flash="off"
            className={cn(
              "group absolute left-0 top-0 grid max-w-[150px] gap-0.5 rounded-control px-2 py-1 text-left no-underline outline-offset-2 sm:max-w-[200px]",
              "transition-colors duration-200 hover:bg-surface/80 focus-visible:bg-surface/80"
            )}
            data-testid={`net-${key}`}
          >
            <b className={cn("font-display text-[13px] font-extrabold uppercase leading-tight transition-colors sm:text-[15px]", hot === i ? "text-brand" : "text-ink", "group-data-[flash=on]:text-brand")}>{t(`${key}.title`)}</b>
            <span className="text-xs leading-snug text-muted sm:text-[13px]">{t(`${key}.sub`)}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
