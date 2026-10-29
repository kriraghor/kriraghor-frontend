/**
 * Pure helpers behind the shared date and time pickers (DatePicker, TimePicker, DateTimePicker,
 * MonthPicker). Values stay the strings the native inputs produced, so callers and API payloads do
 * not change: a day is "YYYY-MM-DD", a month "YYYY-MM", a time "HH:MM" and a date-time
 * "YYYY-MM-DDTHH:MM" (a wall-clock value with no zone, exactly like <input type="datetime-local">).
 * Weeks start on Saturday (Bangladesh), "today" is the Dhaka calendar day, and Bangla gets Bangla
 * month and weekday names and Bangla digits.
 */

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const DHAKA_MS = 6 * 3600000;

/** Saturday, the first day of the week in Bangladesh (react-day-picker's weekStartsOn). */
export const WEEK_STARTS_ON = 6 as const;

export const isBn = (locale: string) => locale === "bn" || locale.startsWith("bn-");
/** The Intl tag the pickers format with: en-GB ("Mon 2 Nov 2026") or bn-BD. */
export const intlTag = (locale: string) => (isBn(locale) ? "bn-BD" : "en-GB");

/** Western digits to Bangla digits ("2026" → "২০২৬"). */
export const bnDigits = (text: string) => text.replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
/** Digits for the locale: Bangla digits for bn, unchanged otherwise. */
export const localDigits = (text: string, locale: string) => (isBn(locale) ? bnDigits(text) : text);

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const YM = /^(\d{4})-(\d{2})$/;
const HM = /^([01]\d|2[0-4]):([0-5]\d)$/;

