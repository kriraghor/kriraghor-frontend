import type { PlanContent } from "@/lib/gym-manage";
import { blankDay, blankFood, blankMeal, blankExercise, MAX_DAYS, MAX_ITEMS, MAX_MEALS, type Bilingual, type Exercise, type Food, type Meal, type WorkoutDay } from "@/lib/plans";

/**
 * Quick fill (tester feedback, 28 Nov 2026): the owner or a trainer types a plan as plain text and the
 * form fills itself. Runs in the browser; no AI.
 *
 *   Breakfast (8:00): 2 eggs, almonds
 *   Lunch: rice, fish curry, salad
 *
 *   Day 1: Bench press 3x10, Squat 4x8, Plank 3x45s
 *   Day 2 – Legs: Lunges 3x12
 *
 * A heading is the text before a colon ("Breakfast:", "সকাল:", "Day 1:"), on its own line or after a comma
 * on one line ("breakfast: two eggs, almonds, lunch: rice"); a time in brackets after it goes on the meal.
 * Items are split by commas, semicolons, new lines and " and ". In a workout "3x10" (or 3×10) is sets and
 * reps, "45s" / "45 sec" a time, "rest 60s" the rest. Bangla text goes in the Bangla name, the rest in
 * English. Without any heading, everything is one meal or one day.
 */
export type QuickFillResult = { content: PlanContent; groups: number; items: number; cut: boolean };

const BANGLA = /[ঀ-৿]/;
const nameOf = (text: string): Bilingual => (BANGLA.test(text) ? { en: "", bn: text } : { en: text, bn: "" });

// A heading: up to 40 characters without separators, an optional (time), then a colon.
const HEADING = /(^|[\n,;।]|\.\s)\s*([^\n,;:।.()]{1,40}?)\s*(?:\(\s*([0-9০-৯]{1,2}[:.][0-9০-৯]{2}\s*(?:[ap]\.?m\.?)?)\s*\))?\s*[:：]/gi;

const toAsciiDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));

/** "8:00", "8.30 pm", "২০:০০" → "HH:MM", or null. */
export function normaliseTime(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = toAsciiDigits(raw.trim().toLowerCase()).match(/^(\d{1,2})[:.](\d{2})\s*([ap])?\.?m?\.?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (m[3] === "p" && h < 12) h += 12;
  if (m[3] === "a" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** The headings and their text, in order; one untitled section when there is none. */
export function sections(text: string): { title: string; time: string | null; body: string }[] {
  const found: { title: string; time: string | null; start: number; end: number }[] = [];
  for (const m of text.matchAll(HEADING)) {
    const title = m[2]!.trim();
    if (!title) continue;
    found.push({ title, time: normaliseTime(m[3]), start: m.index! + m[1]!.length, end: m.index! + m[0].length });
  }
  if (!found.length) return text.trim() ? [{ title: "", time: null, body: text }] : [];
  const out = found.map((h, i) => ({ title: h.title, time: h.time, body: text.slice(h.end, i + 1 < found.length ? found[i + 1]!.start : text.length) }));
  const before = text.slice(0, found[0]!.start).trim();
  return before ? [{ title: "", time: null, body: before }, ...out] : out;
}

/** The items of one section. */
export const itemsOf = (body: string): string[] =>
  body
    .split(/[\n,;।]|\s+and\s+|\s+এবং\s+|\s+আর\s+/i)
    .map((s) => s.trim().replace(/^[-•*·]\s*/, "").replace(/[.।]+$/, "").trim())
    .filter(Boolean);

/** An exercise from "Bench press 3x10", "Plank 3x45s", "Run 20 min", "Squat 4x8 rest 90s". */
export function exerciseFrom(text: string, base: Exercise): Exercise {
  let rest = toAsciiDigits(text);
  let sets: number | null = null;
  let reps: number | null = null;
  let timeSec: number | null = null;
  let restSec: number | null = null;
  const restM = rest.match(/\brest\s+(\d{1,4})\s*(s|sec|secs|seconds|m|min|mins|minutes)\b/i);
  if (restM) {
    restSec = Number(restM[1]) * (/^m/i.test(restM[2]!) ? 60 : 1);
    rest = rest.replace(restM[0], " ");
  }
  const sr = rest.match(/(\d{1,2})\s*[x×]\s*(\d{1,4})\s*(s|sec|secs|seconds|m|min|mins|minutes)?\b/i);
  if (sr) {
    sets = Number(sr[1]);
    if (sr[3]) timeSec = Number(sr[2]) * (/^m/i.test(sr[3]) ? 60 : 1);
    else reps = Number(sr[2]);
    rest = rest.replace(sr[0], " ");
  } else {
    const tm = rest.match(/(\d{1,4})\s*(s|sec|secs|seconds|m|min|mins|minutes)\b/i);
    if (tm) {
      timeSec = Number(tm[1]) * (/^m/i.test(tm[2]!) ? 60 : 1);
      rest = rest.replace(tm[0], " ");
    }
  }
  const name = rest.replace(/\s{2,}/g, " ").replace(/[-–:,]+\s*$/, "").trim() || text.trim();
  return { ...base, name: nameOf(name), sets, reps: reps === null ? null : String(reps), timeSec, restSec };
}

/** Builds a workout plan or diet chart from text; `notes` of a diet chart are kept. */
export function quickFill(kind: "workout" | "diet", text: string, keep?: PlanContent): QuickFillResult {
  const used = new Set<string>();
  const parts = sections(text);
  let cut = false;
  let items = 0;
  if (kind === "workout") {
    const days: WorkoutDay[] = [];
    for (const [i, s] of parts.entries()) {
      if (days.length >= MAX_DAYS) {
        cut = true;
        break;
      }
      const d = blankDay(used);
      used.add(d.key);
      const list = itemsOf(s.body);
      if (list.length > MAX_ITEMS) cut = true;
      const exercises = list.slice(0, MAX_ITEMS).map((x) => {
        const e = exerciseFrom(x, blankExercise(used));
        used.add(e.ref);
        return e;
      });
      items += exercises.length;
      days.push({ ...d, name: nameOf(s.title || `Day ${i + 1}`), items: exercises });
    }
    return { content: { kind: "workout", days: days.length ? days : [blankDay(used)] }, groups: days.length, items, cut };
  }
  const meals: Meal[] = [];
  for (const s of parts) {
    if (meals.length >= MAX_MEALS) {
      cut = true;
      break;
    }
    const m = blankMeal(used);
    used.add(m.ref);
    const list = itemsOf(s.body);
    if (list.length > MAX_ITEMS) cut = true;
    const foods: Food[] = list.slice(0, MAX_ITEMS).map((x) => {
      const f = blankFood(used);
      used.add(f.ref);
      return { ...f, name: nameOf(x) };
    });
    items += foods.length;
    meals.push({ ...m, name: nameOf(s.title || "Meal"), time: s.time, items: foods });
  }
  const notes = keep && keep.kind === "diet" ? (keep.notes ?? null) : null;
  return { content: { kind: "diet", meals: meals.length ? meals : [blankMeal(used)], notes }, groups: meals.length, items, cut };
}
