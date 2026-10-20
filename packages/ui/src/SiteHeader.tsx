"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { List, SignOut, Translate, UserCircle, X } from "@phosphor-icons/react";
import { Link, usePathname, useRouter } from "./i18n/navigation";
import { useAuth } from "./auth";
import { isExternal } from "@kriraghor/session/links";
import { NotificationBell } from "./notifications/NotificationBell";
import { ButtonLink } from "./kit/Button";
import { Menu } from "./kit/Overlay";
import { SegmentedControl } from "./kit/Tabs";
import { ThemeToggle, setTheme, useTheme, type ThemeChoice } from "./ThemeToggle";
import { cn } from "./cn";

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

const iconBtn = "inline-flex size-11 shrink-0 items-center justify-center rounded-control text-ink transition-colors hover:bg-surface-2";

export function SiteHeader({ titleKey, homeHref, signInHref, meHref, nav, bell, actions }: HeaderConfig) {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { status, signOut } = useAuth();
  const theme = useTheme();
  // The menu belongs to the page it was opened on, so it closes by itself after navigating.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const menuOpen = menuFor === pathname;
  const closeMenu = () => setMenuFor(null);
  const isCurrent = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  const switchLanguage = () => router.replace(pathname, { locale: locale === "en" ? "bn" : "en" });
  // On the sign-in and sign-up pages the header doesn't offer what the page already is.
  const onAuthPage = pathname.startsWith(signInHref) || pathname.startsWith("/signup");

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--glass-edge)] bg-[var(--glass-strong-bg)] backdrop-blur-xl backdrop-saturate-150" onKeyDown={(e) => (e.key === "Escape" && menuOpen ? closeMenu() : undefined)}>
      <div className="flex h-1" aria-hidden>
        <span className="w-[72%] bg-brand" />
        <span className="flex-1 bg-amber-500" />
      </div>
      {/* Desktop: logo left, the links centred, actions right (three columns). */}
      <div className="mx-auto grid h-16 max-w-wide grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-6">
        <a href="#main" className="sr-only focus:not-sr-only">
          {t("nav.skip")}
        </a>
        <Link href={homeHref} className="flex min-w-0 items-center gap-2.5 justify-self-start no-underline" aria-label={t("nav.homeLabel")}>
          <Image src="/logo.png" alt="" width={36} height={36} priority className="shrink-0" />
          <span className="truncate whitespace-nowrap font-display text-lg font-bold tracking-tight sm:text-xl">{t(`app.${titleKey}`)}</span>
        </Link>
        <nav aria-label={t("nav.main")} className="hidden items-center gap-1 justify-self-center md:flex">
          {nav.map((item) => {
            const on = isCurrent(item.href);
            return (
              <NavLink key={item.href} href={item.href} current={on} className={cn("relative rounded-control px-3 py-2 text-[15px] font-medium no-underline transition-colors", on ? "text-brand-text" : "text-ink/75 hover:bg-surface-2 hover:text-ink")}>
                {t(`nav.${item.key}`)}
                {on ? <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-pill bg-brand" aria-hidden /> : null}
              </NavLink>
            );
          })}
        </nav>
        <div className="flex items-center gap-1 justify-self-end sm:gap-1.5">
          <ThemeToggle className="hidden md:inline-flex" />
          {/* Phones: the icon only, so the site name keeps its room; the name stays for screen readers. */}
          <button type="button" className={cn(iconBtn, "gap-1.5 text-sm font-semibold sm:w-auto sm:px-2.5")} onClick={switchLanguage} lang={locale === "en" ? "bn" : "en"} aria-label={t("nav.language")} data-testid="language-switch">
            <Translate size={21} aria-hidden />
            <span className="hidden sm:inline">{t("nav.language")}</span>
          </button>
          {status === "signed_in" ? (
            <>
              {actions}
              {bell ? <NotificationBell centreHref={bell.centreHref} settingsHref={bell.settingsHref} /> : null}
              <span className="hidden md:inline-flex">
                <Menu
                  trigger={
                    <button type="button" className={cn(iconBtn, "w-auto gap-2 border border-line bg-surface pl-1.5 pr-3 text-sm font-semibold")} data-testid="account-menu">
                      <UserCircle size={26} weight="fill" aria-hidden className="text-brand" />
                      {t("nav.me")}
                    </button>
                  }
                  items={[
                    { label: t("nav.me"), icon: <UserCircle />, onSelect: () => router.push(meHref) },
                    "separator",
                    { label: t("nav.signOut"), icon: <SignOut />, onSelect: () => void signOut() },
                  ]}
                />
              </span>
            </>
          ) : status === "signed_out" && !onAuthPage ? (
            <ButtonLink href={signInHref} size="md" className="min-h-10 px-3.5 sm:px-4">
              {t("nav.signIn")}
            </ButtonLink>
          ) : null}
          <button type="button" className={cn(iconBtn, "md:hidden")} aria-expanded={menuOpen} aria-controls="site-menu" onClick={() => setMenuFor(menuOpen ? null : pathname)} data-testid="menu-button">
            {menuOpen ? <X size={22} aria-hidden /> : <List size={22} aria-hidden />}
            <span className="sr-only">{t(menuOpen ? "nav.closeMenu" : "nav.menu")}</span>
          </button>
        </div>
      </div>
      {menuOpen ? (
        <div id="site-menu" className="border-t border-[var(--glass-edge)] md:hidden" data-testid="site-menu">
          <nav aria-label={t("nav.main")} className="mx-auto flex max-w-wide flex-col gap-0.5 px-3 py-3">
            {nav.map((item) => (
              <NavLink key={item.href} href={item.href} current={isCurrent(item.href)} onClick={closeMenu} className={cn("flex min-h-12 items-center rounded-control px-3 text-[17px] font-semibold no-underline", isCurrent(item.href) ? "bg-brand-soft text-brand-text" : "hover:bg-surface-2")}>
                {t(`nav.${item.key}`)}
              </NavLink>
            ))}
            {status === "signed_in" ? (
              <>
                <hr className="my-2 border-line" />
                <Link href={meHref} onClick={closeMenu} className="flex min-h-12 items-center gap-3 rounded-control px-3 text-[17px] font-semibold no-underline hover:bg-surface-2">
                  <UserCircle size={22} aria-hidden />
                  {t("nav.me")}
                </Link>
                <button type="button" onClick={() => (closeMenu(), void signOut())} className="flex min-h-12 items-center gap-3 rounded-control px-3 text-left text-[17px] font-semibold hover:bg-surface-2">
                  <SignOut size={22} aria-hidden />
                  {t("nav.signOut")}
                </button>
              </>
            ) : null}
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-line px-3 pt-4">
              <span className="text-sm font-semibold text-muted">{t("kit.theme.label")}</span>
              <SegmentedControl<ThemeChoice>
                size="sm"
                label={t("kit.theme.label")}
                value={theme}
                onChange={setTheme}
                options={[
                  { value: "light", label: t("kit.theme.light") },
                  { value: "dark", label: t("kit.theme.dark") },
                  { value: "system", label: t("kit.theme.system") },
                ]}
              />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
