/**
 * M22 branded organiser sites: {sub}.esports.kriraghor.com (and .staging., .localhost) shows that
 * organisation's tournaments. Returns the subdomain for such a host, else null (the main esports site,
 * www, an IP or anything else).
 */
export function organiserOf(host: string | null | undefined): string | null {
  if (!host) return null;
  const labels = host.toLowerCase().split(":")[0].split(".");
  if (labels.length < 3 || labels[1] !== "esports") return null;
  const sub = labels[0];
  if (sub === "www" || !/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(sub)) return null;
  return sub;
}
