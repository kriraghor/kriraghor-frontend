import { describe, expect, it } from "vitest";
import type { DietContent, PlanContent, WorkoutContent } from "../gym-manage";
import {
  blankContent,
  blankDay,
  blankExercise,
  cleanContent,
  dayIndexFor,
  entranceLink,
  entranceTokenFrom,
  groupsOn,
  itemCount,
  latestTicks,
  move,
  newRef,
  planProblems,
  progressOn,
  refsIn,
  textOf,
  tickKey,
  todayFirst,
} from "../plans";

const workout = (): WorkoutContent => ({
  kind: "workout",
  days: [
    { key: "d1", name: { en: "Push", bn: "পুশ" }, items: [{ ref: "x1", name: { en: "Bench press" }, sets: 3, reps: "8-10" }, { ref: "x2", name: { bn: "ডিপস" } }] },
    { key: "d2", name: { en: "Pull" }, items: [{ ref: "x3", name: { en: "Rows" } }] },
  ],
});
const diet = (): DietContent => ({
  kind: "diet",
  meals: [
    { ref: "m1", name: { en: "Breakfast", bn: "সকালের নাস্তা" }, time: "08:00", items: [{ ref: "f1", name: { en: "Ruti", bn: "রুটি" }, portion: "2 pieces" }] },
    { ref: "m2", name: { bn: "দুপুরের খাবার" }, items: [{ ref: "f2", name: { en: "Rice and dal" } }, { ref: "f3", name: { en: "Fish curry" } }] },
  ],
  notes: null,
});

describe("plan refs stay attached across versions (M24 §6.10)", () => {
  it("collects every day key, meal ref and item ref", () => {
    expect([...refsIn(workout())]).toEqual(["d1", "x1", "x2", "d2", "x3"]);
    expect([...refsIn(diet())]).toEqual(["m1", "f1", "m2", "f2", "f3"]);
  });

  it("makes a new ref that is not used yet", () => {
    expect(newRef("x", new Set())).toBe("x1");
    expect(newRef("x", new Set(["x1", "x2", "x4"]))).toBe("x3");
    const used = refsIn(workout());
    expect(blankExercise(used).ref).toBe("x4");
    expect(blankDay(used).key).toBe("d3");
  });

  it("starts a plan with one empty day or one empty meal", () => {
    expect(blankContent("workout")).toEqual({ kind: "workout", days: [{ key: "d1", name: { en: "", bn: "" }, items: [] }] });
    const d = blankContent("diet");
    expect(d.kind === "diet" && d.meals.length).toBe(1);
  });
});

