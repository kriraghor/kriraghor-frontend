/**
 * M22 branded organiser sites: {sub}.esports.kriraghor.com (and .staging., .localhost) used to show
 * that organisation's tournaments. Since 21 Oct 2026 esports is organised by Kriraghor only, so the
 * subdomains are switched off: the proxy no longer rewrites them and /o/{sub} answers 404. The code
 * stays behind ORGANISER_SUBDOMAINS_ENABLED for the later esports SaaS (contract based).
 */
export const ORGANISER_SUBDOMAINS_ENABLED = false;

/** The organiser subdomain of a host, else null (the main esports site, www, an IP or anything else). */
export function organiserOf(host: string | null | undefined): string | null {
  if (!host) return null;
  const labels = host.toLowerCase().split(":")[0].split(".");
  if (labels.length < 3 || labels[1] !== "esports") return null;
  const sub = labels[0];
  if (sub === "www" || !/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(sub)) return null;
  return sub;
}

/** Where the proxy rewrites a request: an organiser subdomain's home page → /o/{sub}, only while enabled. */
export function organiserRewrite(host: string | null | undefined, pathname: string, enabled = ORGANISER_SUBDOMAINS_ENABLED): string | null {
  if (!enabled || pathname !== "/") return null;
  const sub = organiserOf(host);
  return sub ? `/o/${sub}` : null;
}
