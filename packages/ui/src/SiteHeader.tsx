"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { List, X } from "@phosphor-icons/react";
import { Link, usePathname, useRouter } from "./i18n/navigation";
import { useAuth } from "./auth";
import { isExternal } from "@kriraghor/session/links";
import { NotificationBell } from "./notifications/NotificationBell";

export type HeaderConfig = {
  titleKey: "web" | "esports" | "admin" | "vendor";
  homeHref: string;
  signInHref: string;
  meHref: string;
  nav: { href: string; key: string }[];
  /** M08 bell: where "See all" and "Settings" go. */
  bell?: { centreHref: string; settingsHref?: string };
  /** Extra signed-in actions before the bell (kriraghor.com: the cart, M13). */
  actions?: ReactNode;
};

/** A nav link: in-app routes through next-intl, the /go/ redirects and other sites as plain links. */
function NavLink({ href, className, current, children, onClick }: { href: string; className: string; current?: boolean; children: ReactNode; onClick?: () => void }) {
  if (isExternal(href)) {
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} aria-current={current ? "page" : undefined} onClick={onClick}>
      {children}
    </Link>
  );
}

export function SiteHeader({ titleKey, homeHref, signInHref, meHref, nav, bell, actions }: HeaderConfig) {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { status, signOut } = useAuth();
  // The menu belongs to the page it was opened on, so it closes by itself after navigating.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const menuOpen = menuFor === pathname;
  const closeMenu = () => setMenuFor(null);
  const isCurrent = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  const switchLanguage = () => router.replace(pathname, { locale: locale === "en" ? "bn" : "en" });

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--glass-edge)] bg-[var(--glass-strong-bg)] backdrop-blur-xl backdrop-saturate-150" onKeyDown={(e) => (e.key === "Escape" && menuOpen ? closeMenu() : undefined)}>
      <div className="flex h-1" aria-hidden>
        <span className="w-[72%] bg-brand" />
        <span className="flex-1 bg-amber-500" />
      </div>
      <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-6 px-5">
        <a href="#main" className="sr-only focus:not-sr-only">
          {t("nav.skip")}
        </a>
        <Link href={homeHref} className="flex min-w-0 items-center gap-2 no-underline" aria-label={t("nav.homeLabel")}>
          <Image src="/logo.png" alt="" width={38} height={38} priority className="shrink-0" />
          <span className="truncate whitespace-nowrap font-bangla text-lg font-bold sm:text-xl">{t(`app.${titleKey}`)}</span>
        </Link>
        <nav aria-label={t("nav.main")} className="hidden gap-5 text-sm font-semibold md:flex">
          {nav.map((item) => (
            <NavLink key={item.href} href={item.href} current={isCurrent(item.href)} className={`py-1 hover:underline ${isCurrent(item.href) ? "underline decoration-brand decoration-2 underline-offset-8" : ""}`}>
              {t(`nav.${item.key}`)}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="hidden min-h-11 border border-line px-3 text-sm md:inline-flex md:items-center" onClick={switchLanguage} lang={locale === "en" ? "bn" : "en"}>
            {t("nav.language")}
          </button>
          {status === "signed_in" ? (
            <>
              {actions}
              {bell ? <NotificationBell centreHref={bell.centreHref} settingsHref={bell.settingsHref} /> : null}
              <Link href={meHref} className="hidden min-h-11 items-center border-2 border-line-strong px-4 text-sm font-bold md:inline-flex">
                {t("nav.me")}
              </Link>
              <button type="button" onClick={() => void signOut()} className="hidden min-h-11 bg-brand px-4 text-sm font-bold text-white hover:bg-brand-hover md:inline-flex md:items-center">
                {t("nav.signOut")}
              </button>
            </>
          ) : status === "signed_out" ? (
            <Link href={signInHref} className="inline-flex min-h-11 items-center whitespace-nowrap bg-brand px-4 text-sm font-bold text-white hover:bg-brand-hover">
              {t("nav.signIn")}
            </Link>
          ) : null}
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center border border-line md:hidden"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuFor(menuOpen ? null : pathname)}
            data-testid="menu-button"
          >
            {menuOpen ? <X size={22} aria-hidden /> : <List size={22} aria-hidden />}
            <span className="sr-only">{t(menuOpen ? "nav.closeMenu" : "nav.menu")}</span>
          </button>
        </div>
      </div>
      {menuOpen ? (
        <div id="site-menu" className="border-t border-[var(--glass-edge)] md:hidden" data-testid="site-menu">
          <nav aria-label={t("nav.main")} className="mx-auto flex max-w-[1320px] flex-col px-5 py-3">
            {nav.map((item) => (
              <NavLink key={item.href} href={item.href} current={isCurrent(item.href)} onClick={closeMenu} className="flex min-h-12 items-center border-b border-[var(--glass-edge)] text-lg font-semibold">
                {t(`nav.${item.key}`)}
              </NavLink>
            ))}
            {status === "signed_in" ? (
              <>
                <Link href={meHref} onClick={closeMenu} className="flex min-h-12 items-center border-b border-[var(--glass-edge)] text-lg font-semibold">
                  {t("nav.me")}
                </Link>
                <button type="button" onClick={() => (closeMenu(), void signOut())} className="flex min-h-12 items-center border-b border-[var(--glass-edge)] text-left text-lg font-semibold">
                  {t("nav.signOut")}
                </button>
              </>
            ) : null}
            <button type="button" className="mt-3 inline-flex min-h-11 w-fit items-center border border-line px-3 text-sm" onClick={switchLanguage} lang={locale === "en" ? "bn" : "en"}>
              {t("nav.language")}
            </button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
