import { api, problemOf } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";

/**
 * The pro's availability calendar (M11 §4 Manage › Availability, §7, FR-05, FR-14; Round B1):
 * a 7-day × 24-hour grid on the Dhaka clock. Each cell is one hour; cell i of a week is the hour that
 * starts i hours after 00:00 Dhaka on the week's first day (Dhaka has no daylight saving, so cells map
 * to time linearly). Pure helpers, unit-tested: the grid from GET /pro/availability, toggling, and the
 * week's save (PUT /pro/availability/blocks) as a diff that keeps untouched blocks exactly as stored.
 */
export type Calendar = components["schemas"]["HireAvailability"];
export type Block = { id?: string; start: string; end: string; reason: string | null };
export type Repeat = Calendar["repeats"][number];
export type RuleBody = { weekdays: number[]; from: string; to: string; until?: string; reason?: string };
export type BlockBody = { start: string; end: string; reason?: string };
export type SaveBody = { from: string; to: string; blocks: BlockBody[]; repeats?: RuleBody[] };

/** Why a cell can't be changed here, in the order a later reason wins. */
export type Lock = "horizon" | "past" | "outside" | "repeat" | "booked";

export const HOUR_MS = 3600000;
const DAY_MS = 24 * HOUR_MS;
const DHAKA_MS = 6 * HOUR_MS;
export const HOURS = 24;
export const WEEK_DAYS = 7;

const ms = (d: string | number | Date) => new Date(d).getTime();
const iso = (n: number) => new Date(n).toISOString();

/** The Dhaka calendar day of an instant (YYYY-MM-DD). */
export const dhakaDayOf = (d: string | number | Date) => new Date(ms(d) + DHAKA_MS).toISOString().slice(0, 10);
/** 00:00 Dhaka of a YYYY-MM-DD, as epoch ms. */
export const dhakaMidnight = (day: string) => Date.parse(`${day}T00:00:00Z`) - DHAKA_MS;
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
/** 0 = Sunday … 6 = Saturday, on the Dhaka calendar (what the repeat rules use). */
export const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

/** The last week the horizon reaches: weeks run from today in steps of 7 days; the last day allowed is today + horizonDays. */
export const lastWeekIndex = (horizonDays: number) => Math.max(0, Math.floor(horizonDays / WEEK_DAYS));
/** The first Dhaka day of week `index` (week 0 starts today). */
export const weekFirstDay = (today: string, index: number) => addDays(today, index * WEEK_DAYS);

/** The read range of a week: [00:00 of its first day, 00:00 seven days on), ISO. */
export function weekRange(firstDay: string): { from: string; to: string } {
  const from = dhakaMidnight(firstDay);
  return { from: iso(from), to: iso(from + WEEK_DAYS * DAY_MS) };
}

export type Week = {
  firstDay: string;
  days: string[];
  /** [from, to) in epoch ms; `to` is clipped to the horizon. */
  from: number;
  to: number;
  cells: number;
  locks: (Lock | null)[];
  /** The booked job's code per cell (locked). */
  jobAt: (string | null)[];
  /** Cells covered by one-off blocks when loaded. */
  initial: Set<number>;
  /** One-off blocks inside the week (editable). */
  inWeek: Block[];
  /** One-off blocks that start in the week but end after it: kept as stored (the save range grows to hold them). */
  carried: Block[];
};

/** The cells of the week a span overlaps (clipped to the grid). */
export function cellsOf(span: { start: string | number; end: string | number }, from: number, cells: number): number[] {
  const a = Math.max(0, Math.floor((ms(span.start) - from) / HOUR_MS));
  const z = Math.min(cells, Math.ceil((ms(span.end) - from) / HOUR_MS));
  const out: number[] = [];
  for (let c = a; c < z; c += 1) out.push(c);
  return out;
}

/**
 * The grid of one week from GET /pro/availability: which cells are blocked (one-off blocks), and which
 * are locked (booked jobs, weekly repeats, blocks reaching outside the week, hours already past, days
 * beyond the horizon). `now` is epoch ms.
 */
