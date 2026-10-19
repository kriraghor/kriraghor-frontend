/**
 * Old page URLs → new ones (19 Oct 2026: tournaments became Events, big events became Showcases).
 * next.config.ts serves these as permanent (308) redirects before the locale proxy runs, so links
 * already shared, bookmarked or sent in notifications keep working. Query strings are kept.
 */
import { redirectFor as matchRedirect, type Redirect } from "@kriraghor/session/redirects";

export type { Redirect };

export const REDIRECTS: Redirect[] = [
  { source: "/tournaments", destination: "/events", permanent: true },
  { source: "/t/:slug", destination: "/events/:slug", permanent: true },
  { source: "/t/:slug/register", destination: "/events/:slug/register", permanent: true },
  // /events itself now lists events, so the old big-events list has no redirect.
  { source: "/e/:slug", destination: "/showcases/:slug", permanent: true },
];

/** Where a path is sent by this app's table (for tests). */
export const redirectFor = (path: string, table: Redirect[] = REDIRECTS) => matchRedirect(path, table);
