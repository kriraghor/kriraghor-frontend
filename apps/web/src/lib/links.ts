/** Links that leave kriraghor.com, kept in one place so server and client agree (no hydration drift). */
import { crossSiteHref, crossSiteRedirect, isExternal } from "@kriraghor/session/links";

/** A path on esports.kriraghor.com, reached through /go/esports (runtime ESPORTS_URL). */
export const esportsHref = (path = "") => crossSiteHref("/go/esports", path);

/** A path on gym.kriraghor.com, reached through /go/gym (runtime GYM_URL). */
export const gymHref = (path = "") => crossSiteHref("/go/gym", path);

/** Where /go/esports/<path> or /go/gym/<path> sends the visitor. Segments are re-encoded; only that site's host is ever used. */
export const esportsRedirect = crossSiteRedirect;

export { isExternal };