export function buildWeek(firstDay: string, data: Pick<Calendar, "blocks" | "spans" | "booked" | "horizonEnd">, now: number): Week {
  const from = dhakaMidnight(firstDay);
  const end = from + WEEK_DAYS * DAY_MS;
  const cells = WEEK_DAYS * HOURS;
  const horizon = ms(data.horizonEnd);
  const locks: (Lock | null)[] = Array.from({ length: cells }, (_, c) => {
    const s = from + c * HOUR_MS;
    if (s >= horizon) return "horizon";
    if (s + HOUR_MS <= now) return "past";
    return null;
  });
  const jobAt: (string | null)[] = Array.from({ length: cells }, () => null);
  const lock = (span: { start: string; end: string }, why: Lock) => {
    for (const c of cellsOf(span, from, cells)) locks[c] = why;
  };
  const initial = new Set<number>();
  const inWeek: Block[] = [];
  const carried: Block[] = [];
  for (const b of data.blocks) {
    const block = { id: b.id, start: b.start, end: b.end, reason: b.reason ?? null };
    for (const c of cellsOf(b, from, cells)) initial.add(c);
    if (ms(b.start) >= from && ms(b.end) <= end) inWeek.push(block);
    else {
      lock(b, "outside");
      if (ms(b.start) >= from && ms(b.start) < end) carried.push(block);
    }
  }
  for (const s of data.spans) if (s.repeat) lock(s, "repeat");
  for (const j of data.booked) {
    lock(j, "booked");
    for (const c of cellsOf(j, from, cells)) jobAt[c] = j.code;
  }
  return { firstDay, days: Array.from({ length: WEEK_DAYS }, (_, i) => addDays(firstDay, i)), from, to: Math.min(end, horizon), cells, locks, jobAt, initial, inWeek, carried };
}

/** Turns one cell on or off (`on` given: paint that state). Locked cells never change. Returns the same set when nothing changed. */
export function toggleCell(selected: Set<number>, week: Pick<Week, "cells" | "locks">, cell: number, on?: boolean): Set<number> {
  if (cell < 0 || cell >= week.cells || week.locks[cell]) return selected;
  const want = on ?? !selected.has(cell);
  if (want === selected.has(cell)) return selected;
  const next = new Set(selected);
  if (want) next.add(cell);
  else next.delete(cell);
  return next;
}

/** Consecutive cells as [first, end) runs, never across midnight, and only while `keyOf` agrees. */
export function runsOf(cells: Iterable<number>, keyOf: (cell: number) => string = () => ""): [number, number][] {
  const out: [number, number][] = [];
  for (const c of [...new Set(cells)].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && last[1] === c && c % HOURS !== 0 && keyOf(c) === keyOf(last[0])) last[1] = c + 1;
    else out.push([c, c + 1]);
  }
  return out;
}

const hhmm = (hour: number) => (hour >= HOURS ? "24:00" : `${String(hour).padStart(2, "0")}:00`);

/** Runs as weekly rules: one rule per (from, to) with every weekday it falls on. A run to midnight ends at "24:00" (the next Dhaka midnight). */
export function rulesOf(runs: [number, number][], week: Pick<Week, "days">, extra: { until?: string | null; reason?: string }): RuleBody[] {
  const by = new Map<string, RuleBody>();
  for (const [a, z] of runs) {
    const day = Math.floor(a / HOURS);
    const from = hhmm(a - day * HOURS);
    const to = hhmm(z - day * HOURS);
    const k = `${from}|${to}`;
    const rule = by.get(k) ?? { weekdays: [], from, to, ...(extra.until ? { until: extra.until } : {}), ...(extra.reason ? { reason: extra.reason } : {}) };
    const wd = weekdayOf(week.days[day]);
    if (!rule.weekdays.includes(wd)) rule.weekdays.push(wd);
    by.set(k, rule);
  }
  return [...by.values()].map((r) => ({ ...r, weekdays: [...r.weekdays].sort((x, y) => x - y) }));
}

