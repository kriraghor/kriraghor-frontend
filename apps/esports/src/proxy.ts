import createMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";
import { routing } from "@kriraghor/ui/i18n/routing";
import { organiserRewrite } from "./lib/host";

const handleI18n = createMiddleware(routing);

/**
 * Locale negotiation (NEXT_LOCALE cookie, then Accept-Language) with no URL prefix.
 * Never used for authorisation: the hint cookies are routing hints only (ADR-004).
 * M22 organiser subdomains ({sub}.esports.kriraghor.com → /o/{sub}) are switched off while esports is
 * organised by Kriraghor only (ORGANISER_SUBDOMAINS_ENABLED in lib/host.ts), so every host is the shared site.
 */
export default function proxy(request: NextRequest) {
  const rewrite = organiserRewrite(request.headers.get("host"), request.nextUrl.pathname);
  if (rewrite) {
    const url = request.nextUrl.clone();
    url.pathname = rewrite;
    return handleI18n(new NextRequest(url, request));
  }
  return handleI18n(request);
}

export const config = {
  // Skip API routes, the /go/ redirects, /env.js, Next internals and files with an extension.
  matcher: ["/((?!api|go/|env\.js|_next|_vercel|.*\..*).*)"],
};
