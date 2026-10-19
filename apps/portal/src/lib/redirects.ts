/**
 * Old desk URLs → new ones (19 Oct 2026: Grounds became Venues, tournaments became Events, big
 * events became Showcases). next.config.ts serves these as permanent (308) redirects before the host
 * proxy, so links in notifications and bookmarks keep working. /admin/events stays the outbox desk.
 */
import { redirectFor as matchRedirect, type Redirect } from "@kriraghor/session/redirects";

export type { Redirect };

export const REDIRECTS: Redirect[] = [
  { source: "/vendor/grounds", destination: "/vendor/venues", permanent: true },
  { source: "/vendor/grounds/:path*", destination: "/vendor/venues/:path*", permanent: true },
  { source: "/vendor/tournaments", destination: "/vendor/events", permanent: true },
  { source: "/vendor/tournaments/:org", destination: "/vendor/events/:org", permanent: true },
  { source: "/vendor/tournaments/:org/t/:id", destination: "/vendor/events/:org/e/:id", permanent: true },
  { source: "/vendor/esports/:org/tournaments", destination: "/vendor/esports/:org/events", permanent: true },
  { source: "/vendor/esports/:org/tournaments/:id", destination: "/vendor/esports/:org/events/:id", permanent: true },
  { source: "/admin/grounds", destination: "/admin/venues", permanent: true },
  { source: "/admin/tournaments", destination: "/admin/sports-events", permanent: true },
  { source: "/admin/esports/events", destination: "/admin/esports/showcases", permanent: true },
];

/** Where a path is sent by this app's table (for tests). */
export const redirectFor = (path: string, table: Redirect[] = REDIRECTS) => matchRedirect(path, table);
