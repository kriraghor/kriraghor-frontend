/** Links that leave the portal for another Kriraghor site, kept in one place so server and client agree. */
import { crossSiteHref, crossSiteRedirect, isExternal } from "@kriraghor/session/links";

/** A path on gym.kriraghor.com, reached through /go/gym (runtime GYM_URL): gyms are managed there since 25 Oct 2026. */
export const gymHref = (path = "") => crossSiteHref("/go/gym", path);

/** Where /go/gym/<path> sends the visitor. Segments are re-encoded; only the gym host is ever used. */
export const gymRedirect = crossSiteRedirect;

export { isExternal };
