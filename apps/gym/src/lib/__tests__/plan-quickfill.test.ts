import { describe, expect, it } from "vitest";
import { exerciseFrom, itemsOf, normaliseTime, quickFill, sections } from "../plan-quickfill";
import { blankExercise, MAX_DAYS, MAX_ITEMS, refsIn } from "../plans";

// Tester feedback, 28 Nov 2026: type a plan as text and the form fills itself.
describe("quick fill", () => {
  it("reads a diet chart written on one line, as the owner typed it", () => {
    const r = quickFill("diet", "breakfast: two eggs, almonds, lunch: rice, fish curry and salad");
    expect(r.content.kind).toBe("diet");
    if (r.content.kind !== "diet") return;
    expect(r.content.meals.map((m) => m.name.en)).toEqual(["breakfast", "lunch"]);
    expect(r.content.meals[0]!.items.map((f) => f.name.en)).toEqual(["two eggs", "almonds"]);
    expect(r.content.meals[1]!.items.map((f) => f.name.en)).toEqual(["rice", "fish curry", "salad"]);
    expect(r).toMatchObject({ groups: 2, items: 5, cut: false });
  });

  it("takes a time in brackets, one meal per line, and Bangla into the Bangla name", () => {
    const r = quickFill("diet", "Breakfast (8:00): oats\nসকাল (৭.৩০ pm): ডিম, বাদাম।\n- Dinner (9:15 pm): roti");
    if (r.content.kind !== "diet") throw new Error("diet");
    expect(r.content.meals.map((m) => m.time)).toEqual(["08:00", "19:30", "21:15"]);
    expect(r.content.meals[1]!.name).toEqual({ en: "", bn: "সকাল" });
    expect(r.content.meals[1]!.items.map((f) => f.name.bn)).toEqual(["ডিম", "বাদাম"]);
  });

  it("keeps the diet chart's notes and gives every row its own ref", () => {
    const r = quickFill("diet", "Lunch: rice, dal", { kind: "diet", meals: [], notes: { en: "Drink water" } });
    if (r.content.kind !== "diet") throw new Error("diet");
    expect(r.content.notes).toEqual({ en: "Drink water" });
    const refs = [...refsIn(r.content)];
    expect(new Set(refs).size).toBe(refs.length);
  });

  it("without headings, everything is one meal or one day; empty text gives one empty group", () => {
    const d = quickFill("diet", "eggs, milk");
    if (d.content.kind !== "diet") throw new Error("diet");
    expect(d.content.meals).toHaveLength(1);
    expect(d.content.meals[0]!.name.en).toBe("Meal");
    const w = quickFill("workout", "  ");
    if (w.content.kind !== "workout") throw new Error("workout");
    expect(w.content.days).toHaveLength(1);
    expect(w.groups).toBe(0);
    const w2 = quickFill("workout", "Pushups 3x15");
    if (w2.content.kind !== "workout") throw new Error("workout");
    expect(w2.content.days[0]!.name.en).toBe("Day 1");
  });

  it("reads sets, reps, times and rest in a workout", () => {
    const r = quickFill("workout", "Day 1: Bench press 3x10, Squat 4×8 rest 90s\nDay 2 – Legs: Plank 3x45s, Run 20 min, Stretch");
    if (r.content.kind !== "workout") throw new Error("workout");
    const [d1, d2] = r.content.days;
    expect(d1!.name.en).toBe("Day 1");
    expect(d1!.items[0]).toMatchObject({ name: { en: "Bench press" }, sets: 3, reps: "10", timeSec: null });
    expect(d1!.items[1]).toMatchObject({ name: { en: "Squat" }, sets: 4, reps: "8", restSec: 90 });
    expect(d2!.name.en).toBe("Day 2 – Legs");
    expect(d2!.items[0]).toMatchObject({ name: { en: "Plank" }, sets: 3, reps: null, timeSec: 45 });
    expect(d2!.items[1]).toMatchObject({ name: { en: "Run" }, sets: null, timeSec: 1200 });
    expect(d2!.items[2]).toMatchObject({ name: { en: "Stretch" }, sets: null, reps: null, timeSec: null });
  });

  it("stops at the limits and says so", () => {
    const days = Array.from({ length: MAX_DAYS + 2 }, (_, i) => `Day ${i + 1}: squat`).join("\n");
    const r = quickFill("workout", days);
    if (r.content.kind !== "workout") throw new Error("workout");
    expect(r.content.days).toHaveLength(MAX_DAYS);
    expect(r.cut).toBe(true);
    const many = quickFill("diet", `Lunch: ${Array.from({ length: MAX_ITEMS + 5 }, (_, i) => `f${i}`).join(", ")}`);
    if (many.content.kind !== "diet") throw new Error("diet");
    expect(many.content.meals[0]!.items).toHaveLength(MAX_ITEMS);
    expect(many.cut).toBe(true);
    const meals = quickFill("diet", Array.from({ length: 14 }, (_, i) => `M${i}: x`).join("\n"));
    expect(meals.cut).toBe(true);
  });

  it("helpers: times, sections and items", () => {
    expect(normaliseTime("12:30 am")).toBe("00:30");
    expect(normaliseTime("12.05 pm")).toBe("12:05");
    expect(normaliseTime("25:00")).toBeNull();
    expect(normaliseTime(undefined)).toBeNull();
    expect(sections("intro, Lunch: rice")).toEqual([
      { title: "", time: null, body: "intro," },
      { title: "Lunch", time: null, body: " rice" },
    ]);
    expect(sections("")).toEqual([]);
    expect(itemsOf("• eggs; milk.\n* bread এবং মধু")).toEqual(["eggs", "milk", "bread", "মধু"]);
    expect(exerciseFrom("Cycle 2 m", blankExercise(new Set())).timeSec).toBe(120);
    expect(exerciseFrom("3x10", blankExercise(new Set())).name.en).toBe("3x10");
  });
});
