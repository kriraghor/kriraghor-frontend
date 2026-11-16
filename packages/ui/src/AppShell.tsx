"use client";

import { Suspense, useMemo, useState, type ReactNode } from "react";
import { CaretDown, List, SidebarSimple } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { usePathname } from "./i18n/navigation";
import { cn } from "./cn";
import { Sheet, Tooltip } from "./kit/Overlay";
import { HEADER, setCollapsed, ShellLink, useCollapsed, type ShellItem } from "./shell-parts";
import { JumpTo, type JumpItem } from "./JumpTo";

export type { ShellItem };
export type ShellGroup = {
  label?: string;
  items: ShellItem[];
  /** The label folds the group. It starts open when it holds the current page or `defaultOpen` is set. */
  collapsible?: boolean;
  defaultOpen?: boolean;
};

/**
 * The desk layout for the esports and gym account areas, gym /manage and the portal (kriraghor.com's
 * member area uses SectionShell): a grouped icon
 * sidebar that collapses to a 76px rail in one click (remembered per browser), and a slide-in sheet
 * on phones. `variant="dark"` is the portal's full-height dark panel (Claude Design "Panels"), with
 * `foot` for the signed-in person's card at the bottom. "Jump to" (Ctrl+K) searches every page in the
 * menu (UI v2); `jump={false}` leaves it out.
 */
export function AppShell({
  groups,
  title,
  top,
  foot,
  context,
  variant = "light",
  jump = true,
  children,
}: {
  groups: ShellGroup[];
  title: string;
  top?: (collapsed: boolean) => ReactNode;
  foot?: (collapsed: boolean) => ReactNode;
  /** Which one the page belongs to (a gym's name), shown beside the page name on phones. */
  context?: string | null;
  variant?: "light" | "dark";
  jump?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("kit");
  const collapsed = useCollapsed();
  const dark = variant === "dark";
  // Every page in the menu, with its group's name to tell two "Settings" apart.
  const jumpItems = useMemo<JumpItem[]>(() => groups.flatMap((g) => g.items.map((it) => ({ href: it.href, label: it.label, icon: it.icon, group: g.label }))), [groups]);

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
          {jump ? (
            <div className={cn("mb-5", collapsed && "flex justify-center")}>
              <JumpTo items={jumpItems} rail={collapsed} dark={dark} />
            </div>
          ) : null}
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
            <PhoneMenu groups={groups} title={title} top={top} context={context} />
          </Suspense>
          {jump ? (
            <div className="ml-auto">
              <JumpTo items={jumpItems} compact hotkey={false} />
            </div>
          ) : null}
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
  // What the person folded or opened by hand; everything else follows the current page.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  return (
    <nav aria-label={title} className={cn("flex flex-col", groups.some((g) => g.collapsible) && !rail ? "gap-1" : "gap-5")}>
      {groups.map((g, gi) => {
        const holdsActive = active !== null && g.items.some((it) => it.href === active.href);
        const open = holdsActive || (toggled[g.label ?? gi] ?? Boolean(g.defaultOpen));
        if (g.collapsible && g.label && !rail)
          return (
            <div key={gi} data-testid={`nav-group-${gi}`}>
              <button
                type="button"
                aria-expanded={open}
                disabled={holdsActive}
                onClick={() => setToggled((all) => ({ ...all, [g.label ?? gi]: !open }))}
                className={cn("flex min-h-11 w-full items-center justify-between gap-2 rounded-control px-3 text-left text-xs font-semibold uppercase tracking-wider", dark ? "text-band-muted hover:text-band-text" : "text-muted hover:text-ink", !holdsActive && (dark ? "hover:bg-band-text/10" : "hover:bg-surface-2"))}
              >
                {g.label}
                {holdsActive ? null : <CaretDown size={14} weight="bold" aria-hidden className={cn("shrink-0 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />}
              </button>
              <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden" inert={!open}>
                  {g.items.map((it) => (
                    <ShellLink key={it.href} item={it} active={active !== null && it.href === active.href} rail={rail} onNavigate={onNavigate} dark={dark} />
                  ))}
                </div>
              </div>
            </div>
          );
        return (
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
        );
      })}
    </nav>
  );
}

function PhoneMenu({ groups, title, top, context }: { groups: ShellGroup[]; title: string; top?: (collapsed: boolean) => ReactNode; context?: string | null }) {
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
        <button type="button" className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-control px-2 text-sm font-semibold hover:bg-surface-2" data-testid="shell-menu">
          <List size={22} aria-hidden className="shrink-0" />
          <span className="shrink-0">{active?.label ?? title}</span>
          {context ? <span className="min-w-0 truncate font-normal text-muted" data-testid="shell-context">{context}</span> : null}
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