/** "YYYY-MM-DD" → a local-midnight Date (what the calendar works with), or undefined when not a real day. */
export function parseYmd(value: string | null | undefined): Date | undefined {
  const m = value ? YMD.exec(value) : null;
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : undefined;
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** A local Date → "YYYY-MM-DD" (its calendar day where the browser is, no zone shift). */
export const toYmd = (d: Date) => `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The Dhaka calendar day of an instant (default now), "YYYY-MM-DD". */
export const dhakaToday = (now: Date | number = Date.now()) => new Date(new Date(now).getTime() + DHAKA_MS).toISOString().slice(0, 10);

/** Days added to a "YYYY-MM-DD" (calendar arithmetic, no zone). */
export function addDaysYmd(value: string, n: number): string {
  const d = parseYmd(value);
  if (!d) return value;
  d.setDate(d.getDate() + n);
  return toYmd(d);
}

/** A calendar day read at noon UTC, so no time zone moves it to the day before or after. */
const noonUtc = (value: string) => new Date(`${value}T12:00:00Z`);

/** "Mon 2 Nov 2026" (en) or "সোম, ২ নভে, ২০২৬" (bn): the date shown on the picker's trigger. */
export function formatDateLabel(value: string, locale: string): string {
  if (!parseYmd(value)) return "";
  const text = new Intl.DateTimeFormat(intlTag(locale), { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(noonUtc(value));
  // en-GB puts a comma after the weekday in some engines ("Mon, 2 Nov 2026"); the product style has none.
  return isBn(locale) ? bnDigits(text) : text.replace(/^(\w+),/, "$1");
}

/** "Monday 2 November 2026": the long form screen readers hear for a day. */
export function formatDateLong(value: string, locale: string): string {
  if (!parseYmd(value)) return "";
  const text = new Intl.DateTimeFormat(intlTag(locale), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(noonUtc(value));
  return isBn(locale) ? bnDigits(text) : text.replace(/^(\w+),/, "$1");
}

/** "YYYY-MM" → "November 2026" / "নভেম্বর ২০২৬", or "" when not a month. */
export function formatMonthLabel(value: string, locale: string): string {
  if (!YM.test(value)) return "";
  const text = new Intl.DateTimeFormat(intlTag(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(noonUtc(`${value}-15`));
  return localDigits(text, locale);
}

/** Month names (January…December) in the locale, for the month picker grid. */
export function monthNames(locale: string, width: "long" | "short" = "short"): string[] {
  const f = new Intl.DateTimeFormat(intlTag(locale), { month: width, timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, m) => f.format(new Date(Date.UTC(2026, m, 15, 12))));
}

export type DayRule = {
  /** First day allowed, "YYYY-MM-DD". */
  min?: string;
  /** Last day allowed, "YYYY-MM-DD". */
  max?: string;
  /** Days that cannot be picked: a list, or a test per day. */
  disabledDays?: readonly string[] | ((value: string) => boolean);
};

/** True when a day cannot be picked: before `min`, after `max`, or one of `disabledDays`. String compare is safe for YYYY-MM-DD. */
export function isDayDisabled(value: string, rule: DayRule): boolean {
  if (rule.min && value < rule.min) return true;
  if (rule.max && value > rule.max) return true;
  const d = rule.disabledDays;
  if (!d) return false;
  return typeof d === "function" ? d(value) : d.includes(value);
}

/** The month the calendar opens on: the chosen day's, else today's, kept inside [min, max]. */
export function initialMonth(value: string, today: string, rule: Pick<DayRule, "min" | "max">): Date {
  let day = parseYmd(value) ? value : today;
  if (rule.min && day < rule.min) day = rule.min;
  if (rule.max && day > rule.max) day = rule.max;
  const d = parseYmd(day) ?? new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * The months the caption dropdowns and the arrows can reach: from `min` (else 100 years back, for
 * dates of birth) to `max` (else 10 years ahead, for events and contracts).
 */
export function navRange(today: string, rule: Pick<DayRule, "min" | "max">): { start: Date; end: Date } {
  const t = parseYmd(today) ?? new Date();
  const min = parseYmd(rule.min);
  const max = parseYmd(rule.max);
  return {
    start: min ? new Date(min.getFullYear(), min.getMonth(), 1) : new Date(t.getFullYear() - 100, 0, 1),
    end: max ? new Date(max.getFullYear(), max.getMonth(), 1) : new Date(t.getFullYear() + 10, 11, 1),
  };
}

// ---------------- times

/** "HH:MM" → minutes after midnight ("24:00" → 1440), or null. */
export function minutesOf(value: string | null | undefined): number | null {
  const m = value ? HM.exec(value) : null;
  if (!m) return null;
  const n = Number(m[1]) * 60 + Number(m[2]);
  return n > 1440 ? null : n;
}

/** Minutes after midnight → "HH:MM" (1440 → "24:00"). */
export const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

export type TimeRule = {
  /** Minutes between choices (default 30). */
  step?: number;
  /** First time offered, "HH:MM". */
  min?: string;
  /** Last time offered, "HH:MM". */
  max?: string;
  /** Offer "24:00" (the end of the day) as the last choice, for closing hours. */
  endOfDay?: boolean;
};

/**
 * The times a TimePicker offers, "HH:MM", every `step` minutes from 00:00, inside [min, max]. A
 * current value off the step (an old "07:45" with a 30-minute step) is kept in the list, sorted in.
 */
export function timeOptions(rule: TimeRule = {}, current?: string): string[] {
  const step = Math.max(1, Math.round(rule.step ?? 30));
  const lo = minutesOf(rule.min) ?? 0;
  const hi = minutesOf(rule.max) ?? (rule.endOfDay ? 1440 : 1439);
  const out: number[] = [];
  for (let m = 0; m < 1440; m += step) if (m >= lo && m <= hi) out.push(m);
  if (rule.endOfDay && hi >= 1440) out.push(1440);
  const cur = minutesOf(current);
  if (cur !== null && !out.includes(cur)) out.push(cur);
  return out.sort((a, b) => a - b).map(hhmm);
}

/** "19:30" → "7:30 pm" (en) or "৭:৩০ PM"-style with Bangla digits (bn); "24:00" reads as midnight's 12:00 am. */
export function formatTimeLabel(value: string, locale: string): string {
  const m = minutesOf(value);
  if (m === null) return "";
  const text = new Intl.DateTimeFormat(intlTag(locale), { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 1, 0, m % 1440)));
  return isBn(locale) ? bnDigits(text) : text;
}

// ---------------- date-times (datetime-local strings)

/** "YYYY-MM-DDTHH:MM[:SS]" → ["YYYY-MM-DD", "HH:MM"]; parts that are not there come back "". */
export function splitDateTime(value: string | null | undefined): [string, string] {
  if (!value) return ["", ""];
  const [d = "", t = ""] = value.split("T");
  return [parseYmd(d) ? d : "", minutesOf(t.slice(0, 5)) !== null ? t.slice(0, 5) : ""];
}

/** Both parts → "YYYY-MM-DDTHH:MM"; "" until both are chosen (what an unfinished native input reports). */
export const joinDateTime = (date: string, time: string) => (date && time ? `${date}T${time}` : "");
