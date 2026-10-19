import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { areaForHost } from "./lib/area";

const intl = createMiddleware(routing);

/**
 * Host routing, then locale negotiation (next-intl). Each host only serves its own area:
 * /vendor on the admin host (or /admin on the vendor host) is a 404, so a staff page can never be
 * reached through the vendor domain. This is routing only; the API enforces access (ADR-004).
 */
export default function proxy(request: NextRequest) {
  const area = areaForHost(request.headers.get("host"));
  const other = area === "admin" ? "vendor" : "admin";
  const { pathname } = request.nextUrl;

  if (pathname === `/${other}` || pathname.startsWith(`/${other}/`)) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (pathname === `/${area}` || pathname.startsWith(`/${area}/`)) return intl(request);

  const url = request.nextUrl.clone();
  url.pathname = `/${area}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|env\\.js|_next|_vercel|.*\\..*).*)"],
};
