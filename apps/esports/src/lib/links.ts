/** Links that leave esports.kriraghor.com, kept in one place so server and client agree. */

/** A path on kriraghor.com, reached through /go/web (runtime WEB_URL). */
export const webHref = (path = "") => `/go/web${path.startsWith("/") || !path ? path : `/${path}`}`;

/** Where /go/web/<path> sends the visitor. Segments are re-encoded; only the web host is ever used. */
export function webRedirect(base: string, segments: string[], search = "") {
  const root = base.replace(/\/+$/, "");
  const p = segments
    .filter((s) => s && s !== "." && s !== "..")
    .map((s) => encodeURIComponent(s))
    .join("/");
  return `${root}/${p}${search.startsWith("?") && search.length > 1 ? search : ""}`;
}

export const isExternal = (href: string) => href.startsWith("/go/") || /^https?:\/\//.test(href);
