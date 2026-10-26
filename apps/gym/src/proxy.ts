import createMiddleware from "next-intl/middleware";
import { routing } from "@kriraghor/ui/i18n/routing";

/**
 * Locale negotiation (NEXT_LOCALE cookie, then Accept-Language) with no URL prefix.
 * Never used for authorisation: the hint cookies are routing hints only (ADR-004).
 */
export default createMiddleware(routing);

export const config = {
  // Skip API routes, the /go/ redirects, /env.js, Next internals and files with an extension.
  // The dot is escaped for the regex ("\\." in a JS string): "\." would match any character and
  // skip every page but "/" (the Round A outage, lib/__tests__/proxy-matcher.test.ts).
  // The receipt links /r/<token> carry dots (v1.<id>.<sig>), so they are matched on their own.
  matcher: ["/((?!api|go/|env\\.js|_next|_vercel|.*\\..*).*)", "/r/:token"],
};
