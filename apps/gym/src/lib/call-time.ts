/** "Best time to call" on a gym's enquiry form (tester feedback, 28 Nov 2026). */

/** Every half hour from 06:00 to 23:00, as "HH:MM". */
export const CALL_TIMES = Array.from({ length: 35 }, (_, i) => {
  const m = 6 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});
export const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/** What the gym reads: "18:00–20:00", or null for any time (the API keeps up to 40 characters). */
export function bestTimeText(from: string, to: string): string | null {
  if (!from) return null;
  return to && toMin(to) > toMin(from) ? `${from}–${to}` : from;
}

/** The "To" after a new "From": kept when still later, else two hours on (at most 23:00). */
export function nextTo(from: string, to: string): string {
  if (!from) return "";
  if (to && toMin(to) > toMin(from)) return to;
  return CALL_TIMES.find((x) => toMin(x) >= Math.min(toMin(from) + 120, 23 * 60)) ?? "23:00";
}
