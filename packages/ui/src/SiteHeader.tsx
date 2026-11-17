"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@kriraghor/api-client";
import { useLocale, useTranslations } from "next-intl";
import { List, SignOut, Translate, UserCircle } from "@phosphor-icons/react";
import { Link, usePathname, useRouter } from "./i18n/navigation";
import { useSwitchLocale } from "./i18n/switch-locale";
import { useAuth } from "./auth";
import { isExternal } from "@kriraghor/session/links";
import { NotificationBell } from "./notifications/NotificationBell";
import { ButtonLink } from "./kit/Button";
import { Menu, Sheet } from "./kit/Overlay";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar } from "./kit/Display";
import { cn } from "./cn";
import { LogoMark } from "./brand/LogoMark";

export type HeaderConfig = {
  titleKey: "web" | "esports" | "admin" | "vendor" | "gym";
  homeHref: string;
  signInHref: string;
  meHref: string;
  nav: { href: string; key: string }[];
  /** M08 bell: where "See all" and "Settings" go. */
  bell?: { centreHref: string; settingsHref?: string };
  /** A site-wide search before the actions (kriraghor.com only). */
  search?: ReactNode;
  /** Keep the phone menu up to the `lg` breakpoint, for sites whose links and actions need the room. */
  roomy?: boolean;
  /** Extra signed-in actions before the bell (kriraghor.com: the cart, M13). */
  actions?: ReactNode;
  /** Full width, for desks whose sidebar runs from the left edge (the portal). */
  full?: boolean;
};

/** A nav link: in-app routes through next-intl, the /go/ redirects and other sites as plain links. */
function NavLink({ href, className, current, children, onClick, style }: { href: string; className: string; current?: boolean; children: ReactNode; onClick?: () => void; style?: CSSProperties }) {
  if (isExternal(href)) {
    return (
      <a href={href} className={className} onClick={onClick} style={style}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} aria-current={current ? "page" : undefined} onClick={onClick} style={style}>
      {children}
    </Link>
  );
}

/** The signed-in person in the account menu: their photo when they have one (M01 avatar), else the person icon. */
function AccountGlyph({ size }: { size: number }) {
  const { audience, status } = useAuth();
  // The member's GET /me (the shared "me" cache entry); staff desks (admin audience) keep the icon.
  const me = useQuery({
    queryKey: ["me"],
    enabled: status === "signed_in" && audience === "api",
    queryFn: async () => {
      const { data, error } = await api().GET("/me");
      if (error) throw error;
      return data;
    },
  });
  const user = me.data;
  if (user?.avatarUrl) return <Avatar name={user.displayName} src={user.avatarUrl} size={size} />;
  return <UserCircle size={size} weight="fill" aria-hidden className="text-brand" />;
}

const iconBtn = "inline-flex size-11 shrink-0 items-center justify-center rounded-control text-ink transition-colors hover:bg-surface-2";