/** A stored repeat as the PUT sends it back (unchanged repeats keep their key on the server). */
export const ruleBody = (r: Pick<Repeat, "weekdays" | "from" | "to" | "until" | "reason">): RuleBody => ({
  weekdays: [...r.weekdays].sort((a, b) => a - b),
  from: r.from,
  to: r.to,
  ...(r.until ? { until: r.until } : {}),
  ...(r.reason ? { reason: r.reason } : {}),
});

const blockBody = (b: Pick<Block, "start" | "end" | "reason">): BlockBody => ({ start: iso(ms(b.start)), end: iso(ms(b.end)), ...(b.reason ? { reason: b.reason } : {}) });

export type SaveOptions = {
  /** The reason for the hours added now (optional, never shown to the public). */
  reason?: string;
  /** Save the hours added now as weekly repeats instead of one-off blocks. */
  repeat?: boolean;
  /** The last day the new repeats apply (YYYY-MM-DD); open without it. */
  until?: string | null;
  /** The stored repeats, and the ones to remove. */
  repeats?: Repeat[];
  removedRepeats?: ReadonlySet<string>;
  /** One-off blocks after the week that the grown range now covers (read before saving), kept as stored. */
  carry?: Block[];
};

export type SavePlan = { body: SaveBody; dirty: boolean; repeatsChanged: boolean };

/**
 * The week's save. One-off blocks still fully selected are sent as stored (their minutes and reason
 * kept); a block with any hour turned off is dropped and its remaining hours are sent as whole-hour
 * blocks with its reason; hours added now become blocks with the new reason, or weekly repeats when
 * `repeat` is on. `repeats` is sent only when the repeats changed (some removed or some added).
 */
export function planSave(week: Week, selected: ReadonlySet<number>, opts: SaveOptions = {}): SavePlan {
  const reasonAt = new Map<number, string>();
  const consumed = new Set<number>();
  const keep: Block[] = [];
  for (const b of week.inWeek) {
    const cs = cellsOf(b, week.from, week.cells);
    for (const c of cs) if (b.reason && !reasonAt.has(c)) reasonAt.set(c, b.reason);
    if (cs.every((c) => selected.has(c))) {
      keep.push(b);
      for (const c of cs) consumed.add(c);
    }
  }
  for (const b of week.carried) {
    keep.push(b);
    for (const c of cellsOf(b, week.from, week.cells)) consumed.add(c);
  }
  const reason = opts.reason?.trim() || undefined;
  // Hours of blocks that start before the week (locked "outside") stay with those blocks; nothing reaches past the horizon.
  const rest = [...selected].filter((c) => !consumed.has(c) && week.locks[c] !== "horizon" && week.locks[c] !== "outside");
  const added = rest.filter((c) => !week.initial.has(c));
  const oneOff = opts.repeat ? rest.filter((c) => week.initial.has(c)) : rest;
  const keyOf = (c: number) => (week.initial.has(c) ? `old:${reasonAt.get(c) ?? ""}` : `new:${reason ?? ""}`);
  const fresh = runsOf(oneOff, keyOf).map(([a, z]) => {
    const r = week.initial.has(a) ? reasonAt.get(a) : reason;
    return { start: iso(week.from + a * HOUR_MS), end: iso(week.from + z * HOUR_MS), ...(r ? { reason: r } : {}) };
  });
  const carry = opts.carry ?? [];
  const blocks = [...keep.map(blockBody), ...fresh, ...carry.map(blockBody)].sort((x, y) => ms(x.start) - ms(y.start));
  const to = Math.max(week.to, ...keep.map((b) => ms(b.end)), ...carry.map((b) => ms(b.end)));

  const stored = opts.repeats ?? [];
  const removed = stored.filter((r) => opts.removedRepeats?.has(r.id));
  const newRules = opts.repeat ? rulesOf(runsOf(added), week, { until: opts.until, reason }) : [];
  const repeatsChanged = removed.length > 0 || newRules.length > 0;
  const body: SaveBody = {
    from: iso(week.from),
    to: iso(to),
    blocks,
    ...(repeatsChanged ? { repeats: [...stored.filter((r) => !opts.removedRepeats?.has(r.id)).map(ruleBody), ...newRules] } : {}),
  };
  const same = selected.size === week.initial.size && [...selected].every((c) => week.initial.has(c));
  return { body, dirty: !same || repeatsChanged, repeatsChanged };
}

