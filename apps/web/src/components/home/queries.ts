"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@kriraghor/api-client";

/** Shapes of the public reads used on the home page and /search (fields the backend guarantees). */
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
export type BigEvent = { id: string; slug: string; titleEn: string; titleBn: string; phase: string; prizeTotal: Money; accentHex: string };

const read = async <T,>(p: Promise<{ data?: unknown; error?: unknown }>) => {
  const r = await p;
  if (r.error || !r.data) throw r.error ?? new Error("unavailable");
  return r.data as T;
};

/** Esports events open for registration, soonest first (the hero's count and next event, and the rail). */
export const useOpenEsports = () =>
  useQuery({
    queryKey: ["home-esports-open"],
    queryFn: () => read<{ items: EsportsCard[]; nextCursor: string | null }>(api().GET("/esports/tournaments", { params: { query: { status: "registration_open", limit: 12 } } })),
  });

export const useFeaturedEvents = () =>
  useQuery({ queryKey: ["home-esports-events"], queryFn: () => read<{ items: BigEvent[] }>(api().GET("/esports/events", { params: { query: { featured: "true", limit: 3 } } })) });

/** The Bangla or English name of a catalogue item. */
export const nameOf = (n: { nameEn?: string | null; nameBn?: string | null } | null | undefined, locale: string) => (n ? (locale === "bn" ? n.nameBn || n.nameEn : n.nameEn || n.nameBn) || "" : "");
