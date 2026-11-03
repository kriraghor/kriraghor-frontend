const DHAKA_MS = 6 * 3600000;

/** Today, or a time, as a Dhaka calendar date: the dates on a tournament post are Dhaka dates. */
export const dayKey = (at: Date | number = Date.now()) => new Date(new Date(at).getTime() + DHAKA_MS).toISOString().slice(0, 10);

/** "20 Nov" or "20 – 22 Nov 2026", read as Dhaka dates in the page's language. */
export function dateRange(start: string, end: string | null, locale: string): string {
  const tag = locale === "bn" ? "bn-BD" : "en-GB";
  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, { ...opts, timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const full: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  if (!end || end === start) return fmt(start, full);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return `${fmt(start, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" })} – ${fmt(end, full)}`;
}

/** Days from today to a date: 0 today, negative once it has passed. */
export const daysUntil = (date: string, today = dayKey()) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
