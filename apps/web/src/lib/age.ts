/**
 * Age on the Dhaka calendar (M02 §6.3 age_ok, 25 Oct 2026: NID verification is 18 and over).
 * Dhaka is UTC+6 with no daylight saving (the same pattern as `dhakaToday` in lib/gym.ts).
 */
const DHAKA_MS = 6 * 3600000;

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * The latest date of birth ("YYYY-MM-DD") of someone who is at least `age` today in Dhaka: today
 * minus `age` years. 29 February becomes 28 February when that year has none, which matches the
 * server's whole-years check (someone born on 28 Feb is `age` on 29 Feb of a leap year).
 * Used as the `max` of the date-of-birth input.
 */
export function latestDobForAge(age: number, now: Date = new Date()): string {
  const today = new Date(now.getTime() + DHAKA_MS).toISOString().slice(0, 10);
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const year = y - age;
  const day = m === 2 && d === 29 && !isLeap(year) ? 28 : d;
  return `${String(year).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
