import { useRouter } from "next/navigation";
import type { Locale } from "./routing";

/**
 * Switches the site language where the user is. URLs carry no locale, so the browser keeps prefetched
 * pages under the same URL in both languages; navigating with { locale } leaves those in the old language
 * until a reload. Refreshing clears them, and the proxy picks the language from the cookie. The URL stays
 * as it is, query string included.
 */
export function useSwitchLocale() {
  const router = useRouter();
  return (locale: Locale) => {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; SameSite=lax`;
    router.refresh();
  };
}
