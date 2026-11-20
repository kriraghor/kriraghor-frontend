/**
 * Report periods for the dashboards: a calendar month or a from–to range, the presets a reader
 * reaches for first (this month, last month, the last 7 or 30 days) and which preset a period is.
 * Pure, on "YYYY-MM-DD" strings in the Dhaka calendar; unit tested.
 */

export type Period = { month: string } | { from: string; to: string };
export type Preset = "thisMonth" | "lastMonth" | "last7" | "last30" | "month" | "custom";

/** `date` moved by `n` days. */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM" moved by `n` months. */
export function shiftMonth(month: string, n: number): string {
  const total = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + n;
  return `${String(Math.floor(total / 12)).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** The period of a preset; "month" and "custom" keep the current period (they open their own fields). */
export function presetPeriod(preset: Preset, today: string, current: Period): Period {
  switch (preset) {
    case "thisMonth":
      return { month: today.slice(0, 7) };
    case "lastMonth":
      return { month: shiftMonth(today.slice(0, 7), -1) };
    case "last7":
      return { from: addDays(today, -6), to: today };
    case "last30":
      return { from: addDays(today, -29), to: today };
    case "month":
      return "month" in current ? current : { month: current.to.slice(0, 7) };
    default: {
      if ("from" in current) return current;
      const last = lastOfMonth(current.month);
      return { from: `${current.month}-01`, to: last > today ? today : last };
    }
  }
}

/** Which preset a period is. */
export function presetOf(period: Period, today: string): Preset {
  if ("month" in period) {
    if (period.month === today.slice(0, 7)) return "thisMonth";
    if (period.month === shiftMonth(today.slice(0, 7), -1)) return "lastMonth";
    return "month";
  }
  if (period.to === today && period.from === addDays(today, -6)) return "last7";
  if (period.to === today && period.from === addDays(today, -29)) return "last30";
  return "custom";
}

/** The last day of a "YYYY-MM" month. */
export function lastOfMonth(month: string): string {
  return addDays(`${shiftMonth(month, 1)}-01`, -1);
}

/**
 * The period in the URL (?month= or ?from=&to=), or this month. A range that runs backwards, ends
 * after today or spans more than `maxDays` falls back to this month.
 */
export function periodFromParams(p: { month?: string | null; from?: string | null; to?: string | null }, today: string, maxDays = 366): Period {
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (p.from && p.to && ymd.test(p.from) && ymd.test(p.to) && p.from <= p.to && p.to <= today) {
    const days = (Date.parse(`${p.to}T00:00:00Z`) - Date.parse(`${p.from}T00:00:00Z`)) / 86_400_000;
    if (days < maxDays) return { from: p.from, to: p.to };
  }
  if (p.month && /^\d{4}-\d{2}$/.test(p.month) && p.month <= today.slice(0, 7)) return { month: p.month };
  return { month: today.slice(0, 7) };
}

/** The URL patch of a period: this month leaves the URL clean. */
export function periodParams(period: Period, today: string): { month: string | null; from: string | null; to: string | null } {
  if ("month" in period) return { month: period.month === today.slice(0, 7) ? null : period.month, from: null, to: null };
  return { month: null, from: period.from, to: period.to };
}
