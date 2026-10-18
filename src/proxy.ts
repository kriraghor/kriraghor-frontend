import createMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { organiserOf } from "./lib/host";

const handleI18n = createMiddleware(routing);

/**
 * Locale negotiation (NEXT_LOCALE cookie, then Accept-Language) with no URL prefix.
 * Never used for authorisation: the hint cookies are routing hints only (ADR-004).
 * M22: on an organiser's subdomain ({sub}.esports.kriraghor.com) the home page is that organiser's
 * branded page (/o/{sub}); every other path (tournaments, sign-in, my winnings) is the shared site.
 */
export default function proxy(request: NextRequest) {
  const sub = organiserOf(request.headers.get("host"));
  if (sub && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = `/o/${sub}`;
    return handleI18n(new NextRequest(url, request));
  }
  return handleI18n(request);
}

export const config = {
  // Skip API routes, /env.js, Next internals and files with an extension.
  matcher: ["/((?!api|env\\.js|_next|_vercel|.*\\..*).*)"],
};
