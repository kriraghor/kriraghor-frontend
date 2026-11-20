"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@kriraghor/api-client";
import { useLocale, useTranslations } from "next-intl";
import { Handshake, List, SignOut, Translate, UserCircle } from "@phosphor-icons/react";
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
  /** The site-wide search (kriraghor.com): it fills the middle of the top row and grows with the screen. */
  search?: ReactNode;
  /** Keep the phone menu up to the `lg` breakpoint, for sites whose links and actions need the room. */
  roomy?: boolean;
  /** Extra signed-in actions before the bell (kriraghor.com: the cart, M13). */
  actions?: ReactNode;
  /** Full width, for desks whose sidebar runs from the left edge (the portal). */
  full?: boolean;
  /** "Partner with us" (tester feedback, 19 Nov 2026): a text link to where business content lives. */
  partner?: string;
};

/** A nav link: in-app routes through next-intl, the /go/ redirects and other sites as plain links. */
function NavLink({ href, className, current, children, onClick, style, testId }: { href: string; className: string; current?: boolean; children: ReactNode; onClick?: () => void; style?: CSSProperties; testId?: string }) {
  if (isExternal(href)) {
    return (
      <a href={href} className={className} onClick={onClick} style={style} data-testid={testId}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} aria-current={current ? "page" : undefined} onClick={onClick} style={style} data-testid={testId}>
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

const iconBtn = "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control text-ink transition-colors hover:bg-surface-2 active:scale-95";
const drawerRow = "flex min-h-12 w-full items-center gap-3 rounded-control px-3 text-left text-[17px] font-semibold no-underline transition-colors hover:bg-surface-2";

/**
 * The site header (tester feedback, 19 Nov 2026).
 *
 * - Top row, sticky: the logo; the search (kriraghor.com), which fills the middle and grows with the screen;
 *   then "Partner with us" as a text link, the cart and bell, the account as the person's photo or icon, and
 *   the menu button.
 * - The links are centred. With a search they get a row of their own under it, which scrolls away with the
 *   page so the sticky part stays one row; without one (gym, esports, the portal) they sit centred in the top row.
 * - The menu (a drawer at every size) holds the language and the theme; on phones also the links, Partner
 *   with us and the account.
 */
export function SiteHeader({ titleKey, homeHref, signInHref, meHref, nav, bell, search, roomy, actions, full, partner }: HeaderConfig) {
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
  const isCurrent = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  // On the sign-in and sign-up pages the header doesn't offer what the page already is.
  const onAuthPage = pathname.startsWith(signInHref) || pathname.startsWith("/signup");
  const partnerLabel = t("kit.header.partner");
  const signedIn = status === "signed_in";

  // Where the desktop layout starts: `lg` for sites with many links (roomy), else `md`. Static class names for Tailwind.
  const wide = roomy
    ? { show: "hidden lg:inline-flex", block: "hidden lg:flex", hide: "lg:hidden", query: "(min-width: 1024px)" }
    : { show: "hidden md:inline-flex", block: "hidden md:flex", hide: "md:hidden", query: "(min-width: 768px)" };

  // The drawer's phone-only part (links, Partner with us, the account) closes it when the screen grows past it.
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(wide.query);
    const sync = () => setIsWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [wide.query]);

  const links = (place: "top" | "row") =>
    nav.map((item) => {
      const on = isCurrent(item.href);
      return (
        <NavLink
          key={item.href}
          href={item.href}
          current={on}
          className={cn(
            "relative shrink-0 whitespace-nowrap rounded-control px-3 py-2 text-[15px] font-medium no-underline transition-colors",
            on ? "text-brand-text" : "text-ink/70 hover:bg-surface-2 hover:text-ink",
          )}
        >
          {t(`nav.${item.key}`)}
          {on ? <span className={cn("absolute inset-x-3 h-0.5 rounded-pill bg-brand", place === "top" ? "-bottom-[13px]" : "-bottom-[5px]")} aria-hidden /> : null}
        </NavLink>
      );
    });

  return (
    <>
      <header data-site-header className="sticky top-0 z-40 border-b border-[var(--glass-edge)] bg-[var(--glass-strong-bg)] backdrop-blur-xl backdrop-saturate-150">
        <div className="flex h-1" aria-hidden>
          <span className="w-[72%] bg-brand" />
          <span className="flex-1 bg-accent" />
        </div>
        <div
          className={cn(
            "mx-auto flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-5",
            full ? "max-w-none" : "max-w-wide",
            // Without a search the links are centred between the logo and the actions (equal side columns).
            !search && (roomy ? "lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6" : "md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-6"),
          )}
        >
          <a href="#main" className="sr-only focus:not-sr-only">
            {t("nav.skip")}
          </a>
          <Link href={homeHref} className="flex min-w-0 shrink-0 items-center gap-2.5 justify-self-start no-underline" aria-label={t("nav.homeLabel")}>
            <LogoMark size={36} motion="live" className="shrink-0" />
            {/* With a search on a phone the mark alone, so the box gets the room; the name stays for screen readers. */}
            <span className={cn("truncate whitespace-nowrap font-display text-lg font-bold tracking-tight sm:text-xl", search && "sr-only sm:not-sr-only")}>{t(`app.${titleKey}`)}</span>
          </Link>

          {search ? (
            <div className="flex min-w-0 flex-1 justify-center" data-testid="header-search-slot">
              <div className="w-full max-w-[min(100%,46rem)] xl:max-w-[52rem]">{search}</div>
            </div>
          ) : (
            <>
              <nav aria-label={t("nav.main")} className={cn("items-center gap-1 justify-self-center", wide.block)} data-testid="site-nav">
                {links("top")}
              </nav>
              {/* Phones: push the actions to the right. */}
              <span className={cn("flex-1", wide.hide)} aria-hidden />
            </>
          )}

          <div className="flex shrink-0 items-center gap-1 justify-self-end sm:gap-1.5">
            {partner ? (
              <NavLink
                href={partner}
                current={isCurrent(partner)}
                testId="partner-link"
                className={cn(wide.show, "min-h-11 items-center whitespace-nowrap px-2 text-sm font-semibold text-ink/80 underline-offset-4 transition-colors hover:text-brand-text hover:underline", isCurrent(partner) && "text-brand-text")}
              >
                {partnerLabel}
              </NavLink>
            ) : null}
            {signedIn ? (
              <>
                {actions}
                {bell ? <NotificationBell centreHref={bell.centreHref} settingsHref={bell.settingsHref} /> : null}
                <span className={wide.show}>
                  <Menu
                    trigger={
                      <button type="button" className={cn(iconBtn, "rounded-pill")} aria-label={t("nav.me")} title={t("nav.me")} data-testid="account-menu">
                        <AccountGlyph size={30} />
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
              <ButtonLink href={signInHref} size="md" className="min-h-10 whitespace-nowrap px-3.5 sm:px-4">
                {t("nav.signIn")}
              </ButtonLink>
            ) : null}
            {/* The menu is the kit's Sheet (a Radix dialog): focus stays inside while it is open, Escape and the
                scrim close it, and focus goes back to this button. The panel is portalled to <body>, out of the
                header (whose backdrop-filter would pin a fixed child to it). */}
            <Sheet
              open={menuOpen}
              onOpenChange={(o) => setMenuFor(o ? pathname : null)}
              side="right"
              title={t("nav.menu")}
              testId="site-menu"
              className="w-[min(340px,88vw)] pb-[env(safe-area-inset-bottom)]"
              trigger={
                <button type="button" className={iconBtn} aria-label={t("nav.menu")} title={t("nav.menu")} data-testid="menu-button">
                  <List size={22} aria-hidden />
                </button>
              }
            >
              <div id="site-menu" className="flex flex-col gap-1 px-3 pb-4">
                {!isWide ? (
                  <>
                    <nav aria-label={t("nav.main")} className="flex flex-col gap-1">
                      {nav.map((item, i) => (
                        <NavLink
                          key={item.href}
                          href={item.href}
                          current={isCurrent(item.href)}
                          onClick={closeMenu}
                          className={cn(drawerRow, "animate-[kg-slide-in-up_320ms_var(--ease-kg)_both] motion-reduce:animate-none", isCurrent(item.href) && "bg-brand-soft text-brand-text")}
                          style={{ animationDelay: `${60 + i * 40}ms` }}
                        >
                          {t(`nav.${item.key}`)}
                        </NavLink>
                      ))}
                    </nav>
                    {partner ? (
                      <NavLink href={partner} current={isCurrent(partner)} onClick={closeMenu} className={drawerRow}>
                        <Handshake size={22} aria-hidden />
                        {partnerLabel}
                      </NavLink>
                    ) : null}
                    {signedIn ? (
                      <>
                        <hr className="my-2 border-line" />
                        <Link href={meHref} onClick={closeMenu} className={drawerRow}>
                          <AccountGlyph size={22} />
                          {t("nav.me")}
                        </Link>
                        <button type="button" onClick={() => (closeMenu(), void signOut())} className={drawerRow}>
                          <SignOut size={22} aria-hidden />
                          {t("nav.signOut")}
                        </button>
                      </>
                    ) : null}
                    <hr className="my-2 border-line" />
                  </>
                ) : null}
                {/* Settings: the language and the theme, at every size. */}
                <button type="button" onClick={() => switchLocale(locale === "en" ? "bn" : "en")} lang={locale === "en" ? "bn" : "en"} className={drawerRow} data-testid="language-switch">
                  <Translate size={22} aria-hidden />
                  {t("nav.language")}
                </button>
                <ThemeToggle withLabel className="min-h-12 w-full justify-start gap-3 px-3 text-[17px]" />
              </div>
            </Sheet>
          </div>
        </div>
      </header>
      {/* With a search, the links get their own centred row; it scrolls away with the page. */}
      {search && nav.length > 0 ? (
        <div data-site-nav className={cn("hidden border-b border-line/70 bg-[var(--glass-bg)]", roomy ? "lg:block" : "md:block")}>
          <nav aria-label={t("nav.main")} className={cn("mx-auto flex h-11 items-center justify-center gap-1 px-3 sm:px-5", full ? "max-w-none" : "max-w-wide")} data-testid="site-nav">
            {links("row")}
          </nav>
        </div>
      ) : null}
    </>
  );
}
