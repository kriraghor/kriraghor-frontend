import type { DietContent, MyPlanItem, PlanContent, PlanKind, PlanLog, WorkoutContent } from "./gym-manage";

/**
 * M24 prompt 3 · workout plans and diet charts (M24 §6.10, M24-FR-62 to FR-69). Pure helpers for the
 * plan editor on /manage/[gymId]/plans and the member's /me/plans. A plan is up to 7 named workout
 * days of exercises, or the meals of a diet chart. Every day, meal and item carries a ref that stays the
 * same across versions, so a member's ticks stay attached when the gym edits the plan. The API checks
 * every limit again (gym_manage.plan_max_items, gym_manage.diet_max_meals); the editor only warns early.
 */
export type Bilingual = { en?: string | null; bn?: string | null };
export type WorkoutDay = WorkoutContent["days"][number];
export type Exercise = WorkoutDay["items"][number];
export type Meal = DietContent["meals"][number];
export type Food = Meal["items"][number];

/** The schema's hard ceilings (the live limits are settings, checked by the API). */
export const MAX_DAYS = 7;
export const MAX_MEALS = 12;
export const MAX_ITEMS = 50;

const REF = /^[A-Za-z0-9_-]{1,20}$/;

/** Every ref and day key already in a plan (new refs must not repeat one). */
export function refsIn(content: PlanContent): Set<string> {
  const out = new Set<string>();
  if (content.kind === "workout") for (const d of content.days) [d.key, ...d.items.map((i) => i.ref)].forEach((r) => out.add(r));
  else for (const m of content.meals) [m.ref, ...m.items.map((i) => i.ref)].forEach((r) => out.add(r));
  return out;
}

/** A new ref ("d1", "x7", …) not used in the plan: short, readable, and kept forever once saved. */
export function newRef(prefix: string, used: ReadonlySet<string>): string {
  for (let n = 1; ; n += 1) {
    const ref = `${prefix}${n}`;
    if (!used.has(ref)) return ref;
  }
}

export const blankExercise = (used: ReadonlySet<string>): Exercise => ({ ref: newRef("x", used), name: { en: "", bn: "" }, sets: null, reps: null, timeSec: null, restSec: null, weightNote: null, note: null, videoUrl: null });
export const blankDay = (used: ReadonlySet<string>): WorkoutDay => ({ key: newRef("d", used), name: { en: "", bn: "" }, items: [] });
export const blankFood = (used: ReadonlySet<string>): Food => ({ ref: newRef("f", used), name: { en: "", bn: "" }, portion: null, kcal: null, proteinG: null, note: null });
export const blankMeal = (used: ReadonlySet<string>): Meal => ({ ref: newRef("m", used), name: { en: "", bn: "" }, time: null, items: [] });

/** A new plan's first content: one empty workout day, or one empty meal. */
export function blankContent(kind: PlanKind): PlanContent {
  const used = new Set<string>();
  return kind === "workout" ? { kind, days: [blankDay(used)] } : { kind, meals: [blankMeal(used)], notes: null };
}

/** The text in the reader's language, else the other one (plans are written in English, Bangla or both). */
export function textOf(name: Bilingual | null | undefined, locale: string): string {
  if (!name) return "";
  const first = locale === "bn" ? name.bn : name.en;
  const second = locale === "bn" ? name.en : name.bn;
  return (first?.trim() || second?.trim() || "").trim();
}

/** Move one row up (-1) or down (+1); unchanged at the ends. */
export function move<T>(rows: readonly T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (index < 0 || index >= rows.length || to < 0 || to >= rows.length) return [...rows];
  const out = [...rows];
  [out[index], out[to]] = [out[to], out[index]];
  return out;
}

export type PlanProblem = { path: string; code: "no_groups" | "too_many_groups" | "too_many_items" | "no_name" | "bad_ref" | "duplicate_ref" | "bad_video" | "bad_time" };

/** The first problems the editor can see before saving (the API says the rest). */
export function planProblems(content: PlanContent, limits: { maxItems?: number; maxMeals?: number } = {}): PlanProblem[] {
  const maxItems = Math.min(limits.maxItems ?? MAX_ITEMS, MAX_ITEMS);
  const out: PlanProblem[] = [];
  const seen = new Set<string>();
  const ref = (r: string, path: string) => {
    if (!REF.test(r)) out.push({ path, code: "bad_ref" });
    else if (seen.has(r)) out.push({ path, code: "duplicate_ref" });
    seen.add(r);
  };
  const named = (n: Bilingual, path: string) => {
    if (!n.en?.trim() && !n.bn?.trim()) out.push({ path, code: "no_name" });
  };
  if (content.kind === "workout") {
    if (!content.days.length) out.push({ path: "days", code: "no_groups" });
    if (content.days.length > MAX_DAYS) out.push({ path: "days", code: "too_many_groups" });
    content.days.forEach((d, i) => {
      ref(d.key, `days[${i}]`);
      named(d.name, `days[${i}].name`);
      if (d.items.length > maxItems) out.push({ path: `days[${i}].items`, code: "too_many_items" });
      d.items.forEach((x, j) => {
        const p = `days[${i}].items[${j}]`;
        ref(x.ref, p);
        named(x.name, `${p}.name`);
        if (x.videoUrl && !isHttps(x.videoUrl)) out.push({ path: `${p}.videoUrl`, code: "bad_video" });
      });
    });
  } else {
    const maxMeals = Math.min(limits.maxMeals ?? MAX_MEALS, MAX_MEALS);
    if (!content.meals.length) out.push({ path: "meals", code: "no_groups" });
    if (content.meals.length > maxMeals) out.push({ path: "meals", code: "too_many_groups" });
    content.meals.forEach((m, i) => {
      ref(m.ref, `meals[${i}]`);
      named(m.name, `meals[${i}].name`);
      if (m.time && !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(m.time)) out.push({ path: `meals[${i}].time`, code: "bad_time" });
      if (m.items.length > maxItems) out.push({ path: `meals[${i}].items`, code: "too_many_items" });
      m.items.forEach((x, j) => {
        const p = `meals[${i}].items[${j}]`;
        ref(x.ref, p);
        named(x.name, `${p}.name`);
      });
    });
  }
  return out;
}

