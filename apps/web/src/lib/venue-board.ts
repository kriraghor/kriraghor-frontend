import type { Availability } from "./bookings";

/**
 * The /venues slot board (Claude Design "Grounds" page, M10 FR-01): a venue's day as whole hours,
 * pooled over its courts, and the hours a visitor taps to build one booking. The booking page's
 * quote stays the price of record; the board only estimates.
 */

export type TimeOfDay = "all" | "morning" | "afternoon" | "evening";
export const TIMES_OF_DAY: TimeOfDay[] = ["all", "morning", "afternoon", "evening"];
const RANGE: Record<TimeOfDay, [number, number]> = { all: [0, 24], morning: [5, 12], afternoon: [12, 17], evening: [17, 24] };

export type HourState = "open" | "booked" | "yours" | "past" | "closed";
export type HourSlot = {
  hour: number;
  /** ISO start of the hour (its :00 half-hour). */
  start: string;
  state: HourState;
  /** Courts with both halves of this hour open. */
  openCourts: string[];
  /** The cheapest open court's hourly rate (poisha), else the first rate seen. */
  rate: number | null;
};

/**
 * Whole hours from the half-hour grid. An hour is open when at least one court has both of its
 * halves open; "yours" wins over everything (the visitor's own booking); otherwise booked beats past
 * beats closed, so a fully taken hour reads as booked.
 */
export function hourSlots(a: Availability | undefined, tod: TimeOfDay = "all"): HourSlot[] {
  if (!a) return [];
  const [from, to] = RANGE[tod];
  const byHour = new Map<number, HourSlot>();
  for (const court of a.courts) {
    const cells = court.cells;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const [h, m] = c.time.split(":").map(Number);
      if (m !== 0 || h < from || h >= to) continue;
      const next = cells[i + 1];
      const halfOpen = c.state === "open" && next?.state === "open" && next.time === `${String(h).padStart(2, "0")}:30`;
      const slot = byHour.get(h) ?? { hour: h, start: c.start, state: "closed" as HourState, openCourts: [], rate: null };
      if (halfOpen) {
        slot.openCourts.push(court.id);
        if (c.rate !== null && (slot.rate === null || c.rate < slot.rate || slot.state !== "open")) slot.rate = c.rate;
        if (slot.state !== "yours") slot.state = "open";
      } else if (slot.state !== "open" && slot.state !== "yours") {
        const s = c.state === "yours" || next?.state === "yours" ? "yours" : c.state === "booked" || next?.state === "booked" ? "booked" : c.state === "past" ? "past" : "closed";
        if (s === "yours" || rank(s) > rank(slot.state)) slot.state = s;
        if (slot.rate === null) slot.rate = c.rate;
      }
      byHour.set(h, slot);
    }
  }
  return [...byHour.values()].sort((x, y) => x.hour - y.hour);
}
const rank = (s: HourState) => ({ closed: 0, past: 1, booked: 2, open: 3, yours: 4 })[s];

export type Pick = { groundId: string; hours: number[] };

/**
 * Tapping an open hour builds one booking: the first tap starts it, a tap next to either end grows
 * it, a tap on an end shrinks it, anything else starts again there. It never spans a gap or an hour
 * no single court has open throughout (one booking is one court).
 */
export function toggleHour(pick: Pick | null, groundId: string, hour: number, slots: HourSlot[]): Pick | null {
  const at = new Map(slots.map((s) => [s.hour, s]));
  if (at.get(hour)?.state !== "open") return pick;
  if (!pick || pick.groundId !== groundId || !pick.hours.length) return { groundId, hours: [hour] };
  const lo = Math.min(...pick.hours), hi = Math.max(...pick.hours);
  if (hour === lo || hour === hi) {
    const rest = pick.hours.filter((h) => h !== hour);
    return rest.length ? { groundId, hours: rest } : null;
  }
  if (hour === lo - 1 || hour === hi + 1) {
    const hours = [...pick.hours, hour].sort((a, b) => a - b);
    return courtFor(hours, slots) ? { groundId, hours } : { groundId, hours: [hour] };
  }
  return { groundId, hours: [hour] };
}

/** A court open for every picked hour (the cheapest first), or null. */
export function courtFor(hours: number[], slots: HourSlot[]): string | null {
  const at = new Map(slots.map((s) => [s.hour, s]));
  const sets = hours.map((h) => new Set(at.get(h)?.openCourts ?? []));
  const first = [...(sets[0] ?? [])];
  return first.find((c) => sets.every((s) => s.has(c))) ?? null;
}

/** The estimate for the picked hours: the hourly rates added up (poisha). */
export function estimate(hours: number[], slots: HourSlot[]): number {
  const at = new Map(slots.map((s) => [s.hour, s]));
  return hours.reduce((sum, h) => sum + (at.get(h)?.rate ?? 0), 0);
}

/** Where "Continue" goes: the venue page with the court, start and length already chosen. */
export function pickHref(slug: string, pick: Pick, slots: HourSlot[]): string | null {
  const court = courtFor(pick.hours, slots);
  const first = slots.find((s) => s.hour === Math.min(...pick.hours));
  if (!court || !first) return null;
  const q = new URLSearchParams({ court, at: first.start, len: String(pick.hours.length * 60) });
  return `/venues/${slug}?${q.toString()}`;
}

/** Price bands of the filter, in poisha (৳1,500 = 150000). */
export const PRICE_BANDS = { lt1500: [null, 150000], "1500-3000": [150000, 300000], gt3000: [300000, null] } as const;
export type PriceBand = keyof typeof PRICE_BANDS;
export const DISTANCES = [3, 5, 10] as const;
