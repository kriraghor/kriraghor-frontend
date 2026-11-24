import { Suspense } from "react";
import type { Metadata } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { Big_Shoulders } from "next/font/google";
import { fontVariables } from "@kriraghor/ui/fonts";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { ThemeScript } from "@kriraghor/ui/brand/theme-script";
import { BootSplash } from "@kriraghor/ui/brand/boot-splash";
import { routing } from "@kriraghor/ui/i18n/routing";
import { Providers } from "@kriraghor/ui/providers";
import { SiteHeader } from "@kriraghor/ui/site-header";
import { SiteFooter } from "@/components/SiteFooter";
import { APP } from "@/app.config";
import { BRAND_ICONS } from "@kriraghor/ui/brand/icons";
import { siteUrl } from "@/lib/seo";
import "../globals.css";

// The gym wordmark face (font-gym, the home page title), as on kriraghor.com's gym band. Only the two heavy
// weights, not preloaded: it is fetched when a heading uses it.
const shoulders = Big_Shoulders({ subsets: ["latin"], variable: "--font-shoulders", weight: ["800", "900"], preload: false, adjustFontFallback: false });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: APP.title, template: `%s · ${APP.title}` },
  description: APP.description,
  applicationName: APP.title,
  openGraph: { type: "website", siteName: APP.title, locale: "en_BD", alternateLocale: ["bn_BD"], images: [{ url: "/icon-512.png", width: 512, height: 512, alt: APP.title }] },
  twitter: { card: "summary" },
  icons: BRAND_ICONS,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * gym.kriraghor.com (M24, ADR-006 amendment): the gym hub, gym pages, passes and trainer plans, and
 * /manage for gym owners and their staff. The same account as every Kriraghor site (cookies on
 * .kriraghor.com); help, terms and the rest of the account stay on kriraghor.com (/go/web).
 * The whole page is the gym theme (lime accent): data-theme="gym" on <body>. Dark first; the header toggle
 * switches to the light gym palette (globals.css), remembered on this site.
 */
export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} suppressHydrationWarning className={`${fontVariables} ${shoulders.variable} h-full antialiased`}>
      <body data-theme="gym" className="flex min-h-full flex-col">
        {/* Theme before paint; the logo splash once per session (kriraghor-docs 09 §8). */}
        <ThemeScript fallback="dark" />
        <BootSplash word={locale === "bn" ? "ক্রীড়াঘর জিম" : "Kriraghor Gym"} />
        {/* Runtime config (ADR-003): window.__ENV before any client code runs. */}
        <Script src="/env.js" strategy="beforeInteractive" />
        <NextIntlClientProvider>
          <Providers audience={APP.audience}>
            {/* The header reads the pathname; routes known only at request time (/gyms/[slug]) stream it in. */}
            <Suspense fallback={<HeaderPlaceholder />}>
              <SiteHeader titleKey={APP.titleKey} homeHref="/" signInHref="/sign-in" meHref="/me" nav={APP.nav} bell={{ centreHref: "/me/notifications", settingsHref: "/me/notifications/settings" }} partner="/partner" />
            </Suspense>
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

/** Same height as the header, so nothing moves when it streams in. */
function HeaderPlaceholder() {
  return (
    <div className="sticky top-0 z-40 border-b border-[var(--glass-edge)] bg-[var(--glass-strong-bg)] backdrop-blur-xl backdrop-saturate-150" aria-hidden>
      <div className="h-1 bg-brand" />
      <div className="h-16" />
    </div>
  );
}
