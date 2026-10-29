/**
 * The gym pages moved to gym.kriraghor.com on 25 Oct 2026 (M24 §4.3, ADR-006 amendment). The proxy
 * answers the old kriraghor.com URLs with a permanent (308) redirect, keeping the query string, so
 * shared links, bookmarks and old notifications still land on the right page. It runs at request time
 * (not in next.config) because GYM_URL is runtime config (ADR-003).
 *
 * | kriraghor.com                          | goes to                                   |
 * |----------------------------------------|-------------------------------------------|
 * | /gym, /gym?tab=gyms                    | gym: /gyms (tab dropped)                  |
 * | /gym?tab=trainers                      | gym: /trainers (tab dropped; M24 prompt 3) |
 * | /gym?tab=gear                          | kriraghor.com /shop?category=gym          |
 * | /gym/gyms/:slug                        | gym: /gyms/:slug                          |
 * | /gym/… (anything else under /gym)      | gym: /gyms                                |
 * | /me/passes, /me/passes/:code           | gym: the same path                        |
 * | /me/subscriptions, /me/subscriptions/:id | gym: the same path                      |
 *
 * Trainers' own pages (/pro/plans, /pro/subscriptions, /hiring/:slug) stay on kriraghor.com.
 */

const query = (params: URLSearchParams) => {
  const q = params.toString();
  return q ? `?${q}` : "";
};

/**
 * Where an old gym URL goes: an absolute gym.kriraghor.com URL, a path on kriraghor.com (the gear tab,
 * a same-site redirect), or null when the path is not an old gym page.
 */
export function gymRedirect(pathname: string, search: string, gymUrl: string): string | null {
  const gym = gymUrl.replace(/\/+$/, "");
  const params = new URLSearchParams(search);
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (path === "/gym") {
    const tab = params.get("tab");
    if (tab === "gear") {
      params.delete("tab");
      params.set("category", "gym");
      return `/shop${query(params)}`;
    }
    if (tab === "trainers") {
      params.delete("tab");
      return `${gym}/trainers${query(params)}`;
    }
    if (tab === "gyms") params.delete("tab");
    return `${gym}/gyms${query(params)}`;
  }
  const detail = /^\/gym\/gyms\/([^/]+)$/.exec(path);
  if (detail) return `${gym}/gyms/${detail[1]}${query(params)}`;
  if (path.startsWith("/gym/")) return `${gym}/gyms${query(params)}`;
  if (/^\/me\/(passes|subscriptions)(\/[^/]+)?$/.test(path)) return `${gym}${path}${query(params)}`;
  return null;
}
