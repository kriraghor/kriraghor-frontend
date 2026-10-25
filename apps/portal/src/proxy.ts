import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@kriraghor/ui/i18n/routing";
import { serverPublicEnv } from "@kriraghor/session/env";
import { areaForHost } from "./lib/area";
import { gymRedirect } from "./lib/gym-redirect";

const intl = createMiddleware(routing);

/**
 * Host routing, then locale negotiation (next-intl). Each host only serves its own area:
 * /vendor on the admin host (or /admin on the vendor host) is a 404, so a staff page can never be
 * reached through the vendor domain. On the vendor host the old gym desks (/vendor/gyms…) answer 308
 * to gym.kriraghor.com/manage (lib/gym-redirect.ts; GYM_URL read at request time, ADR-003).
 * This is routing only; the API enforces access (ADR-004).
 */
export default function proxy(request: NextRequest) {
  const area = areaForHost(request.headers.get("host"));
  const other = area === "admin" ? "vendor" : "admin";
  const { pathname } = request.nextUrl;

  if (pathname === `/${other}` || pathname.startsWith(`/${other}/`)) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (area === "vendor") {
    const to = gymRedirect(pathname, request.nextUrl.search, serverPublicEnv().GYM_URL);
    if (to) return NextResponse.redirect(to, 308);
  }
  if (pathname === `/${area}` || pathname.startsWith(`/${area}/`)) return intl(request);

  const url = request.nextUrl.clone();
  url.pathname = `/${area}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip API routes, the /go/ redirects (to the gym app), /env.js, Next internals and files with an extension.
  // The dot is escaped for the regex ("\\." in a JS string), checked in lib/__tests__/gym-redirect.test.ts.
  matcher: ["/((?!api|go/|env\\.js|_next|_vercel|.*\\..*).*)"],
};
