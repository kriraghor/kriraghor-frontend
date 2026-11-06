/** Links that leave the portal for another Kriraghor site, kept in one place so server and client agree. */
import { crossSiteHref, crossSiteRedirect, isExternal } from "@kriraghor/session/links";

/** A path on gym.kriraghor.com, reached through /go/gym (runtime GYM_URL): gyms are managed there since 25 Oct 2026. */
export const gymHref = (path = "") => crossSiteHref("/go/gym", path);

/** A path on kriraghor.com, reached through /go/web (runtime WEB_URL). */
export const webHref = (path = "") => crossSiteHref("/go/web", path);

/** Where /go/gym/<path> sends the visitor. Segments are re-encoded; only the gym host is ever used. */
export const gymRedirect = crossSiteRedirect;

export { isExternal };
