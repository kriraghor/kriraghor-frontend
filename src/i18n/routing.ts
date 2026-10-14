import { defineRouting } from "next-intl/routing";

/**
 * English and Bangla. URLs carry no locale prefix: the NEXT_LOCALE cookie (set by the language switch)
 * or Accept-Language picks the locale, and pages are still prerendered per locale.
 * Switch localePrefix to "as-needed" when Bangla pages need their own URLs for SEO.
 */
export const routing = defineRouting({
  locales: ["en", "bn"],
  defaultLocale: "en",
  localePrefix: "never",
});

export type Locale = (typeof routing.locales)[number];
