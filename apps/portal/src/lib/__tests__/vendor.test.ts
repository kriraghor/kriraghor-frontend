import { describe, expect, it } from "vitest";
import { dhakaIso, fullWeek, halfHours, nextActions, nextDays, toPoisha } from "../vendor/grounds";

describe("vendor grounds helpers (M09)", () => {
  it("reads taka as poisha", () => {
    expect(toPoisha("2400")).toBe(240000);
    expect(toPoisha("2400.5")).toBe(240050);
    expect(toPoisha("abc")).toBeNull();
  });

  it("builds the hours grid and the default week", () => {
    expect(halfHours("06:00", "07:30")).toEqual(["06:00", "06:30", "07:00", "07:30"]);
    expect(fullWeek()).toHaveLength(7);
    expect(fullWeek()[5]).toEqual({ dow: 5, isClosed: false, openTime: "06:00", closeTime: "23:00" });
  });

  it("Dhaka dates and instants", () => {
    expect(dhakaIso("2026-10-19", "18:00")).toBe("2026-10-19T12:00:00.000Z");
    expect(nextDays(3, new Date("2026-10-18T19:00:00Z"))).toEqual(["2026-10-19", "2026-10-20", "2026-10-21"]);
  });

  it("offers the actions the ground's state allows", () => {
    expect(nextActions("draft", null)).toEqual(["edit", "submit"]);
    expect(nextActions("pending_review", null)).toEqual(["withdraw"]);
    expect(nextActions("live", null)).toEqual(["edit", "pause"]);
    expect(nextActions("live", "draft")).toEqual(["edit", "submit_edit", "pause"]);
    expect(nextActions("live", "pending_review")).toEqual(["withdraw", "pause"]);
    expect(nextActions("paused", "changes_requested")).toEqual(["edit", "submit_edit", "resume"]);
    expect(nextActions("rejected", null)).toEqual([]);
  });
});

import { diffLines } from "../admin/grounds";

describe("review diff lines (M09)", () => {
  const label = (k: string, v?: Record<string, string | number>) => `${k}${v ? ` ${JSON.stringify(v)}` : ""}`;
  it("first reviews, field changes, courts and photos", () => {
    expect(diffLines(undefined, label)).toEqual([]);
    expect(diffLines({ first: true, fields: [], courts: [], photos: { added: 3, removed: 0 } }, label)).toEqual(['diff.first {"photos":3}']);
    expect(
      diffLines(
        { first: false, fields: [{ field: "name", from: "A", to: "B" }, { field: "lat", from: null, to: 23.7 }], courts: [{ id: "c", name: "C1", change: "changed", fields: ["sizeText"] }, { id: "d", name: "C2", change: "added" }], photos: { added: 1, removed: 2 } },
        label
      )
    ).toEqual([
      'diff.field {"field":"name","from":"A","to":"B"}',
      'diff.field {"field":"lat","from":"–","to":"23.7"}',
      'diff.court_changed {"name":"C1","fields":"sizeText"}',
      'diff.court_added {"name":"C2","fields":""}',
      'diff.photosAdded {"n":1}',
      'diff.photosRemoved {"n":2}',
    ]);
  });
});
