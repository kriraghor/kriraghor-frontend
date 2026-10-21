import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "../admin/finance";

/**
 * The owner's day (M10, vendor.kriraghor.com): the timeline of a ground, check-in (which releases
 * the online money, v3), no-show, extend, the venue balance, owner cancel, moves and walk-ins; and
 * M09 step 2 closures and weekly series. Staff list and platform cancel are in lib/admin.
 */
export type Timeline = components["schemas"]["BookingTimeline"];
export type OwnerBooking = components["schemas"]["OwnerBooking"];
export type OwnerBookingSearch = components["schemas"]["OwnerBookingSearch"];
export type Closure = components["schemas"]["Closure"];
export type Series = components["schemas"]["BookingSeries"];
export type SeriesPreview = components["schemas"]["SeriesPreview"];
export type OwnerCancelReason = "weather" | "waterlogged" | "maintenance" | "closure" | "double_booked_offline" | "other";
export type ClosureReason = "maintenance" | "re_turfing" | "floodlight_repair" | "private_event" | "waterlogged";
export type SeriesInput = { courtId: string; teamName: string; phone?: string; dow: number; startTime: string; lengthMin: 60 | 90 | 120 | 180; weeks: number; firstDate: string; skipClashingWeeks?: boolean };

const id = (x: string) => ({ path: { id: x } });
export const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const desk = {
  timeline: async (groundId: string, date: string) => unwrap(await api().GET("/me/ground-bookings", { params: { query: { groundId, date } } })),
  /** Any of my bookings at any venue and date: code, last 4+ phone digits, team or contact name (newest first). */
  search: async (q: string, groundId?: string, cursor?: string) =>
    unwrap(await api().GET("/me/ground-bookings/search", { params: { query: { q, ...(groundId ? { groundId } : {}), ...(cursor ? { cursor } : {}), limit: 20 } } })),
  get: async (bid: string) => unwrap(await api().GET("/me/ground-bookings/{id}", { params: id(bid) })),
  checkIn: async (bid: string) => unwrap(await api().POST("/me/ground-bookings/{id}/check-in", { params: id(bid) })),
  noShow: async (bid: string) => unwrap(await api().POST("/me/ground-bookings/{id}/no-show", { params: id(bid) })),
  extend: async (bid: string) => unwrap(await api().POST("/me/ground-bookings/{id}/extend", { params: id(bid) })),
  collect: async (bid: string, method: "cash" | "bkash_venue", amount: number) => unwrap(await api().POST("/me/ground-bookings/{id}/collect-balance", { params: id(bid), body: { method, amount } })),
  cancel: async (bid: string, reason: OwnerCancelReason, note?: string) => unwrap(await api().POST("/me/ground-bookings/{id}/cancel", { params: id(bid), body: { reason, ...(note ? { note } : {}) } })),
  moveTargets: async (bid: string) => unwrap(await api().GET("/me/ground-bookings/{id}/move-targets", { params: id(bid) })),
  move: async (bid: string, courtId: string) => unwrap(await api().POST("/me/ground-bookings/{id}/move", { params: id(bid), body: { courtId } })),
  walkIn: async (groundId: string, body: { courtIds: string[]; start: string; minutes: number; name: string; phone?: string }) =>
    unwrap(await api().POST("/me/grounds/{id}/walk-ins", { params: { ...id(groundId), header: { "idempotency-key": newKey() } }, body })),
  // M09 step 2
  closures: async (groundId: string, scope: "upcoming" | "past") => unwrap(await api().GET("/me/grounds/{id}/closures", { params: { ...id(groundId), query: { scope } } })),
  closurePreview: async (groundId: string, body: { courtIds?: string[]; start: string; end: string; reason: ClosureReason; note?: string }) =>
    unwrap(await api().POST("/me/grounds/{id}/closures/preview", { params: id(groundId), body })),
  createClosure: async (groundId: string, body: { courtIds?: string[]; start: string; end: string; reason: ClosureReason; note?: string }) =>
    unwrap(await api().POST("/me/grounds/{id}/closures", { params: id(groundId), body })),
  reopen: async (cid: string) => unwrap(await api().POST("/me/closures/{id}/reopen", { params: id(cid) })),
  endNow: async (cid: string) => unwrap(await api().POST("/me/closures/{id}/end-now", { params: id(cid) })),
  series: async (groundId: string) => unwrap(await api().GET("/me/grounds/{id}/series", { params: id(groundId) })),
  seriesGet: async (sid: string) => unwrap(await api().GET("/me/series/{id}", { params: id(sid) })),
  seriesPreview: async (groundId: string, body: SeriesInput) => unwrap(await api().POST("/me/grounds/{id}/series/preview", { params: id(groundId), body: { skipClashingWeeks: false, ...body } })),
  createSeries: async (groundId: string, body: SeriesInput) => unwrap(await api().POST("/me/grounds/{id}/series", { params: id(groundId), body: { skipClashingWeeks: false, ...body } })),
  setWeek: async (sid: string, week: number, action: "skip" | "restore") =>
    unwrap(action === "skip" ? await api().POST("/me/series/{id}/weeks/{week}/skip", { params: { path: { id: sid, week } } }) : await api().POST("/me/series/{id}/weeks/{week}/restore", { params: { path: { id: sid, week } } })),
  endSeries: async (sid: string, reason?: string) => unwrap(await api().POST("/me/series/{id}/end", { params: id(sid), body: reason ? { reason } : {} })),
};

