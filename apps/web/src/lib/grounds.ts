import { api } from "@kriraghor/api-client";
import { DISTANCES, PRICE_BANDS, TIMES_OF_DAY, type PriceBand, type TimeOfDay } from "./venue-board";
import type { components } from "@kriraghor/api-client/schema";

/**
 * Public grounds (M09 read side): browse with filters and facet counts, and a ground's detail page.
 * The detail page shows prices and hours and books a slot (M10); cards show the free hours left today.
 */
export type GroundCard = components["schemas"]["GroundCard"];
export type GroundList = components["schemas"]["GroundList"];
export type GroundDetail = components["schemas"]["GroundDetail"];
export type Filters = {
  sport?: string;
  areaId?: string;
  surface?: string[];
  facilities?: string[];
  indoor?: boolean;
  sort?: "cheapest" | "nearest" | "newest" | "most_open";
  cursor?: string;
  /** The /venues page (Claude Design "Grounds"): price band, distance, its origin, day, time of day, view. */
  price?: PriceBand;
  km?: number;
  /** "Distance from" this area (an id); a visitor's own location never goes in the URL. */
  near?: string;
  date?: string;
  time?: TimeOfDay;
  view?: "board" | "cards";
};
/** Where distance is measured from: an area's centre or the visitor's location (kept in the page). */
export type Origin = { lat: number; lng: number } | null;

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}

export const grounds = {
  list: async (f: Filters, origin: Origin = null) =>
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
            ...(f.price && PRICE_BANDS[f.price][0] !== null ? { priceMin: PRICE_BANDS[f.price][0] } : {}),
            ...(f.price && PRICE_BANDS[f.price][1] !== null ? { priceMax: PRICE_BANDS[f.price][1] } : {}),
            ...(origin ? { lat: origin.lat, lng: origin.lng } : {}),
            ...(origin && f.km ? { radiusKm: f.km } : {}),
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
    sort: sort === "cheapest" || sort === "nearest" || sort === "newest" || sort === "most_open" ? sort : undefined,
    price: (Object.keys(PRICE_BANDS) as PriceBand[]).find((b) => b === p.get("price")),
    km: DISTANCES.find((d) => String(d) === p.get("km")),
    near: p.get("near") ?? undefined,
    date: /^\d{4}-\d{2}-\d{2}$/.test(p.get("date") ?? "") ? p.get("date")! : undefined,
    time: TIMES_OF_DAY.find((x) => x !== "all" && x === p.get("time")),
    view: p.get("view") === "cards" ? "cards" : p.get("view") === "board" ? "board" : undefined,
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
  if (f.price) p.set("price", f.price);
  if (f.km) p.set("km", String(f.km));
  if (f.near) p.set("near", f.near);
  if (f.date) p.set("date", f.date);
  if (f.time && f.time !== "all") p.set("time", f.time);
  if (f.view) p.set("view", f.view);
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
