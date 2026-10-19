"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

/** Shapes of the public esports reads used on the home page (fields the backend guarantees). */
export type Named = { key: string; nameEn: string; nameBn: string };
export type Money = { amount: number };
export type EsportsCard = {
  id: string;
  slug: string;
  titleEn: string;
  titleBn: string;
  game: Named | null;
  mode: Named | null;
  entryUnit: "player" | "squad";
  entryFee: Money;
  prizePool: Money;
  killReward: Money | null;
  maxSlots: number;
  slotsTaken: number;
  startsAt: string;
};
export type EsportsDetail = EsportsCard & { prizes: { place: number; amount: Money }[]; matches: { seq: number; map: Named | null }[] };
export type TopPlayer = { rank: number; username: string | null; displayName: string | null; game: { nameEn: string | null; nameBn?: string | null } | null; points: number; wins?: number; kills?: number; team?: string | null };
export type BigEvent = { id: string; slug: string; titleEn: string; titleBn: string; phase: string; prizeTotal: Money; accentHex: string };

const read = async <T,>(p: Promise<{ data?: unknown; error?: unknown }>) => {
  const r = await p;
  if (r.error || !r.data) throw r.error ?? new Error("unavailable");
  return r.data as T;
};

/** Tournaments open for registration, soonest first (shared by the hero, the count and the rail). */
export const useOpenEsports = (game = "") =>
  useQuery({
    queryKey: ["home-esports-open", game],
    queryFn: () => read<{ items: EsportsCard[]; nextCursor: string | null }>(api().GET("/esports/tournaments", { params: { query: { status: "registration_open", limit: 12, ...(game ? { game } : {}) } } })),
  });

export const useEsportsDetail = (slug: string | undefined) =>
  useQuery({
    queryKey: ["home-esports-detail", slug],
    enabled: Boolean(slug),
    queryFn: () => read<EsportsDetail>(api().GET("/esports/tournaments/{id}", { params: { path: { id: slug! } } })),
  });

export const useEsportsGames = () =>
  useQuery({ queryKey: ["home-esports-games"], staleTime: 3600_000, queryFn: () => read<{ items: Named[] }>(api().GET("/esports/games")) });

export const useTopPlayers = () => useQuery({ queryKey: ["home-esports-top"], queryFn: () => read<{ items: TopPlayer[] }>(api().GET("/esports/top-players")) });

export const useFeaturedEvents = () =>
  useQuery({ queryKey: ["home-esports-events"], queryFn: () => read<{ items: BigEvent[] }>(api().GET("/esports/events", { params: { query: { featured: "true", limit: 3 } } })) });

/** The Bangla or English name of a catalogue item. */
export const nameOf = (n: { nameEn?: string | null; nameBn?: string | null } | null | undefined, locale: string) => (n ? (locale === "bn" ? n.nameBn || n.nameEn : n.nameEn || n.nameBn) || "" : "");
