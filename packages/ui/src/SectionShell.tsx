"use client";

import { Suspense, useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowUpRight, CaretDown, SidebarSimple } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { isExternal } from "@kriraghor/session/links";
import { Link, usePathname } from "./i18n/navigation";
import { cn } from "./cn";
import { Sheet, Tooltip } from "./kit/Overlay";
import { badgeText, HEADER, setCollapsed, ShellLink, useCollapsed, type ShellItem } from "./shell-parts";
import { activeSection, sectionBadge, type ActiveSection, type ShellSection } from "./sections";

export { activeSection, sectionBadge, type ActiveSection, type ShellItem, type ShellSection };

/**
 * A member area organised by section (kriraghor.com /me, /account, /pro): a short rail of sections
 * on the left (232px, or a 76px icon rail, remembered per browser) and the section's pages as pill
 * tabs at the top of the main column, with a sliding indicator. On phones the rail becomes a bar
 * that opens a sheet of section tiles, with the same tab row under it. `user` draws the person's
 * card beside the sections pinned at the bottom.
 */
export function SectionShell({ sections, title, user, children }: { sections: ShellSection[]; title: string; user?: (collapsed: boolean) => ReactNode; children: ReactNode }) {
  const t = useTranslations("kit");
  const collapsed = useCollapsed();

  return (
    <div
      className={cn(
        "mx-auto grid w-full max-w-wide md:gap-8 md:px-5 md:transition-[grid-template-columns] md:duration-[220ms] md:ease-[var(--ease-kg)] motion-reduce:transition-none",
        collapsed ? "md:grid-cols-[76px_minmax(0,1fr)]" : "md:grid-cols-[232px_minmax(0,1fr)]",
      )}
      data-testid="section-shell"
      data-collapsed={collapsed || undefined}
    >
      <aside className="hidden md:block">
        <div className="sticky flex flex-col overflow-y-auto overflow-x-hidden py-6" style={{ top: HEADER, height: `calc(100dvh - ${HEADER})` }}>
          {/* The path is request data (Cache Components): only the highlight waits for it. */}
          <Suspense fallback={<Rail sections={sections} title={title} rail={collapsed} active={null} user={user} />}>
            <ActiveRail sections={sections} title={title} rail={collapsed} user={user} />
          </Suspense>
          <div className="mt-3 border-t border-line pt-3">
            <Tooltip content={collapsed ? t("expand") : t("collapse")} side="right">
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                aria-expanded={!collapsed}
                aria-label={collapsed ? t("expand") : t("collapse")}
                className={cn("flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink", collapsed && "justify-center px-0")}
                data-testid="sidebar-toggle"
              >
                <SidebarSimple size={22} aria-hidden className={cn("shrink-0 transition-transform duration-200 motion-reduce:transition-none", collapsed && "rotate-180")} />
                <span className={cn(collapsed && "sr-only")}>{t("collapse")}</span>
              </button>
            </Tooltip>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <Suspense fallback={null}>
          <SectionHeader sections={sections} title={title} user={user} />
        </Suspense>
        {children}
      </div>
    </div>
  );
}

const asItem = (s: ShellSection): ShellItem => ({ href: s.href, label: s.label, icon: s.icon, badge: sectionBadge(s), testId: s.testId ?? `section-${s.key}` });

function ActiveRail(props: { sections: ShellSection[]; title: string; rail: boolean; user?: (collapsed: boolean) => ReactNode }) {
  const pathname = usePathname();
  return <Rail {...props} active={activeSection(props.sections, pathname)} />;
}

function Rail({ sections, title, rail, active, user }: { sections: ShellSection[]; title: string; rail: boolean; active: ActiveSection | null; user?: (collapsed: boolean) => ReactNode }) {
  const link = (s: ShellSection) => <ShellLink key={s.key} item={asItem(s)} active={active?.section.key === s.key} rail={rail} current="true" />;
  const pinned = sections.filter((s) => s.pin === "bottom");
  return (
    <nav aria-label={title} className="flex flex-1 flex-col">
      <div className="flex flex-col gap-0.5">{sections.filter((s) => s.pin !== "bottom").map(link)}</div>
      {user || pinned.length ? (
        <div className="mt-auto flex flex-col gap-2 pt-6">
          {user ? <div>{user(rail)}</div> : null}
          <div className="flex flex-col gap-0.5">{pinned.map(link)}</div>
        </div>
      ) : null}
    </nav>
  );
}

