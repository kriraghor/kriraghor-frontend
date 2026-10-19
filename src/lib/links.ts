/** Links that leave kriraghor.com, kept in one place so server and client agree (no hydration drift). */

/** A path on esports.kriraghor.com, reached through /go/esports (runtime ESPORTS_URL). */
export const esportsHref = (path = "") => `/go/esports${path.startsWith("/") || !path ? path : `/${path}`}`;

/** Where /go/esports/<path> sends the visitor. Segments are re-encoded; only the esports host is ever used. */
export function esportsRedirect(base: string, segments: string[], search = "") {
  const root = base.replace(/\/+$/, "");
  const path = segments
    .filter((s) => s && s !== "." && s !== "..")
    .map((s) => encodeURIComponent(s))
    .join("/");
  return `${root}/${path}${search.startsWith("?") && search.length > 1 ? search : ""}`;
}

export const isExternal = (href: string) => href.startsWith("/go/") || /^https?:\/\//.test(href);
