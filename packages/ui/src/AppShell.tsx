"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import type { Icon } from "@phosphor-icons/react";
import { List, SidebarSimple } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { isExternal } from "@kriraghor/session/links";
import { Link, usePathname } from "./i18n/navigation";
import { cn } from "./cn";
import { Sheet, Tooltip } from "./kit/Overlay";

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
export type ShellGroup = { label?: string; items: ShellItem[] };

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
function setCollapsed(next: boolean) {
  try {
    window.localStorage.setItem(KEY, next ? "collapsed" : "open");
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  listeners.forEach((fn) => fn());
}

/** The header is h-1 (brand strip) + h-16: the sidebar sticks below it. */
const HEADER = "68px";

/**
 * The desk layout for /me, /pro, /account, the esports account and the portal: a grouped icon
 * sidebar that collapses to a 76px rail (remembered per browser), and a slide-in sheet on phones.
 */
export function AppShell({ groups, title, top, children }: { groups: ShellGroup[]; title: string; top?: (collapsed: boolean) => ReactNode; children: ReactNode }) {
  const t = useTranslations("kit");
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const [sheetFor, setSheetFor] = useState<string | null>(null);

  const isActive = (it: ShellItem) => (it.match === "exact" ? pathname === it.href : pathname === it.href || pathname.startsWith(`${it.href}/`));
  // The most specific item wins (/me/notifications/settings over /me/notifications).
  const all = groups.flatMap((g) => g.items);
  const active = all.filter(isActive).sort((a, b) => b.href.length - a.href.length)[0];

  const nav = (rail: boolean, onNavigate?: () => void) => (
    <nav aria-label={title} className="flex flex-col gap-5">
      {groups.map((g, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {g.label ? (
            rail ? (
              gi > 0 ? <hr className="mx-3 mb-2 border-line" /> : null
            ) : (
              <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">{g.label}</p>
            )
          ) : null}
          {g.items.map((it) => (
            <ShellLink key={it.href} item={it} active={it === active} rail={rail} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <div
      className={cn(
        "mx-auto grid w-full max-w-wide md:gap-8 md:px-5 md:transition-[grid-template-columns] md:duration-[220ms] md:ease-[var(--ease-kg)]",
        collapsed ? "md:grid-cols-[76px_minmax(0,1fr)]" : "md:grid-cols-[256px_minmax(0,1fr)]",
      )}
      data-testid="app-shell"
      data-collapsed={collapsed || undefined}
    >
      <aside className="hidden md:block">
        <div className="sticky flex flex-col overflow-y-auto overflow-x-hidden py-6" style={{ top: HEADER, maxHeight: `calc(100dvh - ${HEADER})` }}>
          {top ? <div className="mb-5">{top(collapsed)}</div> : null}
          {nav(collapsed)}
          <div className="mt-6 border-t border-line pt-3">
            <Tooltip content={collapsed ? t("expand") : t("collapse")} side="right">
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                aria-expanded={!collapsed}
                aria-label={collapsed ? t("expand") : t("collapse")}
                className={cn("flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink", collapsed && "justify-center px-0")}
                data-testid="sidebar-toggle"
              >
                <SidebarSimple size={22} aria-hidden className={cn("shrink-0 transition-transform duration-200", collapsed && "rotate-180")} />
                <span className={cn(collapsed && "sr-only")}>{t("collapse")}</span>
              </button>
            </Tooltip>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Phones: the page name and a button that opens the same menu as a sheet. */}
        <div className="sticky z-30 flex items-center gap-2 border-b border-line bg-bg/90 px-3 py-2 backdrop-blur md:hidden" style={{ top: HEADER }}>
          <Sheet
            open={sheetFor === pathname}
            onOpenChange={(o) => setSheetFor(o ? pathname : null)}
            title={title}
            side="left"
            trigger={
              <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-control px-2 text-sm font-semibold hover:bg-surface-2" data-testid="shell-menu">
                <List size={22} aria-hidden />
                <span>{active?.label ?? title}</span>
              </button>
            }
          >
            <div className="px-3 pb-8">
              {top ? <div className="mb-4 px-2">{top(false)}</div> : null}
              {nav(false, () => setSheetFor(null))}
            </div>
          </Sheet>
        </div>
        {children}
      </div>
    </div>
  );
}

function ShellLink({ item, active, rail, onNavigate }: { item: ShellItem; active: boolean; rail: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  const badge = item.badge && item.badge > 0 ? (item.badge > 99 ? "99+" : String(item.badge)) : null;
  const cls = cn(
    "group relative flex min-h-11 items-center gap-3 rounded-control px-3 text-[15px] font-medium no-underline transition-colors duration-150",
    active ? "bg-brand-soft font-semibold text-brand-text" : "text-ink/80 hover:bg-surface-2 hover:text-ink",
    rail && "justify-center px-0",
  );
  const inner = (
    <>
      {active ? <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-pill bg-brand" aria-hidden /> : null}
      <Icon size={22} weight={active ? "fill" : "regular"} aria-hidden className="shrink-0" />
      <span className={cn("min-w-0 flex-1 truncate", rail && "sr-only")}>{item.label}</span>
      {badge ? (
        <span className={cn("tabular rounded-pill bg-brand px-1.5 text-xs font-bold leading-5 text-on-brand", rail && "absolute right-2 top-1.5 min-w-5 text-center text-[10px] leading-4")}>{badge}</span>
      ) : null}
    </>
  );
  const link = isExternal(item.href) ? (
    <a href={item.href} className={cls} data-testid={item.testId} onClick={onNavigate}>
      {inner}
    </a>
  ) : (
    <Link href={item.href} className={cls} aria-current={active ? "page" : undefined} data-testid={item.testId} onClick={onNavigate}>
      {inner}
    </Link>
  );
  return (
    <Tooltip content={item.label} side="right" disabled={!rail}>
      {link}
    </Tooltip>
  );
}
