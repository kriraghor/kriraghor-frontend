"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChartBar, GameController, House, Star, Trophy } from "@phosphor-icons/react";
import { Link, usePathname } from "@kriraghor/ui/i18n/navigation";

/** Phone tab bar (under 900px): a floating glass bar with the five places players go most. */
export function MobileTabBar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const on = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  const item = (href: string, label: string, icon: ReactNode) => (
    // flex-auto: each tab takes its label's width plus an equal share of the rest, so "Tournaments" fits beside
    // four short labels at 12 px; on the narrowest phones a label ends in "…" rather than running into the next.
    <Link key={href} href={href} aria-current={on(href) ? "page" : undefined} className={`my-1 flex min-w-0 flex-auto flex-col items-center justify-center gap-0.5 rounded-control px-1.5 text-xs font-semibold tracking-tight transition-colors ${on(href) ? "bg-brand-soft text-brand-text" : "text-muted hover:text-ink"}`}>
      {icon}
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
  return (
    <>
      {/* Behind the floating bar, so page text doesn't show around it. */}
      <div aria-hidden className="fixed inset-x-0 bottom-0 z-30 h-[calc(72px+env(safe-area-inset-bottom))] bg-[var(--glass-strong-bg)] backdrop-blur-xl md:hidden" />
      <nav aria-label={t("quick")} className="glass-strong fixed inset-x-3 bottom-[calc(8px+env(safe-area-inset-bottom))] z-40 flex h-14 rounded-card px-1 md:hidden" data-testid="tab-bar">
        {item("/", t("home"), <House size={22} aria-hidden />)}
        {item("/events", t("esports"), <Trophy size={22} aria-hidden />)}
        {item("/showcases", t("events"), <Star size={22} aria-hidden />)}
        {item("/leaderboards", t("tabRanks"), <ChartBar size={22} aria-hidden />)}
        {item("/me/matches", t("tabMatches"), <GameController size={22} aria-hidden />)}
      </nav>
    </>
  );
}
