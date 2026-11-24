
import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
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
import { MobileTabBar } from "@/components/MobileTabBar";
import { CartLink } from "@/components/orders/CartLink";
import { HeaderSearch } from "@/components/search/HeaderSearch";
import { APP } from "@/app.config";
import { BRAND_ICONS } from "@kriraghor/ui/brand/icons";
import { siteUrl } from "@/lib/seo";
import "../globals.css";

// The gym sub-brand wordmark only (home gym band, M20).
const shoulders = Big_Shoulders({ subsets: ["latin"], variable: "--font-shoulders", weight: ["800", "900"], preload: false, adjustFontFallback: false });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${APP.title}: esports, venues, gear and talent`, template: `%s · ${APP.title}` },
  description: APP.description,
  other: {
    "msvalidate.01": "B63F2CF805E591F5C1DD3FF0AE95D02F",
  },
  applicationName: APP.title,
  openGraph: { type: "website", siteName: APP.title, locale: "en_BD", alternateLocale: ["bn_BD"], images: [{ url: "/icon-512.png", width: 512, height: 512, alt: APP.title }] },
  twitter: { card: "summary" },
  icons: BRAND_ICONS,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f0c" },
  ],
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} suppressHydrationWarning className={`${fontVariables} ${shoulders.variable} h-full antialiased`}>
      {/* Room for the floating phone tab bar (56px + its 8px gap + 8px air + the home indicator) under 900px.
          data-ui="v2": the new look's colours (UI v2, ADR-011), on <body> so dialogs portalled into it match. */}
      <body data-ui="v2" className="flex min-h-full flex-col pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-0">
        {/* Theme before paint; the logo splash once per session (kriraghor-docs 09 §8). */}
        <ThemeScript />
        <BootSplash word={locale === "bn" ? "ক্রীড়াঘর" : "Kriraghor"} />
        {/* Runtime config (ADR-003): window.__ENV before any client code runs. */}
        <Script src="/env.js" strategy="beforeInteractive" />
        <NextIntlClientProvider>
          <Providers audience={APP.audience}>
            {/* The header reads the pathname; routes known only at request time (/pay/[id]) stream it in. */}
            <Suspense fallback={<HeaderPlaceholder />}>
              <SiteHeader titleKey={APP.titleKey} homeHref="/" signInHref="/sign-in" meHref="/me" nav={APP.nav} bell={{ centreHref: "/me/notifications", settingsHref: "/me/notifications/settings" }} search={<HeaderSearch />} roomy actions={<CartLink />} partner="/business" />
            </Suspense>
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter />
            <Suspense fallback={null}>
              <MobileTabBar />
            </Suspense>
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
