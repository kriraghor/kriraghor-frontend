"use client";

import { useTranslations } from "next-intl";
import { Moon, Sun } from "@phosphor-icons/react";
import { THEME_KEY, themeCookie } from "./brand/ThemeScript";
import { cn } from "./cn";

export type Theme = "light" | "dark";

/** The theme showing now: the visitor's pick, else the device's. */
export function currentTheme(): Theme {
  const picked = document.documentElement.dataset.theme;
  if (picked === "light" || picked === "dark") return picked;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: Theme) {
  // The cookie carries the pick to every Kriraghor site (19 Nov 2026); localStorage stays as this site's copy.
  document.cookie = themeCookie(theme, location.hostname, location.protocol === "https:");
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode: the cookie still works */
  }
  document.documentElement.dataset.theme = theme;
}

type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };

/**
 * Switches light ↔ dark with a transition: where the browser has View Transitions, the new theme
 * spreads as a circle from the button; elsewhere the colours cross-fade. Reduced motion: instant.
 */
export function toggleTheme(origin?: { x: number; y: number }) {
  const next: Theme = currentTheme() === "dark" ? "light" : "dark";
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const doc = document as ViewTransitionDoc;
  if (reduce) return apply(next);
  if (doc.startViewTransition && origin) {
    const { x, y } = origin;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = doc.startViewTransition(() => apply(next));
    void vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 520, easing: "cubic-bezier(.16,1,.3,1)", pseudoElement: "::view-transition-new(root)" },
      );
    });
    return;
  }
  const html = document.documentElement;
  html.classList.add("kg-theme-anim");
  apply(next);
  window.setTimeout(() => html.classList.remove("kg-theme-anim"), 450);
}

/**
 * The header's theme button: one toggle, light ↔ dark. The icon (moon in light, sun in dark) is
 * chosen by CSS from <html data-theme>, so it is right on the first paint and the swap spins.
 */
export function ThemeToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const t = useTranslations("kit.theme");
  return (
    <button
      type="button"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        toggleTheme({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }}
      aria-label={t("toggle")}
      title={t("toggle")}
      className={cn(
        "kg-theme-toggle inline-flex h-11 shrink-0 items-center justify-center gap-2.5 rounded-control text-ink transition-[background-color,transform] duration-150 hover:bg-surface-2 active:scale-90",
        withLabel ? "px-3 text-sm font-semibold" : "w-11",
        className,
      )}
      data-testid="theme-toggle"
    >
      <span className="relative inline-flex size-[22px]" aria-hidden>
        <Moon className="kg-tt-moon absolute inset-0" size={22} weight="fill" />
        <Sun className="kg-tt-sun absolute inset-0" size={22} weight="fill" />
      </span>
      {withLabel ? <span>{t("label")}</span> : null}
    </button>
  );
}
