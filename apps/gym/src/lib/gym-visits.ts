import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "./manage";

/**
 * Free trial visits (product owner, 9 Nov 2026; M24 §17, FR-109 to FR-120). A signed-in person with a verified
 * phone books a free visit to a gym before joining, confirmed at once within the gym's rules; the gym's desk
 * sees today's guests, checks them in by the guest's QR or 6-character code, and can make a guest a member
 * (source desk: no Kriraghor referral fee). Nothing is paid. The API enforces every rule; these helpers only
 * shape the screens.
 */
type S = components["schemas"];
export type VisitSlots = S["GymVisitSlots"];
export type VisitDay = VisitSlots["days"][number];
export type MyVisit = S["MyGymVisit"];
export type GymVisit = S["GymVisit"];
export type GymVisits = S["GymVisits"];
export type VisitStatus = GymVisit["status"];

const G = (gymId: string) => ({ path: { gymId } });
const V = (gymId: string, visitId: string) => ({ path: { gymId, visitId } });

export const gymVisits = {
  // the gym page (no sign-in)
  slots: async (slug: string) => unwrap(await api().GET("/gym/gyms/{slug}/visit-slots", { params: { path: { slug } } })),
  // the guest
  book: async (body: { gymId: string; date: string; arriveAt: string }, key: string) => unwrap(await api().POST("/me/gym-visits", { params: { header: { "idempotency-key": key } }, body })),
  mine: async () => unwrap(await api().GET("/me/gym-visits")),
  cancelMine: async (visitId: string) => unwrap(await api().POST("/me/gym-visits/{visitId}/cancel", { params: { path: { visitId } } })),
  // the gym
  list: async (gymId: string, q: { date?: string; status?: VisitStatus } = {}) => unwrap(await api().GET("/manage/gyms/{gymId}/visits", { params: { ...G(gymId), query: q } })),
  checkIn: async (gymId: string, visitId: string) => unwrap(await api().POST("/manage/gyms/{gymId}/visits/{visitId}/check-in", { params: V(gymId, visitId) })),
  cancel: async (gymId: string, visitId: string, reason: string) => unwrap(await api().POST("/manage/gyms/{gymId}/visits/{visitId}/cancel", { params: V(gymId, visitId), body: { reason } })),
  revealPhone: async (gymId: string, visitId: string) => unwrap(await api().POST("/manage/gyms/{gymId}/visits/{visitId}/reveal-phone", { params: V(gymId, visitId) })),
  convert: async (gymId: string, visitId: string) => unwrap(await api().POST("/manage/gyms/{gymId}/visits/{visitId}/convert", { params: V(gymId, visitId) })) as { member: { id: string } },
};

// ---------------- pure helpers (tested)

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Minutes after midnight in Dhaka now (UTC+6, no daylight saving). */
export const dhakaMinuteNow = (now = new Date()) => Math.floor(((now.getTime() + 6 * 3600000) % 86400000) / 60000);

/**
 * The arrival times offered on a day: every `step` minutes inside each opening window (the close time itself
 * is not inside), and on today only times after `nowMinute`. Sorted, without repeats.
 */
export function visitTimes(windows: { openTime: string; closeTime: string }[], { isToday = false, nowMinute = 0, step = 30 } = {}): string[] {
  const out = new Set<number>();
  for (const w of windows) {
    const open = toMin(w.openTime);
    const close = toMin(w.closeTime);
    for (let m = Math.ceil(open / step) * step; m < close; m += step) if (!isToday || m > nowMinute) out.add(m);
  }
  return [...out].sort((a, b) => a - b).map(toHhmm);
}

/** The days a person can still pick: open, with a place left, and (today) with a time still ahead. */
export function bookableDays(days: VisitDay[], { today, nowMinute }: { today: string; nowMinute: number }): VisitDay[] {
  return days.filter((d) => d.placesLeft > 0 && visitTimes(d.windows, { isToday: d.date === today, nowMinute }).length > 0);
}

/** Is a booked visit still ahead (the guest can still cancel it before the cutoff)? */
export const visitAhead = (v: Pick<MyVisit, "status" | "date" | "arriveAt">, { today, nowMinute }: { today: string; nowMinute: number }) =>
  v.status === "booked" && (v.date > today || (v.date === today && toMin(v.arriveAt) > nowMinute));

/** The guest's visits split for the screen: what is coming (booked, soonest first) and the rest (newest first). */
export function splitVisits(items: MyVisit[]): { coming: MyVisit[]; past: MyVisit[] } {
  const coming = items.filter((v) => v.status === "booked" && v.token).sort((a, b) => (a.date + a.arriveAt).localeCompare(b.date + b.arriveAt));
  const past = items.filter((v) => !coming.includes(v));
  return { coming, past };
}

/** The 6-character code shown in two groups of three, easier to read out at the desk. */
export const codeGroups = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;
