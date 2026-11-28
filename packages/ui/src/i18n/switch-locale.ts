import { useRouter } from "next/navigation";
import type { Locale } from "./routing";
import { snapshotForms } from "./form-carry";

/**
 * Switches the site language where the user is. URLs carry no locale, so the browser keeps prefetched
 * pages under the same URL in both languages; navigating with { locale } leaves those in the old language
 * until a reload. Refreshing clears them, and the proxy picks the language from the cookie. The URL stays
 * as it is, query string included. Typed form text is saved first and put back on the page in the new
 * language (form-carry.ts, 28 Nov 2026).
 */
export function useSwitchLocale() {
  const router = useRouter();
  return (locale: Locale) => {
    snapshotForms();
    document.cookie = `NEXT_LOCALE=${locale}; path=/; SameSite=lax`;
    router.refresh();
  };
}
