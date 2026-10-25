/**
 * Small formatting helpers every Kriraghor web app shares (money, Dhaka calendar days and
 * Idempotency-Keys), so kriraghor.com, gym.kriraghor.com and the business panel show the same text.
 * Pure: safe in server and client components.
 */

const BN = "০১২৩৪৫৬৭৮৯";

/** Poisha → "৳1,23,456.50" (Indian grouping), Bangla digits for bn. Same rule as the backend. */
export function formatTaka(poisha: number, locale = "en"): string {
  const abs = Math.abs(poisha);
  const taka = Math.trunc(abs / 100).toLocaleString("en-IN");
  const rest = abs % 100;
  const text = `${poisha < 0 ? "−" : ""}৳${taka}${rest ? `.${String(rest).padStart(2, "0")}` : ""}`;
  return locale === "bn" ? text.replace(/\d/g, (d) => BN[Number(d)]) : text;
}

/** "Sat 18" / "শনি ১৮" for a YYYY-MM-DD calendar date (read at noon UTC, so no time zone shifts it). */
export function dayLabel(date: string, locale: string) {
  const d = new Date(`${date}T12:00:00Z`);
  const f = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
  return f.format(d);
}

/** A fresh Idempotency-Key for one submit (a double click or a retry replays instead of acting twice). */
export const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