/** Desktop: the section's name and its tabs (sticky). Phones: the section switcher, then the same tabs. */
function SectionHeader({ sections, title, user }: { sections: ShellSection[]; title: string; user?: (collapsed: boolean) => ReactNode }) {
  const t = useTranslations("kit.sections");
  const pathname = usePathname();
  const active = activeSection(sections, pathname);
  const section = active?.section ?? null;
  const tabs = section?.items ?? [];
  const Icon = section?.icon;
  return (
    <>
      {section && tabs.length ? (
        <p className="hidden items-center gap-3 pt-6 font-display text-xl font-bold md:flex" data-testid="section-title">
          {Icon ? (
            <span className="inline-flex size-9 items-center justify-center rounded-control bg-brand-soft text-brand-text" aria-hidden>
              <Icon size={20} weight="fill" />
            </span>
          ) : null}
          {section.label}
        </p>
      ) : null}
      <div className={cn("sticky z-30 border-b border-line bg-bg/90 backdrop-blur", !tabs.length && "md:hidden")} style={{ top: HEADER }}>
        <div className="flex min-h-14 items-center px-3 md:hidden">
          <SectionSwitcher sections={sections} title={title} active={active} user={user} pathname={pathname} />
        </div>
        {section && tabs.length ? <TabRow key={section.key} items={tabs} active={active?.item ?? null} label={t("pages", { section: section.label })} /> : null}
      </div>
    </>
  );
}

