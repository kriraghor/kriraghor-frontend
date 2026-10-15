import type { Audience } from "@/lib/auth/session";
import type { HeaderConfig } from "@/components/SiteHeader";

/**
 * One app, two areas, routed by host (proxy.ts):
 *   admin.kriraghor.com  → /admin  (staff; admin sessions, ADR-004)
 *   vendor.kriraghor.com → /vendor (ground owners, shops, gyms, organisers; customer sessions)
 * On plain localhost (no host to route by) PORTAL_DEFAULT_AREA picks the area (default admin).
 */
import type { Area } from "@/lib/area";
export type { Area };

export const AREAS: Record<Area, { audience: Audience; header: HeaderConfig }> = {
  admin: {
    audience: "admin",
    header: {
      titleKey: "admin",
      homeHref: "/admin",
      signInHref: "/admin/sign-in",
      meHref: "/admin",
      bell: { centreHref: "/admin/notifications" },
      nav: [
        { href: "/admin/fees", key: "fees" },
        { href: "/admin/catalog/esports", key: "esportsCatalog" },
        { href: "/admin/audit", key: "audit" },
        { href: "/admin/events", key: "events" },
      ],
    },
  },
  vendor: {
    audience: "api",
    header: { titleKey: "vendor", homeHref: "/vendor", signInHref: "/vendor/sign-in", meHref: "/vendor", nav: [] },
  },
};

export const APP = {
  id: "portal" as const,
  title: "Kriraghor Portal",
  description: "Admin and business desks for Kriraghor.",
};
