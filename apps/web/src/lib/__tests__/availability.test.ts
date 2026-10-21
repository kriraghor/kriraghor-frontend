import { describe, expect, it } from "vitest";
import {
  addDays,
  buildWeek,
  cellsOf,
  clock,
  dayBusy,
  dhakaDayOf,
  dhakaMidnight,
  lastWeekIndex,
  planSave,
  ruleBody,
  rulesOf,
  runsOf,
  saveErrorOf,
  startingIn,
  toggleCell,
  weekdayOf,
  weekFirstDay,
  weekRange,
  type Calendar,
  type Repeat,
} from "../availability";

// M11 FR-05, FR-14 (Round B1): the availability week on the Dhaka clock.
// The week of Wed 21 Oct 2026: cell 0 is 21 Oct 00:00 Dhaka (20 Oct 18:00 UTC); cell 24 is 22 Oct 00:00.
const FIRST = "2026-10-21";
const NOW = Date.parse("2026-10-21T04:30:00.000Z"); // 10:30 Dhaka: cells 0–9 are past
const A = { id: "a", start: "2026-10-21T12:30:00.000Z", end: "2026-10-21T14:00:00.000Z", reason: "Class" }; // 18:30–20:00 → cells 18, 19
const B = { id: "b", start: "2026-10-22T02:00:00.000Z", end: "2026-10-22T04:00:00.000Z", reason: null }; // 22 Oct 08:00–10:00 → 32, 33
const C = { id: "c", start: "2026-10-20T16:00:00.000Z", end: "2026-10-20T20:00:00.000Z", reason: null }; // from 20 Oct 22:00 → cells 0, 1 (before the week)
const D = { id: "d", start: "2026-10-27T16:00:00.000Z", end: "2026-10-27T20:00:00.000Z", reason: "Trip" }; // 27 Oct 22:00 → 28 Oct 02:00: cells 166, 167, then past the week
const REPEAT: Repeat = { id: "r1", weekdays: [5, 1], from: "18:00", to: "20:00", validFrom: "2026-10-20T18:00:00.000Z", reason: null };
const DATA: Pick<Calendar, "blocks" | "spans" | "booked" | "horizonEnd"> = {
  blocks: [A, B, C, D],
  spans: [
    { start: A.start, end: A.end, reason: "Class", blockId: "a", repeat: false },
    { start: "2026-10-23T12:00:00.000Z", end: "2026-10-23T14:00:00.000Z", reason: null, blockId: "r1", repeat: true }, // Fri 18:00–20:00 → 66, 67
  ],
  booked: [{ start: "2026-10-24T09:00:00.000Z", end: "2026-10-24T11:00:00.000Z", jobId: "j1", code: "HJ-1", status: "scheduled", locked: true }], // Sat 15:00–17:00 → 87, 88
  horizonEnd: "2026-12-20T18:00:00.000Z",
};
const week = () => buildWeek(FIRST, DATA, NOW);
const iso = (cell: number) => new Date(dhakaMidnight(FIRST) + cell * 3600000).toISOString();

describe("availability: Dhaka days and weeks", () => {
  it("maps days and weeks on the Dhaka clock", () => {
    expect(dhakaMidnight(FIRST)).toBe(Date.parse("2026-10-20T18:00:00.000Z"));
    expect(dhakaDayOf("2026-10-20T18:00:00.000Z")).toBe("2026-10-21");
    expect(dhakaDayOf("2026-10-20T17:59:59.000Z")).toBe("2026-10-20");
    expect(addDays("2026-10-30", 2)).toBe("2026-11-01");
    expect(weekdayOf("2026-10-21")).toBe(3);
    expect(weekFirstDay("2026-10-21", 2)).toBe("2026-11-04");
    expect(weekRange(FIRST)).toEqual({ from: "2026-10-20T18:00:00.000Z", to: "2026-10-27T18:00:00.000Z" });
    // 60 days ahead: weeks 0–8 (week 8 starts on day 56).
    expect(lastWeekIndex(60)).toBe(8);
    expect(lastWeekIndex(7)).toBe(1);
    expect(lastWeekIndex(-1)).toBe(0);
  });

  it("finds the cells a span covers, clipped to the grid", () => {
    const from = dhakaMidnight(FIRST);
    expect(cellsOf(A, from, 168)).toEqual([18, 19]);
    expect(cellsOf(C, from, 168)).toEqual([0, 1]);
    expect(cellsOf(D, from, 168)).toEqual([166, 167]);
    expect(cellsOf({ start: from + 3600000, end: from + 3600000 }, from, 168)).toEqual([]);
  });
});

