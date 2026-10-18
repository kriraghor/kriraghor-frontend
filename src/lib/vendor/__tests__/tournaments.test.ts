import { describe, expect, it } from "vitest";
import { fromLocalInput, oversToBalls, presetValues, resultBody, toLocalInput, type SportRules } from "../tournaments";

const rules = {
  sport: { id: "s", key: "badminton", nameEn: "Badminton", nameBn: "ব্যাডমিন্টন", engine: "rally", defaultTiebreakers: [] },
  version: 1,
  fields: [
    { key: "bestOf", type: "enum", default: "3", group: "match", en: "Games", bn: "গেম", options: [] },
    { key: "points", type: "int", min: 11, max: 21, default: 21, group: "match", en: "Points", bn: "পয়েন্ট" },
  ],
  presets: [{ key: "b1x21", en: "1 game", bn: "১ গেম", values: { bestOf: "1" } }],
  tiebreakers: ["points"],
} as unknown as SportRules;

const empty = { a: "", b: "", aw: "", bw: "", ab: "", bb: "", pa: "", pb: "", sets: "", decider: "" };

describe("sports console helpers (M14)", () => {
  it("builds rule values from defaults and a preset", () => {
    expect(presetValues(rules, null)).toEqual({ bestOf: "3", points: 21 });
    expect(presetValues(rules, "b1x21")).toEqual({ bestOf: "1", points: 21 });
    expect(presetValues(rules, "nope")).toEqual({ bestOf: "3", points: 21 });
  });

  it("builds result bodies per engine", () => {
    expect(resultBody("rally", { ...empty, sets: "21-15, 19:21; 21-17" })).toEqual({ sets: [[21, 15], [19, 21], [21, 17]] });
    expect(resultBody("ball_by_ball", { ...empty, a: "160", aw: "5", ab: "120", b: "150", bw: "10", bb: "110", decider: "" })).toEqual({ a: { runs: 160, wickets: 5, balls: 120 }, b: { runs: 150, wickets: 10, balls: 110 } });
    expect(resultBody("ball_by_ball", { ...empty, a: "150", aw: "5", ab: "120", b: "150", bw: "9", bb: "120", decider: "b" })).toMatchObject({ decider: "b" });
    expect(resultBody("clock", { ...empty, a: "1", b: "1", pa: "4", pb: "3" })).toEqual({ a: { score: 1 }, b: { score: 1 }, pens: { a: 4, b: 3 } });
    expect(resultBody("clock", { ...empty, a: "2", b: "" })).toEqual({ a: { score: 2 }, b: { score: undefined } });
  });

  it("reads overs and Dhaka times", () => {
    expect(oversToBalls("18.3")).toBe("111");
    expect(oversToBalls("20")).toBe("120");
    expect(oversToBalls(" ")).toBe("");
    expect(toLocalInput("2026-11-07T11:00:00.000Z")).toBe("2026-11-07T17:00");
    expect(toLocalInput(null)).toBe("");
    expect(fromLocalInput("2026-11-07T17:00")).toBe("2026-11-07T11:00:00.000Z");
    expect(fromLocalInput("")).toBeNull();
  });
});
