"use client";

import { api } from "@kriraghor/api-client";
import { grounds } from "@/lib/grounds";
import { hire } from "@/lib/hire";
import { market, type MarketCard } from "@/lib/market";
import { tournamentPosts, type PostCard } from "@/lib/tournament-posts";
import type { SectionKey } from "@/lib/home";
import type { GymCard, HireCard, VenueCard } from "./SectionCards";
import type { EsportsCard } from "./queries";

/** The most cards a home rail or a /search group shows. */
export const RAIL_MAX = 9;
export const SEARCH_MAX = 6;

const items = async <T,>(p: Promise<{ data?: unknown; error?: unknown }>) => {
  const r = await p;
  if (r.error || !r.data) throw r.error ?? new Error("unavailable");
  return (r.data as { items: T[] }).items;
};

export type SectionItems = { esports: EsportsCard; gym: GymCard; venues: VenueCard; shop: MarketCard; hire: HireCard; tournaments: PostCard };

/** Each section's public list, searched by text when `q` is set (the home rails use it without). */
export const sectionItems: { [K in SectionKey]: (q?: string) => Promise<SectionItems[K][]> } = {
  esports: (q) => items<EsportsCard>(api().GET("/esports/tournaments", { params: { query: q ? { q, limit: SEARCH_MAX } : { status: "registration_open", limit: RAIL_MAX } } })),
  gym: (q) => items<GymCard>(api().GET("/gym/gyms", { params: { query: { sort: "rating", limit: RAIL_MAX, ...(q ? { q } : {}) } as never } })),
  venues: async (q) => (await grounds.list({ sort: "cheapest", ...(q ? { q } : {}) })).items as unknown as VenueCard[],
  shop: async (q) => (await market.list(q ? { q } : {})).items,
  hire: async (q) => (await hire.list(q ? { q } : {})).items as unknown as HireCard[],
  tournaments: async (q) => (await tournamentPosts.feed(q ? { q } : {})).items.slice(0, RAIL_MAX),
};