describe("availability: the week grid", () => {
  it("marks blocked hours and locks booked jobs, repeats, outside blocks, past hours and the horizon", () => {
    const w = week();
    expect(w.days).toHaveLength(7);
    expect(w.days[6]).toBe("2026-10-27");
    expect([...w.initial].sort((a, b) => a - b)).toEqual([0, 1, 18, 19, 32, 33, 166, 167]);
    expect(w.inWeek.map((b) => b.id)).toEqual(["a", "b"]);
    expect(w.carried.map((b) => b.id)).toEqual(["d"]);
    expect(w.locks[0]).toBe("outside"); // C wins over "past"
    expect(w.locks[5]).toBe("past");
    expect(w.locks[9]).toBe("past");
    expect(w.locks[10]).toBeNull(); // 10:00–11:00 is still going on at 10:30
    expect(w.locks[18]).toBeNull();
    expect(w.locks[66]).toBe("repeat");
    expect(w.locks[87]).toBe("booked");
    expect(w.jobAt[87]).toBe("HJ-1");
    expect(w.jobAt[86]).toBeNull();
    expect(w.locks[166]).toBe("outside");
    expect(w.to).toBe(Date.parse("2026-10-27T18:00:00.000Z"));
  });

  it("locks the days past the horizon and ends the range there", () => {
    const w = buildWeek(FIRST, { ...DATA, blocks: [], horizonEnd: "2026-10-25T18:00:00.000Z" }, NOW); // 26 Oct 00:00
    expect(w.locks[119]).toBeNull();
    expect(w.locks[120]).toBe("horizon");
    expect(w.to).toBe(Date.parse("2026-10-25T18:00:00.000Z"));
  });

  it("toggles one hour, paints a state, and never changes a locked hour", () => {
    const w = week();
    const s = new Set(w.initial);
    expect(toggleCell(s, w, 20).has(20)).toBe(true);
    expect(toggleCell(s, w, 18).has(18)).toBe(false);
    expect(toggleCell(s, w, 20, true).has(20)).toBe(true);
    expect(toggleCell(s, w, 20, false)).toBe(s); // already off
    expect(toggleCell(s, w, 18, true)).toBe(s); // already on
    expect(toggleCell(s, w, 87)).toBe(s); // booked
    expect(toggleCell(s, w, 3)).toBe(s); // past
    expect(toggleCell(s, w, -1)).toBe(s);
    expect(toggleCell(s, w, 168)).toBe(s);
  });

  it("joins hours into runs, never across midnight or a change of key", () => {
    expect(runsOf([3, 1, 2, 2, 7])).toEqual([
      [1, 4],
      [7, 8],
    ]);
    expect(runsOf([22, 23, 24, 25])).toEqual([
      [22, 24],
      [24, 26],
    ]);
    expect(runsOf([1, 2, 3], (c) => (c < 3 ? "x" : "y"))).toEqual([
      [1, 3],
      [3, 4],
    ]);
    expect(runsOf([])).toEqual([]);
  });

  it("turns runs into weekly rules, one per time with every weekday", () => {
    const w = week();
    // Wed 20:00–22:00, Thu 20:00–22:00, Wed 23:00–24:00 (sent as "24:00").
    expect(rulesOf([[20, 22], [44, 46], [23, 24], [20, 22]], w, { until: "2026-11-30", reason: "Gym" })).toEqual([
      { weekdays: [3, 4], from: "20:00", to: "22:00", until: "2026-11-30", reason: "Gym" },
      { weekdays: [3], from: "23:00", to: "24:00", until: "2026-11-30", reason: "Gym" },
    ]);
    expect(rulesOf([[0, 1]], w, { until: null })).toEqual([{ weekdays: [3], from: "00:00", to: "01:00" }]);
    expect(ruleBody(REPEAT)).toEqual({ weekdays: [1, 5], from: "18:00", to: "20:00" });
    expect(ruleBody({ ...REPEAT, until: "2026-12-01", reason: "Training" })).toEqual({ weekdays: [1, 5], from: "18:00", to: "20:00", until: "2026-12-01", reason: "Training" });
  });
});

