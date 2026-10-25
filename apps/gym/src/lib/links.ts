/** Links that leave gym.kriraghor.com, kept in one place so server and client agree. */
import { crossSiteHref, crossSiteRedirect, isExternal } from "@kriraghor/session/links";

/** A path on kriraghor.com (help, terms, the account, the shop, hire profiles), reached through /go/web (runtime WEB_URL). */
export const webHref = (path = "") => crossSiteHref("/go/web", path);

/** Where /go/web/<path> sends the visitor. Segments are re-encoded; only the web host is ever used. */
export const webRedirect = crossSiteRedirect;

/** A ?next= value that stays on this site (a path, never another host). */
export const safeNext = (v: string | null | undefined, fallback = "/me/passes") => (v && v.startsWith("/") && !v.startsWith("//") ? v : fallback);

export { isExternal };