export function SiteHeader({ titleKey, homeHref, signInHref, meHref, nav, bell, search, roomy, actions, full }: HeaderConfig) {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const switchLocale = useSwitchLocale();
  const { status, signOut } = useAuth();
  // The menu belongs to the page it was opened on, so it closes by itself after navigating.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const menuOpen = menuFor === pathname;
  const closeMenu = () => setMenuFor(null);
  // Wide enough for the desktop nav: the phone menu closes, so nothing stays locked behind it.
  useEffect(() => {
    if (!menuOpen) return;
    const wide = window.matchMedia(roomy ? "(min-width: 1180px)" : "(min-width: 900px)");
    const onChange = () => wide.matches && setMenuFor(null);
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, [menuOpen, roomy]);
  const isCurrent = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  const switchLanguage = () => switchLocale(locale === "en" ? "bn" : "en");
  // On the sign-in and sign-up pages the header doesn't offer what the page already is.
  const onAuthPage = pathname.startsWith(signInHref) || pathname.startsWith("/signup");

  return (
    <>
    <header data-site-header className="sticky top-0 z-40 border-b border-[var(--glass-edge)] bg-[var(--glass-strong-bg)] backdrop-blur-xl backdrop-saturate-150">
      <div className="flex h-1" aria-hidden>
        <span className="w-[72%] bg-brand" />
        <span className="flex-1 bg-accent" />
      </div>
      {/* Desktop: logo left, the links centred, actions right (three columns). */}
      <div className={cn("mx-auto grid h-16 grid-cols-[minmax(0,1fr)_auto]", full ? "max-w-none" : "max-w-wide", "items-center gap-2 px-3 sm:px-5", roomy ? "lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-4" : "md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-6")}>
        <a href="#main" className="sr-only focus:not-sr-only">
          {t("nav.skip")}
        </a>
        <Link href={homeHref} className="flex min-w-0 items-center gap-2.5 justify-self-start no-underline" aria-label={t("nav.homeLabel")}>
          <LogoMark size={36} motion="live" className="shrink-0" />
          <span className="truncate whitespace-nowrap font-display text-lg font-bold tracking-tight sm:text-xl">{t(`app.${titleKey}`)}</span>
        </Link>
        <nav aria-label={t("nav.main")} className={cn("hidden items-center gap-1 justify-self-center", roomy ? "lg:flex" : "md:flex")}>
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
          {search}
          <ThemeToggle className={roomy ? "hidden lg:inline-flex" : "hidden md:inline-flex"} />
          {/* Phones: the icon only, so the site name keeps its room; the name stays for screen readers. */}
          <button type="button" className={cn(iconBtn, "gap-1.5 text-sm font-semibold sm:w-auto sm:px-2.5")} onClick={switchLanguage} lang={locale === "en" ? "bn" : "en"} aria-label={t("nav.language")} data-testid="language-switch">
            <Translate size={21} aria-hidden />
            <span className="hidden sm:inline">{t("nav.language")}</span>
          </button>
          {status === "signed_in" ? (
            <>
              {actions}
              {bell ? <NotificationBell centreHref={bell.centreHref} settingsHref={bell.settingsHref} /> : null}
              <span className={roomy ? "hidden lg:inline-flex" : "hidden md:inline-flex"}>
                <Menu
                  trigger={
                    <button type="button" className={cn(iconBtn, "w-auto gap-2 border border-line bg-surface pl-1.5 pr-3 text-sm font-semibold")} data-testid="account-menu">
                      <AccountGlyph size={26} />
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
          {/* The phone menu is the kit's Sheet (a Radix dialog): focus stays inside while it is open, Escape and the
              scrim close it, and focus goes back to this button (its trigger). The panel is portalled to <body>, out
              of the header (whose backdrop-filter would pin a fixed child to it). */}
          <Sheet
            open={menuOpen}
            onOpenChange={(o) => setMenuFor(o ? pathname : null)}
            side="right"
            title={t("nav.menu")}
            testId="site-menu"
            className={cn("w-[min(340px,88vw)] pb-[env(safe-area-inset-bottom)]", roomy ? "lg:hidden" : "md:hidden")}
            trigger={
              <button type="button" className={cn(iconBtn, roomy ? "lg:hidden" : "md:hidden")} data-testid="menu-button">
                <List size={22} aria-hidden />
                <span className="sr-only">{t("nav.menu")}</span>
              </button>
            }
          >
            <nav id="site-menu" aria-label={t("nav.main")} className="flex flex-col gap-1 px-3 pb-4">
              {nav.map((item, i) => (
                <NavLink key={item.href} href={item.href} current={isCurrent(item.href)} onClick={closeMenu} className={cn("flex min-h-12 animate-[kg-slide-in-up_320ms_var(--ease-kg)_both] items-center rounded-control px-3 text-[17px] font-semibold no-underline transition-colors motion-reduce:animate-none", isCurrent(item.href) ? "bg-brand-soft text-brand-text" : "hover:bg-surface-2")} style={{ animationDelay: `${60 + i * 40}ms` }}>
                  {t(`nav.${item.key}`)}
                </NavLink>
              ))}
              {status === "signed_in" ? (
                <>
                  <hr className="my-2 border-line" />
                  <Link href={meHref} onClick={closeMenu} className="flex min-h-12 items-center gap-3 rounded-control px-3 text-[17px] font-semibold no-underline hover:bg-surface-2">
                    <AccountGlyph size={22} />
                    {t("nav.me")}
                  </Link>
                  <button type="button" onClick={() => (closeMenu(), void signOut())} className="flex min-h-12 items-center gap-3 rounded-control px-3 text-left text-[17px] font-semibold hover:bg-surface-2">
                    <SignOut size={22} aria-hidden />
                    {t("nav.signOut")}
                  </button>
                </>
              ) : null}
              <div className="mt-2 border-t border-line px-1 pt-3">
                <ThemeToggle withLabel />
              </div>
            </nav>
          </Sheet>
        </div>
      </div>
    </header>
    </>
  );
}