describe("availability: saving the week", () => {
  it("sends every stored block as it is when nothing changed (not dirty)", () => {
    const w = week();
    const p = planSave(w, new Set(w.initial), { repeats: [REPEAT] });
    expect(p.dirty).toBe(false);
    expect(p.repeatsChanged).toBe(false);
    expect(p.body).toEqual({
      from: "2026-10-20T18:00:00.000Z",
      // The block that runs past the week grows the range.
      to: D.end,
      blocks: [
        { start: A.start, end: A.end, reason: "Class" },
        { start: B.start, end: B.end },
        { start: D.start, end: D.end, reason: "Trip" },
      ],
    });
    expect(planSave(w, new Set(w.initial)).dirty).toBe(false);
  });

  it("adds hours as whole-hour blocks with the new reason, next to the kept ones", () => {
    const w = week();
    const p = planSave(w, new Set([...w.initial, 20, 21]), { reason: "  Gym " });
    expect(p.dirty).toBe(true);
    expect(p.body.blocks).toContainEqual({ start: iso(20), end: iso(22), reason: "Gym" });
    expect(p.body.blocks).toContainEqual({ start: A.start, end: A.end, reason: "Class" });
    expect(p.body.repeats).toBeUndefined();
    // Without a reason, none is sent.
    expect(planSave(w, new Set([...w.initial, 40])).body.blocks).toContainEqual({ start: iso(40), end: iso(41) });
  });

  it("drops a block with an hour freed and keeps its other hours with its reason", () => {
    const w = week();
    const s = new Set(w.initial);
    s.delete(19);
    s.delete(32);
    const p = planSave(w, s, { reason: "New" });
    expect(p.dirty).toBe(true);
    expect(p.body.blocks).toEqual([
      { start: iso(18), end: iso(19), reason: "Class" },
      { start: iso(33), end: iso(34) },
      { start: D.start, end: D.end, reason: "Trip" },
    ]);
  });

  it("never re-sends the hours of a block that started before the week, nor hours past the horizon", () => {
    const w = buildWeek(FIRST, { ...DATA, blocks: [C], horizonEnd: "2026-10-25T18:00:00.000Z" }, NOW);
    const p = planSave(w, new Set([...w.initial, 130]));
    expect(p.body.blocks).toEqual([]);
    expect(p.body.to).toBe("2026-10-25T18:00:00.000Z");
    expect(p.dirty).toBe(true);
  });

  it("saves the added hours as weekly repeats, keeping the stored repeats", () => {
    const w = week();
    const s = new Set(w.initial);
    s.delete(19); // A's 18:00 hour stays a one-off block
    for (const c of [20, 21, 44, 45]) s.add(c);
    const p = planSave(w, s, { repeat: true, until: "2026-11-30", reason: "Gym", repeats: [REPEAT] });
    expect(p.repeatsChanged).toBe(true);
    expect(p.body.blocks).toEqual([
      { start: iso(18), end: iso(19), reason: "Class" },
      { start: B.start, end: B.end },
      { start: D.start, end: D.end, reason: "Trip" },
    ]);
    expect(p.body.repeats).toEqual([
      { weekdays: [1, 5], from: "18:00", to: "20:00" },
      { weekdays: [3, 4], from: "20:00", to: "22:00", until: "2026-11-30", reason: "Gym" },
    ]);
    // Repeat on with nothing added: the repeats are not sent.
    expect(planSave(w, new Set(w.initial), { repeat: true, repeats: [REPEAT] }).body.repeats).toBeUndefined();
  });

  it("sends the repeats without the removed ones, even when no hour changed", () => {
    const w = week();
    const p = planSave(w, new Set(w.initial), { repeats: [REPEAT, { ...REPEAT, id: "r2", weekdays: [0] }], removedRepeats: new Set(["r1", "gone"]) });
    expect(p.dirty).toBe(true);
    expect(p.body.repeats).toEqual([{ weekdays: [0], from: "18:00", to: "20:00" }]);
    expect(planSave(w, new Set(w.initial), { repeats: [REPEAT], removedRepeats: new Set(["gone"]) }).repeatsChanged).toBe(false);
  });

  it("carries the blocks after the week that a grown range covers", () => {
    const w = week();
    const E = { id: "e", start: "2026-10-27T21:00:00.000Z", end: "2026-10-27T23:00:00.000Z", reason: null };
    const p = planSave(w, new Set(w.initial), { carry: [E] });
    expect(p.body.to).toBe(E.end);
    expect(p.body.blocks.at(-1)).toEqual({ start: E.start, end: E.end });
    const later = { ...E, id: "f", start: "2026-10-28T05:00:00.000Z" };
    expect(startingIn([E, later, A], Date.parse(D.start), Date.parse("2026-10-28T00:00:00.000Z")).map((b) => b.id)).toEqual(["e"]);
  });
});

