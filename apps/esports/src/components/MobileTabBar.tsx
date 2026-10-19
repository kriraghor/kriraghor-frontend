"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChartBar, GameController, House, Star, Trophy } from "@phosphor-icons/react";
import { Link, usePathname } from "@/i18n/navigation";

/** Phone tab bar (under 900px): a floating glass bar with the five places players go most. */
export function MobileTabBar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const on = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  const item = (href: string, label: string, icon: ReactNode) => (
    <Link key={href} href={href} aria-current={on(href) ? "page" : undefined} className={`my-1 flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 truncate rounded-2xl text-[11px] font-semibold transition-colors ${on(href) ? "bg-brand-soft text-brand-text" : "text-muted hover:text-ink"}`}>
      {icon}
      {label}
    </Link>
  );
  return (
    <nav aria-label={t("quick")} className="glass-strong fixed inset-x-3 bottom-[calc(8px+env(safe-area-inset-bottom))] z-40 flex h-14 rounded-[22px] px-1 md:hidden" data-testid="tab-bar">
      {item("/", t("home"), <House size={22} aria-hidden />)}
      {item("/events", t("esports"), <Trophy size={22} aria-hidden />)}
      {item("/showcases", t("events"), <Star size={22} aria-hidden />)}
      {item("/leaderboards", t("tabRanks"), <ChartBar size={22} aria-hidden />)}
      {item("/me/matches", t("tabMatches"), <GameController size={22} aria-hidden />)}
    </nav>
  );
}
