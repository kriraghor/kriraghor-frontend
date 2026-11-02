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
