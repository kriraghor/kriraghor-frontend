import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { formatTaka, unwrap } from "./admin/finance";

/**
 * M19 dashboards on the portal: the ground owner's Overview and Analytics (vendor host, customer
 * session) and the platform overview (admin host, staff session: master or view_analytics).
 */
export type Period = "7w" | "qtr" | "yr";
export type OwnerDashboard = components["schemas"]["OwnerDashboard"];
export type PlatformOverview = components["schemas"]["PlatformOverview"];
export type Actions = components["schemas"]["PendingActions"];
export type Tile = components["schemas"]["KpiTile"];

export const dashboards = {
  owner: async (period: Period) => unwrap(await api().GET("/me/dashboard", { params: { query: { role: "ground_owner", period } } })) as OwnerDashboard,
  ownerActions: async () => unwrap(await api().GET("/me/dashboard/actions", { params: { query: { role: "ground_owner" } } })),
  platform: async (period: Period) => unwrap(await api("admin").GET("/admin/analytics/overview", { params: { query: { period } } })),
  staffActions: async () => unwrap(await api("admin").GET("/admin/analytics/actions")),
};

/** Fetch a CSV through the API (with the session) and save it. */
export async function downloadCsv(audience: "api" | "admin", path: "/me/dashboard/export" | "/admin/analytics/export", query: Record<string, string>) {
  const client = api(audience) as unknown as { GET: (p: string, o: unknown) => Promise<{ data?: Blob; error?: unknown; response: Response }> };
  const { data, error, response } = await client.GET(path, { params: { query }, parseAs: "blob" });
  if (error || !data) throw error ?? new Error("export failed");
  const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "kriraghor.csv";
  const url = URL.createObjectURL(data);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------- pure helpers (tested)

const BN = "০১২৩৪৫৬৭৮৯";
const bn = (s: string) => s.replace(/\d/g, (d) => BN[Number(d)]);

/** FR-07: "৳4.3 lakh" from ৳1 lakh up, otherwise the full taka figure. */
export function compactTaka(poisha: number | null | undefined, locale = "en"): string {
  if (poisha === null || poisha === undefined) return "–";
  const taka = poisha / 100;
  if (Math.abs(taka) >= 1e7) {
    const s = `৳${(taka / 1e7).toFixed(1).replace(/\.0$/, "")} ${locale === "bn" ? "কোটি" : "crore"}`;
    return locale === "bn" ? bn(s) : s;
  }
  if (Math.abs(taka) >= 1e5) {
    const s = `৳${(taka / 1e5).toFixed(1).replace(/\.0$/, "")} ${locale === "bn" ? "লাখ" : "lakh"}`;
    return locale === "bn" ? bn(s) : s;
  }
  return formatTaka(poisha, locale);
}

/** A rate (0.382) as "38%" (one decimal under 10%). */
export function pct(rate: number | null | undefined, locale = "en"): string {
  if (rate === null || rate === undefined) return "–";
  const v = rate * 100;
  const s = `${v < 10 ? v.toFixed(1).replace(/\.0$/, "") : Math.round(v)}%`;
  return locale === "bn" ? bn(s) : s;
}

/** A bucket key as a short label: weeks "12 Oct", months "Oct 26". */
export function bucketLabel(key: string, locale = "en"): string {
  const month = key.length === 7;
  const d = new Date(`${month ? `${key}-01` : key}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", month ? { month: "short", year: "2-digit", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" }).format(d);
}

/** An hour of the day as "6 pm". */
export function hourLabel(h: number, locale = "en"): string {
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { hour: "numeric", hour12: true, timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 1, h)));
}
