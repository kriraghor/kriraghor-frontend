/** Links that leave esports.kriraghor.com, kept in one place so server and client agree. */
import { crossSiteHref, crossSiteRedirect, isExternal } from "@kriraghor/session/links";

/** A path on kriraghor.com, reached through /go/web (runtime WEB_URL). */
export const webHref = (path = "") => crossSiteHref("/go/web", path);

/** A path on gym.kriraghor.com, reached through /go/gym (runtime GYM_URL). */
export const gymHref = (path = "") => crossSiteHref("/go/gym", path);

/** Where /go/web/<path> (or /go/gym/<path>) sends the visitor. Segments are re-encoded; only the web host is ever used. */
export const webRedirect = crossSiteRedirect;

export { isExternal };
