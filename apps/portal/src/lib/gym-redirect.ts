/**
 * The gym desks moved from vendor.kriraghor.com to gym.kriraghor.com/manage on 25 Oct 2026 (M24 §4.3,
 * ADR-006 amendment). The proxy answers the old vendor URLs with a permanent (308) redirect, keeping
 * the query string. It runs at request time (not in next.config) because GYM_URL is runtime config
 * (ADR-003), and only on the vendor host (the admin host still 404s /vendor).
 *
 * | vendor.kriraghor.com           | gym.kriraghor.com        |
 * |--------------------------------|--------------------------|
 * | /vendor/gyms                   | /manage                  |
 * | /vendor/gyms/:id               | /manage/:id/edit         |
 * | /vendor/gyms/:id/desk          | /manage/:id/desk         |
 * | /vendor/gyms/:id/passes        | /manage/:id/passes       |
 * | /vendor/gyms/:id/…             | /manage/:id/…            |
 *
 * The shared business pages stay on vendor: /vendor/team, /vendor/reviews, /vendor/payouts,
 * /vendor/analytics (and the admin gym desks on admin.kriraghor.com).
 */
export function gymRedirect(pathname: string, search: string, gymUrl: string): string | null {
  const m = /^\/vendor\/gyms(?:\/([^/]+)(\/.*)?)?\/?$/.exec(pathname);
  if (!m) return null;
  const gym = gymUrl.replace(/\/+$/, "");
  const [, id, rest] = m;
  const tail = (rest ?? "").replace(/\/+$/, "");
  const path = !id ? "/manage" : tail ? `/manage/${id}${tail}` : `/manage/${id}/edit`;
  const q = search.startsWith("?") ? search.slice(1) : search;
  return `${gym}${path}${q ? `?${q}` : ""}`;
}