function isHttps(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.includes(".");
  } catch {
    return false;
  }
}

const blankToNull = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);
const cleanName = (n: Bilingual): Bilingual => ({ en: blankToNull(n.en), bn: blankToNull(n.bn) });

/** The content as the API takes it: trimmed text, blank optional text as null. */
export function cleanContent(content: PlanContent): PlanContent {
  if (content.kind === "workout")
    return {
      kind: "workout",
      days: content.days.map((d) => ({
        key: d.key,
        name: cleanName(d.name),
        items: d.items.map((x) => ({ ...x, name: cleanName(x.name), reps: blankToNull(x.reps), weightNote: blankToNull(x.weightNote), note: blankToNull(x.note), videoUrl: blankToNull(x.videoUrl) })),
      })),
    };
  const notes = content.notes ? cleanName(content.notes) : null;
  return {
    kind: "diet",
    meals: content.meals.map((m) => ({ ref: m.ref, name: cleanName(m.name), time: blankToNull(m.time), items: m.items.map((x) => ({ ...x, name: cleanName(x.name), portion: blankToNull(x.portion), note: blankToNull(x.note) })) })),
    notes: notes && (notes.en || notes.bn) ? notes : null,
  };
}

/** How many exercises or foods a plan holds. */
export const itemCount = (content: PlanContent) => (content.kind === "workout" ? content.days.reduce((n, d) => n + d.items.length, 0) : content.meals.reduce((n, m) => n + m.items.length, 0));

// ---------------- the member's side

/** The latest tick per (date, item): logs come newest first, the first one wins (the log is append-only). */
export function latestTicks(logs: readonly Pick<PlanLog, "localDate" | "itemRef" | "done" | "note">[]): Map<string, { done: boolean; note: string | null }> {
  const out = new Map<string, { done: boolean; note: string | null }>();
  for (const l of logs) {
    const k = `${l.localDate}|${l.itemRef}`;
    if (!out.has(k)) out.set(k, { done: l.done, note: l.note });
  }
  return out;
}
export const tickKey = (date: string, ref: string) => `${date}|${ref}`;

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

/**
 * The plan's day for a date, as the API counts it (§6.10): the workout days repeat from the start
 * date; a diet chart is one "day" (0) for as long as it runs. Null before the start or after the end.
 */
export function dayIndexFor(item: Pick<MyPlanItem, "content" | "startsOn" | "endsOn">, date: string): number | null {
  const days = item.content.kind === "workout" ? item.content.days.length : 1;
  if (!days || date < item.startsOn || (item.endsOn && date > item.endsOn)) return null;
  return daysBetween(item.startsOn, date) % days;
}

/** One date's groups to tick: the workout day for that date, or every meal of a diet chart (null outside the plan). */
export function groupsOn(item: Pick<MyPlanItem, "content" | "startsOn" | "endsOn">, date: string): { key: string; name: Bilingual; time?: string | null; refs: string[] }[] | null {
  const index = dayIndexFor(item, date);
  if (index === null) return null;
  if (item.content.kind === "diet") return item.content.meals.map((m) => ({ key: m.ref, name: m.name, time: m.time, refs: m.items.map((i) => i.ref) }));
  const day = item.content.days[index];
  return day ? [{ key: day.key, name: day.name, refs: day.items.map((i) => i.ref) }] : null;
}

/** Done out of total for one date (for the progress line). */
export function progressOn(refs: readonly string[], ticks: ReadonlyMap<string, { done: boolean }>, date: string): { done: number; total: number } {
  return { done: refs.filter((r) => ticks.get(tickKey(date, r))?.done).length, total: refs.length };
}

/** Today's plans first: active ones that run today (workouts, then diets), then the rest in the API's order. */
export function todayFirst<T extends Pick<MyPlanItem, "kind" | "todayIndex" | "readOnly">>(items: readonly T[]): T[] {
  const rank = (x: T) => (!x.readOnly && x.todayIndex !== null ? (x.kind === "workout" ? 0 : 1) : 2);
  return items.map((x, i) => ({ x, i })).sort((a, b) => rank(a.x) - rank(b.x) || a.i - b.i).map((v) => v.x);
}

// ---------------- the entrance QR (M24-FR-51)

/** The link the entrance tablet shows as a QR: a phone's own camera opens /me/checkin and checks in. */
export const entranceLink = (origin: string, token: string) => `${origin.replace(/\/$/, "")}/me/checkin?e=${encodeURIComponent(token)}`;

/** An entrance token from a scanned or pasted value: the bare token, or the link above. Null for anything else. */
export function entranceTokenFrom(text: string): string | null {
  const v = text.trim();
  const ok = (t: string | null) => (t && /^v1\.ge\.[^.\s]+\.\d{1,12}\.[^.\s]+$/.test(t) ? t : null);
  if (ok(v)) return v;
  try {
    return ok(new URL(v).searchParams.get("e"));
  } catch {
    return null;
  }
}
