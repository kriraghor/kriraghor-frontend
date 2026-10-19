/**
 * Old page URLs → new ones (19 Oct 2026: Grounds became Venues, tournaments became Events).
 * next.config.ts serves these as permanent (308) redirects before the locale proxy runs, so links
 * already shared, bookmarked or sent in notifications keep working. Query strings are kept.
 */
export type Redirect = { source: string; destination: string; permanent: true };

export const REDIRECTS: Redirect[] = [
  { source: "/grounds", destination: "/venues", permanent: true },
  { source: "/grounds/:slug", destination: "/venues/:slug", permanent: true },
  { source: "/tournaments", destination: "/events", permanent: true },
  { source: "/tournaments/:slug", destination: "/events/:slug", permanent: true },
  { source: "/tournaments/:slug/register", destination: "/events/:slug/register", permanent: true },
  { source: "/me/tournaments", destination: "/me/events", permanent: true },
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
