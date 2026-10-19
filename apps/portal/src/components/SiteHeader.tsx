"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@kriraghor/ui/i18n/navigation";
import { useAuth } from "@kriraghor/ui/auth";
import { NotificationBell } from "@kriraghor/ui/notifications/bell";

export type HeaderConfig = {
  titleKey: "web" | "esports" | "admin" | "vendor";
  homeHref: string;
  signInHref: string;
  meHref: string;
  nav: { href: string; key: string }[];
  /** M08 bell: where "See all" and "Settings" go. */
  bell?: { centreHref: string; settingsHref?: string };
};

export function SiteHeader({ titleKey, homeHref, signInHref, meHref, nav, bell }: HeaderConfig) {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { status, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b-2 border-line bg-bg">
      <div className="h-1 bg-brand" aria-hidden />
      <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-6 px-5">
        <a href="#main" className="sr-only focus:not-sr-only">
          Skip to content
        </a>
        <Link href={homeHref} className="font-bangla text-xl font-bold no-underline">
          {t(`app.${titleKey}`)}
        </Link>
        <nav aria-label="Main" className="hidden gap-5 text-sm font-semibold md:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="py-1 hover:underline" aria-current={pathname === item.href ? "page" : undefined}>
              {t(`nav.${item.key}`)}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="min-h-11 border border-line px-3 text-sm"
            onClick={() => router.replace(pathname, { locale: locale === "en" ? "bn" : "en" })}
            lang={locale === "en" ? "bn" : "en"}
          >
            {t("nav.language")}
          </button>
          {status === "signed_in" ? (
            <>
              {bell ? <NotificationBell centreHref={bell.centreHref} settingsHref={bell.settingsHref} /> : null}
              <Link href={meHref} className="inline-flex min-h-11 items-center border-2 border-line-strong px-4 text-sm font-bold">
                {t("nav.me")}
              </Link>
              <button type="button" onClick={() => void signOut()} className="min-h-11 bg-brand px-4 text-sm font-bold text-white hover:bg-brand-hover">
                {t("nav.signOut")}
              </button>
            </>
          ) : status === "signed_out" ? (
            <Link href={signInHref} className="inline-flex min-h-11 items-center bg-brand px-4 text-sm font-bold text-white hover:bg-brand-hover">
              {t("nav.signIn")}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
