import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

/**
 * Public grounds (M09 read side): browse with filters and facet counts, and a ground's detail page.
 * Booking itself arrives with M10; the detail page shows prices and hours, and both v3 payment options.
 */
export type GroundCard = components["schemas"]["GroundCard"];
export type GroundList = components["schemas"]["GroundList"];
export type GroundDetail = components["schemas"]["GroundDetail"];
export type Filters = { sport?: string; areaId?: string; surface?: string[]; facilities?: string[]; indoor?: boolean; sort?: "cheapest" | "nearest" | "newest"; cursor?: string };

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}

export const grounds = {
  list: async (f: Filters) =>
    ok(
      await api().GET("/grounds", {
        params: {
          query: {
            ...(f.sport ? { sport: f.sport } : {}),
            ...(f.areaId ? { areaId: f.areaId } : {}),
            ...(f.surface?.length ? { surface: f.surface.join(",") as unknown as string[] } : {}),
            ...(f.facilities?.length ? { facilities: f.facilities.join(",") as unknown as string[] } : {}),
            ...(f.indoor !== undefined ? { indoor: String(f.indoor) as unknown as boolean } : {}),
            ...(f.sort ? { sort: f.sort } : {}),
            ...(f.cursor ? { cursor: f.cursor } : {}),
            limit: 12,
          },
        },
      })
    ),
  detail: async (slug: string) => ok(await api().GET("/grounds/{slug}", { params: { path: { slug } } })),
  areas: async () => ok(await api().GET("/catalog/areas", { params: { query: { service: "grounds" } } })),
};

/** Filters ↔ URL search params, so a filtered list can be shared and the back button works. */
export function filtersFromParams(p: URLSearchParams): Filters {
  const list = (k: string) => (p.get(k) ? p.get(k)!.split(",").filter(Boolean) : undefined);
  const sort = p.get("sort");
  return {
    sport: p.get("sport") ?? undefined,
    areaId: p.get("area") ?? undefined,
    surface: list("surface"),
    facilities: list("facilities"),
    indoor: p.get("indoor") === "true" ? true : p.get("indoor") === "false" ? false : undefined,
    sort: sort === "cheapest" || sort === "nearest" || sort === "newest" ? sort : undefined,
  };
}

export function paramsFromFilters(f: Filters): string {
  const p = new URLSearchParams();
  if (f.sport) p.set("sport", f.sport);
  if (f.areaId) p.set("area", f.areaId);
  if (f.surface?.length) p.set("surface", f.surface.join(","));
  if (f.facilities?.length) p.set("facilities", f.facilities.join(","));
  if (f.indoor !== undefined) p.set("indoor", String(f.indoor));
  if (f.sort) p.set("sort", f.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** "6am", "12pm", "5pm" from an hour. */
export const hourLabel = (h: number) => (h === 0 ? "12am" : h === 12 ? "12pm" : h > 12 ? `${h - 12}pm` : `${h}am`);

/** Opening hours as compact lines: consecutive days with the same hours share a line. */
export function hoursLines(hours: { dow: number; isClosed: boolean; openTime: string | null; closeTime: string | null }[], dayNames: string[], closedLabel: string): string[] {
  const text = (h: (typeof hours)[number]) => (h.isClosed ? closedLabel : `${h.openTime}–${h.closeTime}`);
  const order = [6, 0, 1, 2, 3, 4, 5]; // Saturday first, as the week runs in Bangladesh
  const rows = order.map((d) => hours.find((h) => h.dow === d)).filter(Boolean) as typeof hours;
  const out: string[] = [];
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (j + 1 < rows.length && text(rows[j + 1]) === text(rows[i])) j += 1;
    out.push(`${dayNames[rows[i].dow]}${j > i ? `–${dayNames[rows[j].dow]}` : ""}: ${text(rows[i])}`);
    i = j + 1;
  }
  return out;
}
