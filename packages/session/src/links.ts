/**
 * Links that leave one Kriraghor site for another, through a /go/<site> route on the current site
 * (the destination host comes from runtime env, so server and client render the same href).
 */

/** A path on another site, reached through `prefix` (for example "/go/esports"). */
export const crossSiteHref = (prefix: string, path = "") => `${prefix}${path.startsWith("/") || !path ? path : `/${path}`}`;

/** Where /go/<site>/<path> sends the visitor. Segments are re-encoded; only `base` is ever used as the host. */
export function crossSiteRedirect(base: string, segments: string[], search = "") {
  const root = base.replace(/\/+$/, "");
  const path = segments
    .filter((s) => s && s !== "." && s !== "..")
    .map((s) => encodeURIComponent(s))
    .join("/");
  return `${root}/${path}${search.startsWith("?") && search.length > 1 ? search : ""}`;
}

export const isExternal = (href: string) => href.startsWith("/go/") || /^https?:\/\//.test(href);
