/**
 * Old page URLs → new ones (19 Oct 2026: Grounds became Venues; 3 Nov 2026: Events became the Tournaments feed, ADR-008).
 * next.config.ts serves these as permanent (308) redirects before the locale proxy runs, so links
 * already shared, bookmarked or sent in notifications keep working. Query strings are kept.
 */
import { redirectFor as matchRedirect, type Redirect } from "@kriraghor/session/redirects";

export type { Redirect };

export const REDIRECTS: Redirect[] = [
  { source: "/grounds", destination: "/venues", permanent: true },
  { source: "/grounds/:slug", destination: "/venues/:slug", permanent: true },
  { source: "/events", destination: "/tournaments", permanent: true },
  // Organised events are gone and their pages with them, so these land on the feed.
  { source: "/events/:slug", destination: "/tournaments", permanent: true },
  { source: "/events/:slug/register", destination: "/tournaments", permanent: true },
  { source: "/me/events", destination: "/me/tournaments", permanent: true },
  { source: "/me/teams", destination: "/me", permanent: true },
  { source: "/me/teams/:id", destination: "/me", permanent: true },
  { source: "/teams/join/:token", destination: "/me", permanent: true },
  { source: "/me/eligibility", destination: "/account/settings", permanent: true },
];

/** Where a path is sent by this app's table (for tests). */
export const redirectFor = (path: string, table: Redirect[] = REDIRECTS) => matchRedirect(path, table);