describe("plan editor checks (M24-FR-62)", () => {
  it("accepts a good workout and a good diet chart", () => {
    expect(planProblems(workout())).toEqual([]);
    expect(planProblems(diet())).toEqual([]);
  });

  it("needs at least one day or meal, at most 7 days and 12 meals", () => {
    expect(planProblems({ kind: "workout", days: [] })).toEqual([{ path: "days", code: "no_groups" }]);
    expect(planProblems({ kind: "diet", meals: [] })).toEqual([{ path: "meals", code: "no_groups" }]);
    const used = new Set<string>();
    const days = Array.from({ length: 8 }, () => {
      const d = { ...blankDay(used), name: { en: "Day" } };
      used.add(d.key);
      return d;
    });
    expect(planProblems({ kind: "workout", days }).map((p) => p.code)).toContain("too_many_groups");
    const meals = Array.from({ length: 3 }, (_, i) => ({ ref: `m${i}`, name: { en: "Meal" }, items: [] }));
    expect(planProblems({ kind: "diet", meals }, { maxMeals: 2 })).toEqual([{ path: "meals", code: "too_many_groups" }]);
  });

  it("caps items per day or meal at the live limit", () => {
    const c = workout();
    expect(planProblems(c, { maxItems: 1 })).toEqual([{ path: "days[0].items", code: "too_many_items" }]);
    const d = diet();
    expect(planProblems(d, { maxItems: 1 })).toEqual([{ path: "meals[1].items", code: "too_many_items" }]);
  });

  it("needs a name in English or Bangla", () => {
    const c = workout();
    c.days[0].items[0].name = { en: " ", bn: "" };
    c.days[1].name = {};
    expect(planProblems(c)).toEqual([
      { path: "days[0].items[0].name", code: "no_name" },
      { path: "days[1].name", code: "no_name" },
    ]);
  });

  it("refuses repeated or malformed refs, plain http videos and bad meal times", () => {
    const c = workout();
    c.days[1].items[0].ref = "x1";
    c.days[0].items[1].ref = "bad ref";
    c.days[0].items[0].videoUrl = "http://youtube.com/watch?v=1";
    expect(planProblems(c).map((p) => p.code).sort()).toEqual(["bad_ref", "bad_video", "duplicate_ref"]);
    const ok = workout();
    ok.days[0].items[0].videoUrl = "https://youtu.be/abc";
    expect(planProblems(ok)).toEqual([]);
    ok.days[0].items[0].videoUrl = "not a link";
    expect(planProblems(ok)).toEqual([{ path: "days[0].items[0].videoUrl", code: "bad_video" }]);
    const d = diet();
    d.meals[0].time = "25:00";
    d.meals[1].items[0].ref = "m1";
    expect(planProblems(d)).toEqual([
      { path: "meals[0].time", code: "bad_time" },
      { path: "meals[1].items[0]", code: "duplicate_ref" },
    ]);
  });

  it("sends trimmed text and blank optional text as null", () => {
    const c = workout();
    c.days[0].name = { en: "  Push ", bn: "" };
    c.days[0].items[0].reps = " ";
    c.days[0].items[0].videoUrl = "";
    const out = cleanContent(c) as WorkoutContent;
    expect(out.days[0].name).toEqual({ en: "Push", bn: null });
    expect(out.days[0].items[0].reps).toBeNull();
    expect(out.days[0].items[0].videoUrl).toBeNull();
    const d = diet();
    d.notes = { en: " ", bn: null };
    d.meals[0].items[0].portion = " 2 pieces ";
    const dd = cleanContent(d) as DietContent;
    expect(dd.notes).toBeNull();
    expect(dd.meals[0].items[0].portion).toBe("2 pieces");
    expect(dd.meals[1].time).toBeNull();
    const withNotes = diet();
    withNotes.notes = { en: "Drink water", bn: "" };
    expect((cleanContent(withNotes) as DietContent).notes).toEqual({ en: "Drink water", bn: null });
  });

  it("moves rows and counts items", () => {
    expect(move(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(move(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(move(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(move(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    expect(itemCount(workout())).toBe(3);
    expect(itemCount(diet())).toBe(3);
  });
});

describe("the member's plan (M24-FR-64 to FR-69)", () => {
  it("reads the plan in my language, else the other one", () => {
    expect(textOf({ en: "Push", bn: "পুশ" }, "bn")).toBe("পুশ");
    expect(textOf({ en: "Push", bn: null }, "bn")).toBe("Push");
    expect(textOf({ bn: "ডিপস" }, "en")).toBe("ডিপস");
    expect(textOf(null, "en")).toBe("");
  });

  it("repeats the workout days from the start date and runs a diet every day", () => {
    const w = { content: workout() as PlanContent, startsOn: "2026-10-26", endsOn: "2026-11-30" };
    expect(dayIndexFor(w, "2026-10-26")).toBe(0);
    expect(dayIndexFor(w, "2026-10-27")).toBe(1);
    expect(dayIndexFor(w, "2026-10-28")).toBe(0);
    expect(dayIndexFor(w, "2026-10-25")).toBeNull();
    expect(dayIndexFor(w, "2026-12-01")).toBeNull();
    expect(groupsOn(w, "2026-10-27")).toEqual([{ key: "d2", name: { en: "Pull" }, refs: ["x3"] }]);
    expect(groupsOn(w, "2026-10-01")).toBeNull();
    const d = { content: diet() as PlanContent, startsOn: "2026-10-26", endsOn: null };
    expect(dayIndexFor(d, "2027-01-01")).toBe(0);
    expect(groupsOn(d, "2026-10-28")?.map((g) => g.refs)).toEqual([["f1"], ["f2", "f3"]]);
    expect(groupsOn(d, "2026-10-25")).toBeNull();
    expect(dayIndexFor({ content: { kind: "workout", days: [] }, startsOn: "2026-10-26", endsOn: null }, "2026-10-26")).toBeNull();
  });

  it("keeps the latest tick per item and date and counts progress", () => {
    const ticks = latestTicks([
      { localDate: "2026-10-28", itemRef: "x1", done: false, note: null },
      { localDate: "2026-10-28", itemRef: "x1", done: true, note: "heavy" },
      { localDate: "2026-10-28", itemRef: "x2", done: true, note: null },
      { localDate: "2026-10-27", itemRef: "x1", done: true, note: null },
    ]);
    expect(ticks.get(tickKey("2026-10-28", "x1"))).toEqual({ done: false, note: null });
    expect(ticks.get(tickKey("2026-10-27", "x1"))?.done).toBe(true);
    expect(progressOn(["x1", "x2"], ticks, "2026-10-28")).toEqual({ done: 1, total: 2 });
  });

  it("puts today's workout, then today's diet, before the rest", () => {
    const items = [
      { id: "old", kind: "workout" as const, todayIndex: 0, readOnly: true },
      { id: "diet", kind: "diet" as const, todayIndex: 0, readOnly: false },
      { id: "later", kind: "workout" as const, todayIndex: null, readOnly: false },
      { id: "work", kind: "workout" as const, todayIndex: 1, readOnly: false },
    ];
    expect(todayFirst(items).map((x) => x.id)).toEqual(["work", "diet", "old", "later"]);
  });
});

describe("the entrance QR (M24-FR-51)", () => {
  const token = "v1.ge.6f1c1a7e-1b52-4c34-9d0e-3c0d9b1a2f10.59612345.abcdefABCDEF0123456789_-abcdefgh";

  it("puts the token in a link a phone camera opens", () => {
    expect(entranceLink("https://gym.kriraghor.com/", token)).toBe(`https://gym.kriraghor.com/me/checkin?e=${encodeURIComponent(token)}`);
  });

  it("reads the token from the link or as it is, nothing else", () => {
    expect(entranceTokenFrom(token)).toBe(token);
    expect(entranceTokenFrom(` ${entranceLink("https://gym.kriraghor.com", token)} `)).toBe(token);
    expect(entranceTokenFrom("v1.gm.member.token.sig")).toBeNull();
    expect(entranceTokenFrom("https://gym.kriraghor.com/me/checkin?e=nope")).toBeNull();
    expect(entranceTokenFrom("https://gym.kriraghor.com/me/checkin")).toBeNull();
    expect(entranceTokenFrom("hello")).toBeNull();
  });
});
