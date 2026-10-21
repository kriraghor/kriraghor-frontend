import type { Audience } from "@kriraghor/session/auth";
import type { HeaderConfig } from "@kriraghor/ui/site-header";

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
      // The desks are in the sidebar (PortalShell); the header keeps the bell, theme and account.
      nav: [],
    },
  },
  vendor: {
    audience: "api",
    header: {
      titleKey: "vendor",
      homeHref: "/vendor",
      signInHref: "/vendor/sign-in",
      meHref: "/vendor",
      // The desks are in the sidebar (PortalShell); the header keeps the bell, theme and account.
      nav: [],
    },
  },
};

export const APP = {
  id: "portal" as const,
  title: "Kriraghor Portal",
  description: "Admin and business desks for Kriraghor.",
};
