import { useEffect } from "react";
import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { realtimeSocket } from "@kriraghor/api-client/notifications";

/**
 * M10 bookings on kriraghor.com: the half-hour grid of a ground, holds (advance or full online, v3),
 * my bookings and cancel. Payment itself is the M06 /pay flow; the pay result links back here.
 */
export type Availability = components["schemas"]["Availability"];
export type Cell = Availability["courts"][number]["cells"][number];
export type Booking = components["schemas"]["Booking"];
export type CancelTerms = components["schemas"]["CancelTerms"];
export type PaymentChoice = "advance" | "full";

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}

export const bookings = {
  availability: async (groundId: string, date?: string) => ok(await api().GET("/grounds/{id}/availability", { params: { path: { id: groundId }, query: date ? { date } : {} } })),
  quote: async (groundId: string, courtIds: string[], start: string, minutes: number) => ok(await api().POST("/grounds/{id}/quote", { params: { path: { id: groundId } }, body: { courtIds, start, minutes } })),
  hold: async (body: { groundId: string; courtIds: string[]; start: string; minutes: number; payment: PaymentChoice }, key: string) =>
    ok(await api().POST("/bookings/holds", { params: { header: { "idempotency-key": key } }, body })),
  release: async (id: string) => ok(await api().POST("/bookings/{id}/release", { params: { path: { id } } })),
  pay: async (id: string) => ok(await api().POST("/bookings/{id}/pay", { params: { path: { id } } })),
  mine: async (scope: "upcoming" | "past", cursor?: string) => ok(await api().GET("/me/bookings", { params: { query: { scope, ...(cursor ? { cursor } : {}) } } })),
  get: async (id: string) => ok(await api().GET("/me/bookings/{id}", { params: { path: { id } } })),
  cancelPreview: async (id: string) => ok(await api().POST("/me/bookings/{id}/cancel-preview", { params: { path: { id } } })),
  cancel: async (id: string, expectedRefund: number) => ok(await api().POST("/me/bookings/{id}/cancel", { params: { path: { id } }, body: { expectedRefund } })),
};

const DHAKA_MS = 6 * 60 * 60 * 1000;

/** The Dhaka calendar date (YYYY-MM-DD) of an instant. */
export const dhakaDate = (at: string | number | Date) => new Date(new Date(at).getTime() + DHAKA_MS).toISOString().slice(0, 10);

/** Every Dhaka date from `from` to `to`, inclusive (the 7-day booking window). */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** "Sat 18" / "শনি ১৮" for the day strip, and a new Idempotency-Key per click (M06 §9): shared with the gym app. */
export { dayLabel, newKey } from "@kriraghor/ui/format";

/** "6:30 pm" / "৬:৩০ PM" for a cell or a booking time, on the Dhaka clock. */
export function timeLabel(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Dhaka" }).format(new Date(iso));
}

/** "Sun 19 Oct, 6:00 pm" for a booking. */
export function whenLabel(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Dhaka" }).format(new Date(iso));
}

/**
 * Can a booking of `minutes` start at cell `index`? Every half-hour from there must be open on the
 * court (FR-01). Returns false past the end of the grid.
 */
export function canStartAt(cells: Pick<Cell, "state">[], index: number, minutes: number): boolean {
  const n = minutes / 30;
  if (!Number.isInteger(n) || n < 1 || index < 0 || index + n > cells.length) return false;
  return cells.slice(index, index + n).every((c) => c.state === "open");
}

/** The cells a selection covers (for highlighting). */
export function coveredIndexes(index: number | null, minutes: number): Set<number> {
  if (index === null) return new Set();
  return new Set(Array.from({ length: minutes / 30 }, (_, i) => index + i));
}

/** Statuses a member sees as "upcoming and active". */
export const ACTIVE = new Set(["pending_payment", "confirmed", "checked_in"]);


/** Re-read the grid when the ground's availability changes (M10 FR-02, Socket.IO room ground:{id}). */
export function useGroundLive(groundId: string | undefined, onChange: () => void) {
  useEffect(() => {
    if (!groundId) return undefined;
    const socket = realtimeSocket("api");
    const room = `ground:${groundId}`;
    const join = () => socket.emit("subscribe", room);
    if (socket.connected) join();
    socket.on("connect", join);
    const handler = (e: { groundId?: string }) => {
      if (e?.groundId === groundId) onChange();
    };
    socket.on("ground.availability_changed", handler);
    return () => {
      socket.emit("unsubscribe", room);
      socket.off("connect", join);
      socket.off("ground.availability_changed", handler);
    };
    // onChange is a stable callback from the caller (react-query invalidate).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groundId]);
}
