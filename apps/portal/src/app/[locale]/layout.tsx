import type { Metadata } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { fontVariables } from "@kriraghor/ui/fonts";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { ThemeScript } from "@kriraghor/ui/brand/theme-script";
import { routing } from "@kriraghor/ui/i18n/routing";
import { APP } from "@/app.config";
import "../globals.css";


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
    <html lang={locale} suppressHydrationWarning className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ThemeScript />
        <Script src="/env.js" strategy="beforeInteractive" />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
