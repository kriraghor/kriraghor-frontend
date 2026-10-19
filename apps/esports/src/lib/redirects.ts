/**
 * Old page URLs → new ones (19 Oct 2026: tournaments became Events, big events became Showcases).
 * next.config.ts serves these as permanent (308) redirects before the locale proxy runs, so links
 * already shared, bookmarked or sent in notifications keep working. Query strings are kept.
 */
export type Redirect = { source: string; destination: string; permanent: true };

export const REDIRECTS: Redirect[] = [
  { source: "/tournaments", destination: "/events", permanent: true },
  { source: "/t/:slug", destination: "/events/:slug", permanent: true },
  { source: "/t/:slug/register", destination: "/events/:slug/register", permanent: true },
  // /events itself now lists events, so the old big-events list has no redirect.
  { source: "/e/:slug", destination: "/showcases/:slug", permanent: true },
];

/** Where a path is sent (for tests): ":name" matches one segment, as in Next's path matching. */
export function redirectFor(path: string, table: Redirect[] = REDIRECTS): string | null {
  for (const r of table) {
    const names: string[] = [];
    const pattern = new RegExp(`^${r.source.replace(/:(\w+)/g, (_, n: string) => (names.push(n), "([^/]+)"))}$`);
    const m = path.match(pattern);
    if (!m) continue;
    return names.reduce((d, n, i) => d.replace(`:${n}`, m[i + 1]), r.destination);
  }
  return null;
}
