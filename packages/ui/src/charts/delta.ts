/**
 * Change against a previous figure, for the KPI tiles. Pure and unit tested. "good" depends on the
 * figure: more check-ins is good, more overdue money is not, so the tile passes `better`.
 */

export type Better = "up" | "down" | "neither";
export type DeltaTone = "good" | "bad" | "flat";

/**
 * Percent change, rounded to a whole number (one decimal under 10%). Null when there is nothing to
 * compare: no previous figure, or a previous zero (any change from nothing is not a percentage, and
 * nothing against nothing says nothing).
 */
export function pctChange(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  if (previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return Math.abs(pct) < 10 ? Math.round(pct * 10) / 10 : Math.round(pct);
}

/** Change in points between two rates already in percent (one decimal). */
export function ptsChange(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  return Math.round((current - previous) * 10) / 10;
}

/** The tone of a change: zero is flat; otherwise good or bad by which way is better. */
export function deltaTone(change: number, better: Better = "up"): DeltaTone {
  if (change === 0 || better === "neither") return "flat";
  return (change > 0) === (better === "up") ? "good" : "bad";
}
