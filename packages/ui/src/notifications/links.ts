/**
 * Where a notification link opens (M08). The backend sends plain paths and does not know which site
 * the bell is on: `/me/...`, `/account/...` and the other member pages live on kriraghor.com,
 * `/vendor/...` on the business panel, `/admin/...` on the staff desk, and a few esports pages on
 * esports.kriraghor.com. A path that belongs to the current site goes through the in-app router;
 * any other becomes an absolute URL on the right host. When that host is not configured the path is
 * left relative (the current site's redirects then take it from there).
 */
export type Site = "web" | "vendor" | "admin" | "esports";
export type SiteUrls = { webUrl?: string; vendorUrl?: string; adminUrl?: string; esportsUrl?: string };
export type ResolvedLink = { href: string; external: boolean };

/** Pages only esports.kriraghor.com has. */
const ESPORTS_ONLY = ["/showcases", "/leaderboards", "/me/matches", "/me/winnings", "/me/esports"];
/** What else the esports site serves itself (the rest of /me is the account on kriraghor.com). */
const ESPORTS_OWN = [...ESPORTS_ONLY, "/events", "/p", "/o", "/me/notifications"];

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`) || path.startsWith(`${prefix}#`);

/** The site a plain path belongs to, seen from `here` (shared paths stay on the current site). */
export function siteOfPath(path: string, here: Site): Site {
  if (under(path, "/admin")) return "admin";
  if (under(path, "/vendor")) return "vendor";
  if (here === "esports") return ESPORTS_OWN.some((p) => under(path, p)) ? "esports" : "web";
  if (ESPORTS_ONLY.some((p) => under(path, p))) return "esports";
  return "web";
}

const BASE: Record<Site, keyof SiteUrls> = { web: "webUrl", vendor: "vendorUrl", admin: "adminUrl", esports: "esportsUrl" };

/**
 * A notification link as the bell should open it, or null when there is nothing safe to open
 * (empty, protocol-relative or a non-http scheme).
 */
export function resolveNotificationLink(link: string | null | undefined, opts: { here: Site } & SiteUrls): ResolvedLink | null {
  const value = link?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return { href: value, external: true };
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  const site = siteOfPath(value, opts.here);
  if (site === opts.here) return { href: value, external: false };
  const base = opts[BASE[site]]?.trim().replace(/\/+$/, "");
  if (!base || !/^https?:\/\//i.test(base)) return { href: value, external: false };
  return { href: `${base}${value}`, external: true };
}

/** The site a bell is on, from its "See all" link (and the page's origin for kriraghor.com vs esports). */
export function siteOfBell(centreHref: string, origin: string | null, esportsUrl?: string): Site {
  if (under(centreHref, "/admin")) return "admin";
  if (under(centreHref, "/vendor")) return "vendor";
  if (origin && esportsUrl) {
    try {
      if (new URL(esportsUrl).origin === origin) return "esports";
    } catch {
      // A malformed ESPORTS_URL: treat the page as kriraghor.com.
    }
  }
  return "web";
}
