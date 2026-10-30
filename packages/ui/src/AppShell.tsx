"use client";

import { Suspense, useState, type ReactNode } from "react";
import { List, SidebarSimple } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { usePathname } from "./i18n/navigation";
import { cn } from "./cn";
import { Sheet, Tooltip } from "./kit/Overlay";
import { HEADER, setCollapsed, ShellLink, useCollapsed, type ShellItem } from "./shell-parts";

export type { ShellItem };
export type ShellGroup = { label?: string; items: ShellItem[] };

/**
 * The desk layout for the esports and gym account areas, gym /manage and the portal (kriraghor.com's
 * member area uses SectionShell): a grouped icon
 * sidebar that collapses to a 76px rail in one click (remembered per browser), and a slide-in sheet
 * on phones. `variant="dark"` is the portal's full-height dark panel (Claude Design "Panels"), with
 * `foot` for the signed-in person's card at the bottom.
 */
export function AppShell({
  groups,
  title,
  top,
  foot,
  variant = "light",
  children,
}: {
  groups: ShellGroup[];
  title: string;
  top?: (collapsed: boolean) => ReactNode;
  foot?: (collapsed: boolean) => ReactNode;
  variant?: "light" | "dark";
  children: ReactNode;
}) {
  const t = useTranslations("kit");
  const collapsed = useCollapsed();
  const dark = variant === "dark";

  return (
    <div
      className={cn(
        "grid w-full md:transition-[grid-template-columns] md:duration-[220ms] md:ease-[var(--ease-kg)]",
        dark ? "flex-1" : "mx-auto max-w-wide md:gap-8 md:px-5",
        collapsed ? "md:grid-cols-[76px_minmax(0,1fr)]" : dark ? "md:grid-cols-[264px_minmax(0,1fr)]" : "md:grid-cols-[256px_minmax(0,1fr)]",
      )}
      data-testid="app-shell"
      data-variant={variant}
      data-collapsed={collapsed || undefined}
    >
      <aside className={cn("hidden md:block", dark && "border-r border-band-line bg-band text-band-text")}>
        <div className={cn("sticky flex flex-col overflow-y-auto overflow-x-hidden py-6", dark && "px-3 py-5")} style={{ top: HEADER, [dark ? "height" : "maxHeight"]: `calc(100dvh - ${HEADER})` }}>
          {top ? <div className="mb-5">{top(collapsed)}</div> : null}
          {/* The path is request data (Cache Components): only the highlight waits for it. */}
          <Suspense fallback={<NavList groups={groups} title={title} rail={collapsed} active={null} dark={dark} />}>
            <ActiveNav groups={groups} title={title} rail={collapsed} dark={dark} />
          </Suspense>
          {foot ? <div className="mt-auto pt-6">{foot(collapsed)}</div> : null}
          <div className={cn("border-t pt-3", foot ? "mt-3" : "mt-6", dark ? "border-band-line" : "border-line")}>
            <Tooltip content={collapsed ? t("expand") : t("collapse")} side="right">
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                aria-expanded={!collapsed}
                aria-label={collapsed ? t("expand") : t("collapse")}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-sm font-semibold",
                  dark ? "text-band-muted hover:bg-band-text/10 hover:text-band-text" : "text-muted hover:bg-surface-2 hover:text-ink",
                  collapsed && "justify-center px-0",
                )}
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
        <div className="sticky z-30 flex min-h-[61px] items-center gap-2 border-b border-line bg-bg/90 px-3 py-2 backdrop-blur md:hidden" style={{ top: HEADER }}>
          <Suspense fallback={null}>
            <PhoneMenu groups={groups} title={title} top={top} />
          </Suspense>
        </div>
        {children}
      </div>
    </div>
  );
}

/** The item for this path: the most specific match wins (/me/notifications/settings over /me/notifications). */
function activeItem(groups: ShellGroup[], pathname: string) {
  const on = (it: ShellItem) => (it.match === "exact" ? pathname === it.href : pathname === it.href || pathname.startsWith(`${it.href}/`));
  return groups.flatMap((g) => g.items).filter(on).sort((a, b) => b.href.length - a.href.length)[0] ?? null;
}

function ActiveNav(props: { groups: ShellGroup[]; title: string; rail: boolean; dark?: boolean }) {
  const pathname = usePathname();
  return <NavList {...props} active={activeItem(props.groups, pathname)} />;
}

function NavList({ groups, title, rail, active, onNavigate, dark }: { groups: ShellGroup[]; title: string; rail: boolean; active: ShellItem | null; onNavigate?: () => void; dark?: boolean }) {
  return (
    <nav aria-label={title} className="flex flex-col gap-5">
      {groups.map((g, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {g.label ? (
            rail ? (
              gi > 0 ? <hr className={cn("mx-3 mb-2", dark ? "border-band-line" : "border-line")} /> : null
            ) : (
              <p className={cn("px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider", dark ? "text-band-muted" : "text-muted")}>{g.label}</p>
            )
          ) : null}
          {g.items.map((it) => (
            <ShellLink key={it.href} item={it} active={active !== null && it.href === active.href} rail={rail} onNavigate={onNavigate} dark={dark} />
          ))}
        </div>
      ))}
    </nav>
  );
}

function PhoneMenu({ groups, title, top }: { groups: ShellGroup[]; title: string; top?: (collapsed: boolean) => ReactNode }) {
  const pathname = usePathname();
  // The sheet belongs to the page it was opened on, so it closes by itself after navigating.
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const active = activeItem(groups, pathname);
  return (
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
        <NavList groups={groups} title={title} rail={false} active={active} onNavigate={() => setSheetFor(null)} />
      </div>
    </Sheet>
  );
}
