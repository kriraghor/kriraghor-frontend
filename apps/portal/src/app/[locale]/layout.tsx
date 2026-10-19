import type { Metadata } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { Bricolage_Grotesque, Hind_Siliguri, Instrument_Sans } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@kriraghor/ui/i18n/routing";
import { APP } from "@/app.config";
import "../globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", weight: ["600", "700", "800"] });
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument" });
const hind = Hind_Siliguri({ subsets: ["bengali", "latin"], variable: "--font-hind", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: APP.title, template: `%s · ${APP.title}` },
  description: APP.description,
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** Shared shell. Each area (admin, vendor) adds its own session provider and header. */
export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${bricolage.variable} ${instrument.variable} ${hind.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Script src="/env.js" strategy="beforeInteractive" />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
