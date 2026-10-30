"use client";

import { useSyncExternalStore } from "react";
import type { Icon } from "@phosphor-icons/react";
import { isExternal } from "@kriraghor/session/links";
import { Link } from "./i18n/navigation";
import { cn } from "./cn";
import { Tooltip } from "./kit/Overlay";

/** One link in a desk sidebar or a section's tab row. */
export type ShellItem = {
  href: string;
  label: string;
  icon: Icon;
  /** A count (unread, pending); hidden at 0. */
  badge?: number;
  testId?: string;
  /** "exact" for overview pages whose children have their own items. */
  match?: "exact" | "prefix";
};

// The rail's open or collapsed state, remembered per browser and shared by every desk layout.
const KEY = "kg.sidebar";
const listeners = new Set<() => void>();
const readCollapsed = () => {
  try {
    return window.localStorage.getItem(KEY) === "collapsed";
  } catch {
    return false;
  }
};
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** True when the person collapsed the sidebar to its icon rail (false on the server). */
export const useCollapsed = () => useSyncExternalStore(subscribe, readCollapsed, () => false);

export function setCollapsed(next: boolean) {
  try {
    window.localStorage.setItem(KEY, next ? "collapsed" : "open");
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  listeners.forEach((fn) => fn());
}

/** The header is h-1 (brand strip) + h-16: sidebars and sticky bars sit below it. */
export const HEADER = "68px";

/** A count for a badge: hidden at 0, capped at 99+. */
export const badgeText = (n?: number) => (n && n > 0 ? (n > 99 ? "99+" : String(n)) : null);

/**
 * A sidebar link: icon and label, the brand bar and a filled icon when active, a tooltip on the
 * icon rail. `current` is "page" for a page link and "true" for a section that holds the page.
 */
export function ShellLink({
  item,
  active,
  rail,
  onNavigate,
  dark,
  current = "page",
}: {
  item: ShellItem;
  active: boolean;
  rail: boolean;
  onNavigate?: () => void;
  dark?: boolean;
  current?: "page" | "true";
}) {
  const Icon = item.icon;
  const badge = badgeText(item.badge);
  const cls = cn(
    "group relative flex min-h-11 items-center gap-3 rounded-control px-3 text-[15px] font-medium no-underline transition-colors duration-150",
    dark
      ? active
        ? "bg-band-text/12 font-semibold text-band-text"
        : "text-band-text/75 hover:bg-band-text/8 hover:text-band-text"
      : active
        ? "bg-brand-soft font-semibold text-brand-text"
        : "text-ink/80 hover:bg-surface-2 hover:text-ink",
    rail && "justify-center px-0",
  );
  const inner = (
    <>
      {active ? <span className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r-pill", dark ? "bg-prize" : "bg-brand")} aria-hidden /> : null}
      <Icon size={22} weight={active ? "fill" : "regular"} aria-hidden className="shrink-0" />
      <span className={cn("min-w-0 flex-1 truncate", rail && "sr-only")}>{item.label}</span>
      {badge ? (
        <span className={cn("tabular rounded-pill px-1.5 text-xs font-bold leading-5", dark ? "bg-prize text-prize-ink" : "bg-brand text-on-brand", rail && "absolute right-2 top-1.5 min-w-5 text-center text-[10px] leading-4")}>{badge}</span>
      ) : null}
    </>
  );
  const link = isExternal(item.href) ? (
    <a href={item.href} className={cls} data-testid={item.testId} onClick={onNavigate}>
      {inner}
    </a>
  ) : (
    <Link href={item.href} className={cls} aria-current={active ? current : undefined} data-testid={item.testId} onClick={onNavigate}>
      {inner}
    </Link>
  );
  return (
    <Tooltip content={item.label} side="right" disabled={!rail}>
      {link}
    </Tooltip>
  );
}
