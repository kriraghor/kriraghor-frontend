/**
 * Pure helpers for the dashboard charts: clean axis ticks, linear scales, the nearest point under the
 * pointer and compact axis numbers in the Bangladeshi style (thousand, lakh, crore). No React, no DOM,
 * so they are unit tested on their own (packages/ui/src/__tests__/charts-scale.test.ts).
 */

const BN = "০১২৩৪৫৬৭৮৯";

/** Latin digits → Bangla digits for bn; any other locale unchanged. */
export function digits(text: string, locale: string): string {
  return locale === "bn" ? text.replace(/\d/g, (d) => BN[Number(d)]) : text;
}

/** A step of 1, 2, 2.5 or 5 × 10^k that splits `span` into about `count` parts. */
export function niceStep(span: number, count: number): number {
  if (!(span > 0) || !(count > 0)) return 1;
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return nice * power;
}

/**
 * Ticks from 0 (or a negative minimum) up to a clean top at or above `max`, about `count` steps.
 * Counts never get fractional ticks: `integer` rounds the step up to a whole number.
 */
export function niceTicks(max: number, { count = 4, min = 0, integer = false }: { count?: number; min?: number; integer?: boolean } = {}): number[] {
  const lo = Math.min(0, min);
  const hi = Math.max(lo + (integer ? count : 1), max);
  let step = niceStep(hi - lo, count);
  if (integer) step = Math.max(1, Math.ceil(step));
  const start = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  for (let i = 0; i < 50; i += 1) {
    const v = Number((start + i * step).toFixed(6));
    ticks.push(v);
    if (v >= hi) break;
  }
  return ticks;
}

/** A linear scale from [d0, d1] onto [r0, r1]; a zero-width domain maps to the middle of the range. */
export function linear([d0, d1]: [number, number], [r0, r1]: [number, number]) {
  const span = d1 - d0;
  return (v: number) => (span === 0 ? (r0 + r1) / 2 : r0 + ((v - d0) / span) * (r1 - r0));
}

/** The index of the point nearest `x` when `n` points sit `step` apart from `x0` (clamped to 0…n−1). */
export function nearestIndex(x: number, n: number, x0: number, step: number): number {
  if (n <= 1 || step <= 0) return 0;
  return Math.min(n - 1, Math.max(0, Math.round((x - x0) / step)));
}

/** Which of `n` axis labels to print when only `fit` fit: the first, the last and evenly between. */
export function tickEvery(n: number, fit: number): number {
  if (n <= 0 || fit <= 0) return 1;
  return Math.max(1, Math.ceil(n / fit));
}

/** Whether label `i` of `n` prints with every `every`-th shown: the last always, a multiple closer to it than a full step not. */
export function tickShown(i: number, n: number, every: number): boolean {
  if (i === n - 1) return true;
  return i % every === 0 && n - 1 - i >= every;
}

/**
 * A short axis number: 950, 12K, 1.2L, 3.4Cr (bn: ৯৫০, ১২ হা, ১.২ লা, ৩.৪ কো). Under 10,000 the full
 * number with Indian grouping, so small axes stay exact. `top` (the axis's highest tick) picks one unit
 * for the whole axis, so it never mixes 50K with 1L.
 */
export function compact(n: number, locale = "en", top = n): string {
  const sign = n < 0 ? "−" : "";
  const a = Math.abs(n);
  const ref = Math.max(a, Math.abs(top));
  const bn = locale === "bn";
  const fmt = (v: number, unit: string) => `${sign}${trim(v)}${bn ? ` ${unit}` : unit}`;
  let text: string;
  if (ref < 10_000 || a === 0) text = `${sign}${Math.round(a).toLocaleString("en-IN")}`;
  else if (ref < 100_000) text = fmt(a / 1000, bn ? "হা" : "K");
  else if (ref < 10_000_000) text = fmt(a / 100_000, bn ? "লা" : "L");
  else text = fmt(a / 10_000_000, bn ? "কো" : "Cr");
  return digits(text, locale);
}

/** 12.0 → "12", 1.25 → "1.3": one decimal at most, none when it is zero. */
function trim(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Poisha on an axis: ৳ and the compact taka. */
export function compactTaka(poisha: number, locale = "en", top = poisha): string {
  const text = compact(Math.round(poisha / 100), locale, Math.round(top / 100));
  return text.startsWith("−") ? `−৳${text.slice(1)}` : `৳${text}`;
}

/** A whole count with grouping (and Bangla digits). */
export function count(n: number, locale = "en"): string {
  return digits(Math.round(n).toLocaleString("en-IN"), locale);
}

/** A share of a whole as a percent of one decimal at most ("0%" for an empty whole). */
export function share(part: number, whole: number, locale = "en"): string {
  return digits(`${whole > 0 ? trim((part / whole) * 100) : "0"}%`, locale);
}
