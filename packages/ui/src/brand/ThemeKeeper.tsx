"use client";

import { useLayoutEffect } from "react";
import { THEME_COOKIE, THEME_KEY } from "./theme-keys";

/** The visitor's saved pick (the shared cookie, else this site's localStorage copy), or null. */
export function storedTheme(): "light" | "dark" | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark)(?:;|$)`));
  if (m) return m[1] as "light" | "dark";
  try {
    const l = window.localStorage.getItem(THEME_KEY);
    if (l === "light" || l === "dark") return l;
  } catch {
    /* private mode */
  }
  return null;
}

/** Puts the saved pick (or the site's fallback) back on <html> when it is missing or different. */
export function reapplyTheme(fallback?: "light" | "dark") {
  const want = storedTheme() ?? fallback;
  const html = document.documentElement;
  if (want && html.dataset.theme !== want) html.dataset.theme = want;
}

/**
 * Keeps <html data-theme> after a language switch (tester feedback, 28 Nov 2026). Switching language
 * refreshes the [locale] root layout, and React renders <html> again from the server's props, which do not
 * carry the theme (it is set by ThemeScript before the first paint). The attribute was dropped and the gym
 * and esports sites, dark first, turned dark. This puts it back in the same commit, and watches <html> in
 * case anything else drops it.
 */
export function ThemeKeeper({ fallback }: { fallback?: "light" | "dark" }) {
  useLayoutEffect(() => {
    reapplyTheme(fallback);
    const html = document.documentElement;
    const watch = new MutationObserver(() => {
      if (!html.dataset.theme) reapplyTheme(fallback);
    });
    watch.observe(html, { attributes: true, attributeFilter: ["data-theme"] });
    return () => watch.disconnect();
  }, [fallback]);
  return null;
}
