import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@kriraghor/ui/i18n/routing";
import { serverPublicEnv } from "@kriraghor/session/env";
import { gymRedirect } from "./lib/gym-redirect";

const intl = createMiddleware(routing);

/**
 * The old gym URLs first (308 to gym.kriraghor.com with the query kept, lib/gym-redirect.ts; GYM_URL is
 * read at request time, ADR-003), then locale negotiation (NEXT_LOCALE cookie, then Accept-Language)
 * with no URL prefix. Never used for authorisation: the hint cookies are routing hints only (ADR-004).
 */
export default function proxy(request: NextRequest) {
  const to = gymRedirect(request.nextUrl.pathname, request.nextUrl.search, serverPublicEnv().GYM_URL);
  if (to) return NextResponse.redirect(new URL(to, request.url), 308);
  return intl(request);
}

export const config = {
  // Skip API routes, the /go/ redirects, /env.js, Next internals and files with an extension.
  matcher: ["/((?!api|go/|env\\.js|_next|_vercel|.*\\..*).*)"],
};
