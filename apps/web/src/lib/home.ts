/**
 * Home page helpers. Pure, so they are unit-tested; the components only fetch and render.
 * Times are Dhaka (UTC+6, no daylight saving).
 */
import { esportsHref, gymHref } from "./links";

const DHAKA_MS = 6 * 3600 * 1000;

/** The Dhaka calendar date (YYYY-MM-DD) of an instant. */
export const dhakaDateOf = (iso: string | number | Date) => new Date(new Date(iso).getTime() + DHAKA_MS).toISOString().slice(0, 10);

/** "01:42:09" until the start, "2d 03:10" when more than a day away, null once it has started. */
export function countdown(startsAt: string, now: number): string | null {
  const left = Date.parse(startsAt) - now;
  if (!Number.isFinite(left) || left <= 0) return null;
  const s = Math.floor(left / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${two(h)}:${two(m)}` : `${two(h)}:${two(m)}:${two(sec)}`;
}

// ---------------- the six sections ----------------

/** The home sections, in page order; also the groups on /search. */
export const SECTIONS = ["esports", "gym", "venues", "shop", "hire", "events"] as const;
export type SectionKey = (typeof SECTIONS)[number];

/** The shortest text the list APIs accept, and the longest. */
const MIN_SEARCH = 2;
const MAX_SEARCH = 60;

/** The text to search for, or "" when it is too short for the APIs. */
export const searchText = (q: string | null | undefined) => {
  const text = (q ?? "").trim();
  return text.length >= MIN_SEARCH ? text.slice(0, MAX_SEARCH) : "";
};

/** Each section's list page, and the URL name of the filter its dropdown sets. */
const PAGES: Record<SectionKey, { page: (query: string) => string; filter: string }> = {
  esports: { page: (s) => esportsHref(`/events${s}`), filter: "game" },
  gym: { page: (s) => gymHref(`/gyms${s}`), filter: "areaId" },
  venues: { page: (s) => `/venues${s}`, filter: "sport" },
  shop: { page: (s) => `/shop${s}`, filter: "category" },
  hire: { page: (s) => `/hiring${s}`, filter: "category" },
  events: { page: (s) => `/events${s}`, filter: "sport" },
};

/** Where a section's search goes: its list page with the text and the dropdown's choice in the URL. */
export function sectionUrl(section: SectionKey, { q, filter }: { q?: string; filter?: string } = {}): string {
  const { page, filter: name } = PAGES[section];
  const p = new URLSearchParams();
  const text = searchText(q);
  if (text) p.set("q", text);
  if (filter) p.set(name, filter);
  const s = p.toString();
  return page(s ? `?${s}` : "");
}

/** The /search groups for a text: nothing until it is long enough to search. */
export const searchGroups = (q: string | null | undefined) => {
  const text = searchText(q);
  return text ? SECTIONS.map((key) => ({ key, text, href: sectionUrl(key, { q: text }) })) : [];
};

// ---------------- the finder ----------------

// "tournaments" is esports (esports.kriraghor.com); "events" is sports tournaments (M14, /events here; 19 Nov 2026).
export type FinderTab = "tournaments" | "events" | "grounds" | "shop" | "hire";
export type FinderValues = { game?: string; sport?: string; areaId?: string; q?: string; category?: string };

/** Where a finder search goes: only filters the destination page really supports are sent. */
export function finderUrl(tab: FinderTab, v: FinderValues): string {
  const qs = (entries: [string, string | undefined][]) => {
    const p = new URLSearchParams();
    for (const [k, val] of entries) if (val && val.trim()) p.set(k, val.trim());
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  switch (tab) {
    case "tournaments":
      return esportsHref(`/events${qs([["game", v.game]])}`);
    case "events":
      return `/events${qs([["sport", v.sport], ["q", v.q]])}`;
    case "grounds":
      return `/venues${qs([["sport", v.sport], ["area", v.areaId]])}`;
    case "shop":
      return `/shop${qs([["q", v.q]])}`;
    case "hire":
      return `/hiring${qs([["category", v.category], ["areaId", v.areaId]])}`;
  }
}

/** Roving tabindex for the finder tabs: arrows wrap, Home and End jump. Returns the next index or null. */
export function nextTab(current: number, key: string, count: number): number | null {
  if (key === "ArrowRight" || key === "ArrowDown") return (current + 1) % count;
  if (key === "ArrowLeft" || key === "ArrowUp") return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

// ---------------- the hero's next event ----------------

/** Share of places taken, 0–1, for the progress bar. */
export const filled = (taken: number, max: number) => (max > 0 ? Math.min(1, Math.max(0, taken / max)) : 0);

/** The top three places of a prize table, in place order. */
export const podium = (prizes: { place: number; amount: { amount: number } }[] | null | undefined) =>
  [...(prizes ?? [])].sort((a, b) => a.place - b.place).slice(0, 3);
