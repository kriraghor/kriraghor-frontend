"use client";

import { api } from "@kriraghor/api-client";
import { grounds } from "@/lib/grounds";
import { hire } from "@/lib/hire";
import { market, type MarketCard } from "@/lib/market";
import { tournaments, type Card as EventCard } from "@/lib/tournaments";
import type { SectionKey } from "@/lib/home";
import type { GymCard, HireCard, VenueCard } from "./SectionCards";
import type { EsportsCard, Named } from "./queries";

/** The most cards a home rail or a /search group shows. */
export const RAIL_MAX = 9;
export const SEARCH_MAX = 6;

const items = async <T,>(p: Promise<{ data?: unknown; error?: unknown }>) => {
  const r = await p;
  if (r.error || !r.data) throw r.error ?? new Error("unavailable");
  return (r.data as { items: T[] }).items;
};

export type SectionItems = { esports: EsportsCard; gym: GymCard; venues: VenueCard; shop: MarketCard; hire: HireCard; events: EventCard };

/** Each section's public list, searched by text when `q` is set (the home rails use it without). */
export const sectionItems: { [K in SectionKey]: (q?: string) => Promise<SectionItems[K][]> } = {
  esports: (q) => items<EsportsCard>(api().GET("/esports/tournaments", { params: { query: q ? { q, limit: SEARCH_MAX } : { status: "registration_open", limit: RAIL_MAX } } })),
  gym: (q) => items<GymCard>(api().GET("/gym/gyms", { params: { query: { sort: "rating", limit: RAIL_MAX, ...(q ? { q } : {}) } as never } })),
  venues: async (q) => (await grounds.list({ sort: "cheapest", ...(q ? { q } : {}) })).items as unknown as VenueCard[],
  shop: async (q) => (await market.list(q ? { q } : {})).items,
  hire: async (q) => (await hire.list(q ? { q } : {})).items as unknown as HireCard[],
  events: async (q) => (await tournaments.list({ status: "open", ...(q ? { q } : {}) })).items,
};

const named = async (p: Promise<Named[]>, value: "key" | "id") => (await p).map((x) => ({ value: (x as Record<string, string>)[value], nameEn: x.nameEn, nameBn: x.nameBn }));

/** The choices of each section's dropdown: only filters its list page really supports. */
export const sectionFilters: Record<SectionKey, () => Promise<{ value: string; nameEn: string; nameBn: string }[]>> = {
  esports: () => named(items<Named>(api().GET("/esports/games")), "key"),
  gym: () => named(items<Named>(api().GET("/catalog/areas", { params: { query: { service: "delivery" } } })), "id"),
  venues: () => named(items<Named>(api().GET("/catalog/sports")), "key"),
  shop: () => named(market.categories().then((c) => c.items as unknown as Named[]), "key"),
  hire: () => named(items<Named>(api().GET("/hire/taxonomy")), "key"),
  events: () => named(items<Named>(api().GET("/catalog/sports")), "key"),
};
