"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { Menu } from "./kit/Overlay";
import { THEME_KEY } from "./brand/ThemeScript";
import { cn } from "./cn";

export type ThemeChoice = "light" | "dark" | "system";

const listeners = new Set<() => void>();
const read = (): ThemeChoice => {
  try {
    const t = window.localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
};
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Saves the pick and applies it to <html data-theme> at once ("system" removes it). */
export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* private mode: this page only */
  }
  if (choice === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
  listeners.forEach((fn) => fn());
}

export function useTheme(): ThemeChoice {
  return useSyncExternalStore(subscribe, read, () => "system");
}

const ICON = { light: Sun, dark: Moon, system: Desktop } as const;

/** The header's theme button: Light, Dark or the system's, remembered per browser. */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("kit.theme");
  const choice = useTheme();
  const Current = ICON[choice];
  return (
    <Menu
      trigger={
        <button type="button" aria-label={t("label")} className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-control text-ink transition-colors hover:bg-surface-2", className)} data-testid="theme-toggle">
          <Current size={21} aria-hidden />
        </button>
      }
      items={(["light", "dark", "system"] as const).map((c) => {
        const Icon = ICON[c];
        return { label: <span className={cn(c === choice && "font-semibold text-brand-text")}>{t(c)}</span>, icon: <Icon weight={c === choice ? "fill" : "regular"} />, onSelect: () => setTheme(c) };
      })}
    />
  );
}