/** One-off blocks that start in [from, to) (ms): what a grown save range must carry over. */
export const startingIn = (blocks: Block[], from: number, to: number) => blocks.filter((b) => ms(b.start) >= from && ms(b.start) < to);

// ---------------- errors

export type SaveError = { key: "overJob"; jobs: string } | { key: "horizon" | "past" | "overlap" | "blocks" | "repeats" | "invalid" };

/** A failed save in plain words (keys under hire.cal.errors), or null to show the server's title. */
export function saveErrorOf(error: unknown): SaveError | null {
  const p = problemOf(error) as (ReturnType<typeof problemOf> & { jobs?: string[] }) | null;
  if (!p) return null;
  if (p.code === "BLOCK_OVER_JOB") return { key: "overJob", jobs: (p.jobs ?? []).join(", ") };
  if (p.code !== "VALIDATION_FAILED") return null;
  const first = p.errors?.[0];
  if (!first) return { key: "invalid" };
  if (first.field === "to") return { key: "horizon" };
  if (first.field === "from") return { key: "past" };
  if (first.field.startsWith("blocks")) return { key: /overlap/i.test(first.message) ? "overlap" : "blocks" };
  if (first.field.startsWith("repeats")) return { key: "repeats" };
  return { key: "invalid" };
}

// ---------------- the public busy strip (GET /hire/profiles/:slug busy, blocks and jobs merged)

/** A day's busy time in minutes after 00:00 Dhaka, clipped to the day and merged: [{ from, to }] with 0 ≤ from < to ≤ 1440. */
export function dayBusy(busy: { start: string; end: string }[], day: string): { from: number; to: number }[] {
  const start = dhakaMidnight(day);
  const parts = busy
    .map((b) => ({ from: Math.max(0, Math.round((ms(b.start) - start) / 60000)), to: Math.min(1440, Math.round((ms(b.end) - start) / 60000)) }))
    .filter((p) => p.from < p.to)
    .sort((a, b) => a.from - b.from);
  const out: { from: number; to: number }[] = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (last && p.from <= last.to) last.to = Math.max(last.to, p.to);
    else out.push({ ...p });
  }
  return out;
}

/** How much of a day is still open to hire: no busy time, some, or all 24 hours. */
export type DayState = "available" | "partly" | "unavailable";

/** A day's state from its merged busy minutes (dayBusy): all of 00:00 to 24:00 busy is unavailable. */
export function stateOfBusy(parts: { from: number; to: number }[]): DayState {
  if (!parts.length) return "available";
  return parts.length === 1 && parts[0].from <= 0 && parts[0].to >= 1440 ? "unavailable" : "partly";
}

/** A Dhaka day's state on the public profile (GET /hire/profiles/:slug busy, blocks and jobs merged). */
export const dayState = (busy: { start: string; end: string }[], day: string): DayState => stateOfBusy(dayBusy(busy, day));

/**
 * The same three words for the pro's own week grid: of the hours still to come (not past, not beyond
 * the horizon), none busy, some, or all. Null when no hour of the day is left to plan.
 */
export function stateOfHours(busy: boolean[]): DayState | null {
  if (!busy.length) return null;
  const n = busy.filter(Boolean).length;
  return n === 0 ? "available" : n === busy.length ? "unavailable" : "partly";
}

/** Minutes after midnight → "HH:MM" (1440 → "24:00"). */
export const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

// ---------------- API

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}

export const calendar = {
  read: async (from: string, to: string) => ok(await api().GET("/pro/availability", { params: { query: { from, to } } })),
  save: async (body: SaveBody) => ok(await api().PUT("/pro/availability/blocks", { body })),
};
