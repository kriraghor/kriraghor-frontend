"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scroll reveal (home-v3): children marked .rv fade up as they enter the viewport, 50 ms apart.
 * Content is visible without JavaScript and under prefers-reduced-motion; the classes are added to the
 * DOM after hydration only, so server and client HTML match.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }),
      { rootMargin: "0px 0px -8% 0px" }
    );
    const watch = () =>
      el.querySelectorAll<HTMLElement>(".rv:not(.is-in)").forEach((n, i) => {
        n.style.transitionDelay = `${(i % 6) * 50}ms`;
        io.observe(n);
      });
    el.classList.add("js-reveal");
    watch();
    // Live sections render their cards after their data arrives.
    const mo = new MutationObserver(watch);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