describe("availability: errors in plain words", () => {
  const v = (field: string, message = "x") => ({ code: "VALIDATION_FAILED", status: 422, title: "Some fields are invalid", errors: [{ field, message }] });
  it("maps the save's problems", () => {
    expect(saveErrorOf(new Error("network"))).toBeNull();
    expect(saveErrorOf({ code: "BLOCK_OVER_JOB", status: 409, title: "t", jobs: ["HJ-1", "HJ-2"] })).toEqual({ key: "overJob", jobs: "HJ-1, HJ-2" });
    expect(saveErrorOf({ code: "BLOCK_OVER_JOB", status: 409, title: "t" })).toEqual({ key: "overJob", jobs: "" });
    expect(saveErrorOf({ code: "RATE_LIMITED", status: 429, title: "t" })).toBeNull();
    expect(saveErrorOf({ code: "VALIDATION_FAILED", status: 422, title: "t" })).toEqual({ key: "invalid" });
    expect(saveErrorOf(v("to", "At most 60 days ahead"))).toEqual({ key: "horizon" });
    expect(saveErrorOf(v("from"))).toEqual({ key: "past" });
    expect(saveErrorOf(v("blocks[2]", "Blocks overlap"))).toEqual({ key: "overlap" });
    expect(saveErrorOf(v("blocks[0]", "Keep blocks inside the range"))).toEqual({ key: "blocks" });
    expect(saveErrorOf(v("repeats[1]"))).toEqual({ key: "repeats" });
    expect(saveErrorOf(v("reason"))).toEqual({ key: "invalid" });
  });
});

describe("availability: the public busy strip", () => {
  it("clips busy spans to the Dhaka day, merges them, and drops other days", () => {
    const day = "2026-10-22";
    const busy = [
      { start: "2026-10-21T16:00:00.000Z", end: "2026-10-21T20:00:00.000Z" }, // 21 Oct 22:00 → 22 Oct 02:00
      { start: "2026-10-22T12:00:00.000Z", end: "2026-10-22T14:00:00.000Z" }, // 18:00–20:00
      { start: "2026-10-22T13:30:00.000Z", end: "2026-10-22T15:00:00.000Z" }, // 19:30–21:00 (overlaps)
      { start: "2026-10-24T12:00:00.000Z", end: "2026-10-24T14:00:00.000Z" }, // another day
    ];
    expect(dayBusy(busy, day)).toEqual([
      { from: 0, to: 120 },
      { from: 1080, to: 1260 },
    ]);
    expect(dayBusy([{ start: "2026-10-21T18:00:00.000Z", end: "2026-10-22T18:00:00.000Z" }], day)).toEqual([{ from: 0, to: 1440 }]);
    expect(dayBusy([], day)).toEqual([]);
    expect(clock(0)).toBe("00:00");
    expect(clock(1110)).toBe("18:30");
    expect(clock(1440)).toBe("24:00");
  });
});