// ---------------- pure helpers (tested)

const DHAKA_MS = 6 * 3600 * 1000;
/** Minutes after Dhaka midnight of an instant. */
export const dhakaMinute = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + DHAKA_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};

/**
 * The timeline's hours for a day (minutes after midnight): 06:00–23:00, widened on the half-hour to
 * take in any booking or closure that starts earlier or ends later that day (a ground open late or
 * round the clock), so nothing on the day is hidden.
 */
export function timelineWindow(blocks: { start: string; end: string }[], day: string, open = 360, close = 1380): { open: number; close: number } {
  const dayStart = new Date(`${day}T00:00:00+06:00`).getTime();
  let o = open;
  let c = close;
  for (const b of blocks) {
    const s = (new Date(b.start).getTime() - dayStart) / 60000;
    const e = (new Date(b.end).getTime() - dayStart) / 60000;
    if (e <= 0 || s >= 1440) continue;
    o = Math.min(o, Math.max(0, Math.floor(s / 30) * 30));
    c = Math.max(c, Math.min(1440, Math.ceil(e / 30) * 30));
  }
  return { open: o, close: c };
}

/**
 * Where a block sits on the timeline: 1-based grid columns over half-hour slots from `open` to
 * `close` (minutes after midnight), clipped to the visible day. null when it is outside.
 */
export function blockColumns(start: string, end: string, day: string, open = 360, close = 1380): { from: number; span: number } | null {
  const dayStart = new Date(`${day}T00:00:00+06:00`).getTime();
  const s = Math.max((new Date(start).getTime() - dayStart) / 60000, open);
  const e = Math.min((new Date(end).getTime() - dayStart) / 60000, close);
  if (e <= s) return null;
  return { from: Math.floor((s - open) / 30) + 1, span: Math.ceil((e - s) / 30) };
}

/** What the owner can do with a booking now (the API enforces the same windows). */
export function ownerActions(b: Pick<OwnerBooking, "status" | "start" | "end" | "graceMin" | "money">, now = Date.now()): ("check_in" | "no_show" | "extend" | "collect" | "cancel" | "move")[] {
  const start = new Date(b.start).getTime();
  const end = new Date(b.end).getTime();
  const out: ("check_in" | "no_show" | "extend" | "collect" | "cancel" | "move")[] = [];
  if (b.status === "confirmed") {
    if (now >= start - 30 * 60000 && now < end) out.push("check_in");
    if (now > start + b.graceMin * 60000) out.push("no_show");
    if (now < start) out.push("cancel", "move");
  }
  if (b.status === "checked_in" && now < end) out.push("extend");
  if ((b.status === "checked_in" || b.status === "completed") && b.money.dueAtVenue > 0 && b.money.balanceStatus !== "collected") out.push("collect");
  return out;
}

/** "18:00" on the Dhaka clock. */
export const hhmm = (iso: string) => {
  const m = dhakaMinute(iso);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** The Dhaka calendar date (YYYY-MM-DD) of an instant: the timeline day a booking sits on. */
export const dhakaDate = (iso: string) => new Date(new Date(iso).getTime() + DHAKA_MS).toISOString().slice(0, 10);

/** The calendar date `n` days from `day` (YYYY-MM-DD, no time zone involved). */
export function shiftDay(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** A search worth sending: at least 2 characters once trimmed. */
export const searchable = (q: string) => q.trim().length >= 2;
