/** Permanent redirects from old page URLs; each app keeps its own table and serves it from next.config.ts. */
export type Redirect = { source: string; destination: string; permanent: true };

/** Where a path is sent by `table`: ":name" matches one segment, ":name*" the rest, as in Next. */
export function redirectFor(path: string, table: Redirect[]): string | null {
  for (const r of table) {
    const names: string[] = [];
    const pattern = new RegExp(`^${r.source.replace(/:(\w+)(\*)?/g, (_, n: string, star?: string) => (names.push(n), star ? "(.*)" : "([^/]+)"))}$`);
    const m = path.match(pattern);
    if (!m) continue;
    return names.reduce((d, n, i) => d.replace(new RegExp(`:${n}\\*?`), m[i + 1]), r.destination);
  }
  return null;
}
