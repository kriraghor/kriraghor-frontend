import createMiddleware from "next-intl/middleware";
import { routing } from "@kriraghor/ui/i18n/routing";

/**
 * Locale negotiation (NEXT_LOCALE cookie, then Accept-Language) with no URL prefix.
 * Never used for authorisation: the hint cookies are routing hints only (ADR-004).
 */
export default createMiddleware(routing);

export const config = {
  // Skip API routes, the /go/ redirects, /env.js, Next internals and files with an extension.
  matcher: ["/((?!api|go/|env\\.js|_next|_vercel|.*\\..*).*)"],
};
