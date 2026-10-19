"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { House, SoccerBall, Storefront, Trophy, UserCircle } from "@phosphor-icons/react";
import { Link, usePathname } from "@/i18n/navigation";
import { esportsHref } from "@/lib/links";

/** Phone tab bar (home-v3, under 900px): five labelled items; the rest of the nav is in the header menu. */
export function MobileTabBar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const on = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  const cls = (active: boolean) => `my-1 flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-semibold transition-colors ${active ? "bg-brand-soft text-brand-text" : "text-muted hover:text-ink"}`;
  const item = (href: string, label: string, icon: ReactNode) => (
    <Link key={href} href={href} className={cls(on(href))} aria-current={on(href) ? "page" : undefined}>
      {icon}
      {label}
    </Link>
  );

  return (
    <nav aria-label={t("quick")} className="glass-strong fixed inset-x-3 bottom-[calc(8px+env(safe-area-inset-bottom))] z-40 flex h-14 rounded-[22px] px-1 md:hidden" data-testid="tab-bar">
      {item("/", t("home"), <House size={22} aria-hidden />)}
      <a href={esportsHref()} className={cls(false)}>
        <Trophy size={22} aria-hidden />
        {t("esports")}
      </a>
      {item("/venues", t("grounds"), <SoccerBall size={22} aria-hidden />)}
      {item("/shop", t("shop"), <Storefront size={22} aria-hidden />)}
      {item("/me", t("account"), <UserCircle size={22} aria-hidden />)}
    </nav>
  );
}
