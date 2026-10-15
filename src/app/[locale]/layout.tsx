import { Suspense } from "react";
import type { Metadata } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { Bricolage_Grotesque, Hind_Siliguri, Instrument_Sans } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Providers } from "@/components/Providers";
import { SiteHeader } from "@/components/SiteHeader";
import { APP } from "@/app.config";
import "../globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", weight: ["600", "700", "800"] });
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument" });
const hind = Hind_Siliguri({ subsets: ["bengali", "latin"], variable: "--font-hind", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: APP.title, template: `%s · ${APP.title}` },
  description: APP.description,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${bricolage.variable} ${instrument.variable} ${hind.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Runtime config (ADR-003): window.__ENV before any client code runs. */}
        <Script src="/env.js" strategy="beforeInteractive" />
        <NextIntlClientProvider>
          <Providers audience={APP.audience}>
            {/* The header reads the pathname; routes known only at request time (/pay/[id]) stream it in. */}
            <Suspense fallback={<HeaderPlaceholder />}>
              <SiteHeader titleKey={APP.titleKey} homeHref="/" signInHref="/sign-in" meHref="/me" nav={APP.nav} bell={{ centreHref: "/me/notifications", settingsHref: "/me/notifications/settings" }} />
            </Suspense>
            <main id="main" className="flex-1">
              {children}
            </main>
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