/** Phones: the current section with a chevron; it opens a sheet of section tiles (closes itself after navigating). */
function SectionSwitcher({ sections, title, active, user, pathname }: { sections: ShellSection[]; title: string; active: ActiveSection | null; user?: (collapsed: boolean) => ReactNode; pathname: string }) {
  const t = useTranslations("kit.sections");
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const section = active?.section ?? null;
  const Icon = section?.icon;
  const pending = sections.reduce((n, s) => n + (s.key === section?.key ? 0 : sectionBadge(s)), 0);
  return (
    <Sheet
      open={sheetFor === pathname}
      onOpenChange={(o) => setSheetFor(o ? pathname : null)}
      title={title}
      side="bottom"
      testId="section-sheet"
      trigger={
        <button type="button" className="inline-flex min-h-11 min-w-0 items-center gap-2.5 rounded-control px-2 font-display text-lg font-bold hover:bg-surface-2" aria-label={t("switch", { section: section?.label ?? title })} data-testid="section-menu">
          {Icon ? (
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-text" aria-hidden>
              <Icon size={18} weight="fill" />
            </span>
          ) : null}
          <span className="truncate">{section?.label ?? title}</span>
          <CaretDown size={16} weight="bold" aria-hidden className="shrink-0 text-muted" />
          {pending > 0 ? <span className="size-2 shrink-0 rounded-pill bg-brand" aria-hidden /> : null}
        </button>
      }
    >
      <div className="px-4 pb-6">
        {user ? <div className="mb-4">{user(false)}</div> : null}
        <ul className="grid grid-cols-2 gap-2" aria-label={title}>
          {sections.map((s) => {
            const on = s.key === section?.key;
            const SIcon = s.icon;
            const badge = badgeText(sectionBadge(s));
            return (
              <li key={s.key}>
                <Link
                  href={s.href}
                  onClick={() => setSheetFor(null)}
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "relative flex min-h-[72px] flex-col justify-center gap-1.5 rounded-control border px-3 py-2.5 text-[15px] font-semibold no-underline transition-colors duration-150",
                    on ? "border-brand bg-brand-soft text-brand-text" : "border-line bg-surface text-ink hover:bg-surface-2",
                  )}
                  data-testid={`section-tile-${s.key}`}
                >
                  <SIcon size={22} weight={on ? "fill" : "regular"} aria-hidden />
                  <span className="truncate">{s.label}</span>
                  {badge ? <span className="tabular absolute right-2 top-2 rounded-pill bg-brand px-1.5 text-xs font-bold leading-5 text-on-brand">{badge}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}

type Pos = { x: number; y: number; w: number; h: number; animate: boolean };

/**
 * The section's pages as pill tabs. A brand-soft pill slides (transform) under the active tab in
 * about 200 ms and jumps with reduced motion; the row scrolls sideways with edge fades when it is
 * wider than the column. Tabs to another site carry an arrow and say so to screen readers.
 */
function TabRow({ items, active, label }: { items: ShellItem[]; active: ShellItem | null; label: string }) {
  const t = useTranslations("kit.sections");
  const scroller = useRef<HTMLUListElement>(null);
  const refs = useRef(new Map<string, HTMLElement>());
  const [pos, setPos] = useState<Pos | null>(null);
  const [fade, setFade] = useState({ left: false, right: false });
  const activeHref = active?.href ?? null;

  const measure = useCallback(() => {
    const box = scroller.current;
    if (!box) return;
    const left = box.scrollLeft > 1;
    const right = box.scrollLeft + box.clientWidth < box.scrollWidth - 1;
    setFade((f) => (f.left === left && f.right === right ? f : { left, right }));
    const el = activeHref ? refs.current.get(activeHref) : undefined;
    if (!el) return setPos(null);
    const next = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
    setPos((prev) => (prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h ? prev : { ...next, animate: prev !== null }));
  }, [activeHref]);

  // Measure before paint; keep the active tab in view when the row overflows.
  useLayoutEffect(() => {
    measure();
    const box = scroller.current;
    const el = activeHref ? refs.current.get(activeHref) : undefined;
    if (box && el && (el.offsetLeft < box.scrollLeft || el.offsetLeft + el.offsetWidth > box.scrollLeft + box.clientWidth)) {
      box.scrollLeft = Math.max(0, el.offsetLeft - 16);
    }
  }, [measure, activeHref]);

  useLayoutEffect(() => {
    const box = scroller.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(box);
    return () => ro.disconnect();
  }, [measure]);

  const mask = fade.left || fade.right ? `linear-gradient(to right, ${fade.left ? "transparent" : "#000"}, #000 28px, #000 calc(100% - 28px), ${fade.right ? "transparent" : "#000"})` : undefined;
  const style: CSSProperties | undefined = mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined;

  return (
    <nav aria-label={label} className="px-1 md:px-0">
      <ul
        ref={scroller}
        onScroll={measure}
        className="relative flex gap-1 overflow-x-auto overflow-y-hidden px-2 py-2 [scrollbar-width:none] md:px-0 [&::-webkit-scrollbar]:hidden"
        style={style}
        data-testid="section-tabs"
      >
        {pos ? (
          <li
            aria-hidden
            className={cn("pointer-events-none absolute left-0 top-0 rounded-pill bg-brand-soft", pos.animate && "transition-[transform,width] duration-200 ease-out motion-reduce:transition-none")}
            style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`, width: pos.w, height: pos.h }}
            data-testid="tab-indicator"
          />
        ) : null}
        {items.map((it) => {
          const external = isExternal(it.href);
          const on = !external && it.href === activeHref;
          const Icon = it.icon;
          const badge = badgeText(it.badge);
          const cls = cn(
            "relative inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-pill px-4 text-sm font-semibold no-underline transition-colors duration-150 focus-visible:-outline-offset-2",
            on ? "text-brand-text" : "text-muted hover:bg-surface-2 hover:text-ink",
            // Before the first measure (and without JS) the active tab carries its own pill.
            on && !pos && "bg-brand-soft",
          );
          const inner = (
            <>
              <Icon size={18} weight={on ? "fill" : "regular"} aria-hidden className="shrink-0" />
              <span>{it.label}</span>
              {external ? <ArrowUpRight size={14} weight="bold" aria-hidden className="shrink-0" /> : null}
              {badge ? <span className="tabular rounded-pill bg-brand px-1.5 text-xs font-bold leading-5 text-on-brand">{badge}</span> : null}
            </>
          );
          const ref = (el: HTMLElement | null) => {
            if (el) refs.current.set(it.href, el);
            else refs.current.delete(it.href);
          };
          return (
            <li key={it.href}>
              {external ? (
                <a ref={ref} href={it.href} className={cls} aria-label={t("external", { label: it.label })} data-testid={it.testId}>
                  {inner}
                </a>
              ) : (
                <Link ref={ref} href={it.href} className={cls} aria-current={on ? "page" : undefined} data-testid={it.testId}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
