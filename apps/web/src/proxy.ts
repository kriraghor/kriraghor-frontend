import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/**
 * Locale negotiation (NEXT_LOCALE cookie, then Accept-Language) with no URL prefix.
 * Never used for authorisation: the hint cookies are routing hints only (ADR-004).
 */
export default createMiddleware(routing);

export const config = {
  // Skip API routes, /env.js, Next internals and files with an extension.
  matcher: ["/((?!api|env\\.js|_next|_vercel|.*\\..*).*)"],
};
