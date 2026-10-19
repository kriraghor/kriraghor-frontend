/**
 * Old page URLs → new ones (19 Oct 2026: Grounds became Venues, tournaments became Events).
 * next.config.ts serves these as permanent (308) redirects before the locale proxy runs, so links
 * already shared, bookmarked or sent in notifications keep working. Query strings are kept.
 */
import { redirectFor as matchRedirect, type Redirect } from "@kriraghor/session/redirects";

export type { Redirect };

export const REDIRECTS: Redirect[] = [
  { source: "/grounds", destination: "/venues", permanent: true },
  { source: "/grounds/:slug", destination: "/venues/:slug", permanent: true },
  { source: "/tournaments", destination: "/events", permanent: true },
  { source: "/tournaments/:slug", destination: "/events/:slug", permanent: true },
  { source: "/tournaments/:slug/register", destination: "/events/:slug/register", permanent: true },
  { source: "/me/tournaments", destination: "/me/events", permanent: true },
];

/** Where a path is sent by this app's table (for tests). */
export const redirectFor = (path: string, table: Redirect[] = REDIRECTS) => matchRedirect(path, table);
