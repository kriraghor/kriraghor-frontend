/**
 * Home page helpers (home-v3, launch polish). Pure, so they are unit-tested; the components only
 * fetch and render. Times are Dhaka (UTC+6, no daylight saving).
 */
import { esportsHref } from "./links";

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

// ---------------- the finder ----------------

export type FinderTab = "tournaments" | "grounds" | "shop" | "hire";
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
      return esportsHref(`/tournaments${qs([["game", v.game]])}`);
    case "grounds":
      return `/grounds${qs([["sport", v.sport], ["areaId", v.areaId]])}`;
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

// ---------------- grounds: tonight's free hours ----------------

type Cell = { start: string; time: string; state: string };
type Availability = { courts: { id: string; cells: Cell[] }[] };
export type FreeSlot = { courtId: string; start: string; time: string };

/**
 * Up to `max` bookable hours from `from` (HH:MM) on: an hour needs two open half-hour cells in a row
 * on one court. One slot per start time (the first court that has it), in time order.
 */
export function freeHours(a: Availability | null | undefined, { from = "17:00", max = 3 } = {}): FreeSlot[] {
  const byTime = new Map<string, FreeSlot>();
  for (const court of a?.courts ?? []) {
    court.cells.forEach((c, i) => {
      if (!c.time.endsWith(":00") || c.time < from || c.state !== "open") return;
      if (court.cells[i + 1]?.state !== "open") return;
      if (!byTime.has(c.time)) byTime.set(c.time, { courtId: court.id, start: c.start, time: c.time });
    });
  }
  return [...byTime.values()].sort((x, y) => x.time.localeCompare(y.time)).slice(0, max);
}

/** "6 pm", "৬টা" style hour label for a 24 h HH:MM time. */
export function hourOf(time: string, locale: string) {
  const h = Number(time.slice(0, 2));
  const m = time.slice(3, 5);
  if (locale === "bn") {
    const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
    const h12 = h % 12 || 12;
    return m === "00" ? `${bn(h12)}টা` : `${bn(h12)}:${bn(m)}`;
  }
  const h12 = h % 12 || 12;
  return `${h12}${m === "00" ? "" : `:${m}`} ${h < 12 ? "am" : "pm"}`;
}

/** The booking link for a picked hour: the widget on the ground page pre-selects it. */
export const bookingHref = (slug: string, slot: FreeSlot) => `/grounds/${slug}?${new URLSearchParams({ court: slot.courtId, at: slot.start }).toString()}`;

// ---------------- small formatting ----------------

/** Two initials for an avatar tile (no stock photos): "Kamrul Islam" → "KI". */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = Array.from(parts[0])[0] ?? "";
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Share of places taken, 0–1, for the progress bar. */
export const filled = (taken: number, max: number) => (max > 0 ? Math.min(1, Math.max(0, taken / max)) : 0);

/** The top three places of a prize table, in place order. */
export const podium = (prizes: { place: number; amount: { amount: number } }[] | null | undefined) =>
  [...(prizes ?? [])].sort((a, b) => a.place - b.place).slice(0, 3);
