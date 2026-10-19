import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { Big_Shoulders, Bricolage_Grotesque, Hind_Siliguri, Instrument_Sans } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Providers } from "@/components/Providers";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileTabBar } from "@/components/MobileTabBar";
import { CartLink } from "@/components/orders/CartLink";
import { APP } from "@/app.config";
import { siteUrl } from "@/lib/seo";
import "../globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", weight: ["600", "700", "800"] });
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument" });
const hind = Hind_Siliguri({ subsets: ["bengali", "latin"], variable: "--font-hind", weight: ["400", "500", "600", "700"] });
// The gym sub-brand wordmark only (home gym band, M20).
const shoulders = Big_Shoulders({ subsets: ["latin"], variable: "--font-shoulders", weight: ["800", "900"], preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${APP.title}: esports, grounds, gear and talent`, template: `%s · ${APP.title}` },
  description: APP.description,
  applicationName: APP.title,
  openGraph: { type: "website", siteName: APP.title, locale: "en_BD", alternateLocale: ["bn_BD"], images: [{ url: "/logo.png", width: 512, height: 512, alt: APP.title }] },
  twitter: { card: "summary" },
  icons: { icon: "/favicon.ico", apple: "/logo.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1411" },
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
    <html lang={locale} className={`${bricolage.variable} ${instrument.variable} ${hind.variable} ${shoulders.variable} h-full antialiased`}>
      {/* Room for the phone tab bar (56px + the home indicator) under 900px. */}
      <body className="flex min-h-full flex-col pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">
        {/* Runtime config (ADR-003): window.__ENV before any client code runs. */}
        <Script src="/env.js" strategy="beforeInteractive" />
        <NextIntlClientProvider>
          <Providers audience={APP.audience}>
            {/* The header reads the pathname; routes known only at request time (/pay/[id]) stream it in. */}
            <Suspense fallback={<HeaderPlaceholder />}>
              <SiteHeader titleKey={APP.titleKey} homeHref="/" signInHref="/sign-in" meHref="/me" nav={APP.nav} bell={{ centreHref: "/me/notifications", settingsHref: "/me/notifications/settings" }} actions={<CartLink />} />
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
    <div className="sticky top-0 z-40 border-b-2 border-line bg-bg" aria-hidden>
      <div className="h-1 bg-brand" />
      <div className="h-16" />
    </div>
  );
}
