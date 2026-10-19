import { describe, expect, it } from "vitest";
import { bracket, byDay, refLabel, scoreLine, squadOk, statusTone, type Match } from "../tournaments";

const m = (over: Partial<Match>): Match =>
  ({
    id: `m${over.matchNo}`,
    matchNo: 1,
    stageId: "s",
    groupId: null,
    round: 1,
    roundName: null,
    teamA: { ref: { type: "team" }, team: null },
    teamB: { ref: { type: "team" }, team: null },
    scheduledStart: null,
    scheduledEnd: null,
    venueId: null,
    court: null,
    status: "scheduled",
    statusReason: null,
    published: true,
    version: 1,
    result: null,
    ...over,
  }) as Match;

describe("tournaments (M14)", () => {
  it("labels placeholders", () => {
    expect(refLabel({ type: "winner", matchNo: 7 })).toEqual({ key: "ref.winner", values: { no: 7 } });
    expect(refLabel({ type: "loser", matchNo: 5 })).toEqual({ key: "ref.loser", values: { no: 5 } });
    expect(refLabel({ type: "group_pos", group: "A", pos: 1 })).toEqual({ key: "ref.group", values: { pos: 1, group: "A" } });
    expect(refLabel({ type: "league_pos", pos: 2 })).toEqual({ key: "ref.league", values: { pos: 2 } });
    expect(refLabel({ type: "ranked", pos: 3, rank: 1 })).toEqual({ key: "ref.ranked", values: { rank: 1, pos: 3 } });
    expect(refLabel({ type: "team", teamId: "x" })).toEqual({ key: "ref.tbd", values: {} });
    expect(refLabel({ type: "winner" }).values).toEqual({ no: 0 });
    expect(refLabel({ type: "loser" }).values).toEqual({ no: 0 });
    expect(refLabel({ type: "group_pos" }).values).toEqual({ pos: 0, group: "" });
    expect(refLabel({ type: "league_pos" }).values).toEqual({ pos: 0 });
    expect(refLabel({ type: "ranked" }).values).toEqual({ rank: 0, pos: 0 });
  });

  it("orders knockout rounds, third place before the final", () => {
    const rounds = bracket([
      m({ matchNo: 7, roundName: "final" }),
      m({ matchNo: 6, roundName: "third_place" }),
      m({ matchNo: 4, roundName: "semi_final" }),
      m({ matchNo: 5, roundName: "semi_final" }),
      m({ matchNo: 1, roundName: "quarter_final" }),
      m({ matchNo: 0, roundName: "round_of_16" }),
      m({ matchNo: 9, groupId: "g", roundName: null }),
    ]);
    expect(rounds.map((r) => r.name)).toEqual(["round_of_16", "quarter_final", "semi_final", "third_place", "final"]);
    expect(rounds[2].matches.map((x) => x.matchNo)).toEqual([4, 5]);
  });

  it("groups matches by Dhaka day, unscheduled last", () => {
    const days = byDay([m({ matchNo: 2, scheduledStart: "2026-11-07T18:30:00.000Z" }), m({ matchNo: 1, scheduledStart: "2026-11-07T11:00:00.000Z" }), m({ matchNo: 3 })]);
    expect(days.map((d) => [d.day, d.matches.map((x) => x.matchNo)])).toEqual([
      ["2026-11-07", [1]],
      ["2026-11-08", [2]],
      [null, [3]],
    ]);
  });

  it("writes score lines", () => {
    const r = (outcome: string, score: Record<string, unknown>) => ({ outcome, winnerTeamId: null, margin: 0, score, version: 1, reason: null, at: null });
    expect(scoreLine(m({}))).toBeNull();
    expect(scoreLine(m({ result: r("walkover", {}) }))).toBe("W/O");
    expect(scoreLine(m({ result: r("no_result", {}) }))).toBe("NR");
    expect(scoreLine(m({ result: r("win", { sets: [[21, 15], [21, 17]] }) }))).toBe("21-15, 21-17");
    expect(scoreLine(m({ result: r("win", { a: { runs: 160, wickets: 5 }, b: { runs: 150 } }) }))).toBe("160/5 – 150/0");
    expect(scoreLine(m({ result: r("draw", { a: { score: 1 }, b: { score: 1 }, pens: { a: 4, b: 3 } }) }))).toBe("1–1 (4–3 p)");
    expect(scoreLine(m({ result: r("win", { a: { score: 2 }, b: { score: 0 } }) }))).toBe("2–0");
    expect(scoreLine(m({ result: r("win", {}) }))).toBeNull();
  });

  it("colours statuses and checks squads", () => {
    expect(statusTone("approved")).toBe("ok");
    expect(statusTone("completed")).toBe("muted");
    expect(statusTone("reserve")).toBe("warn");
    expect(statusTone("rejected")).toBe("error");
    expect(statusTone("lapsed")).toBe("muted");
    expect(squadOk(2, 1, 2)).toBe(true);
    expect(squadOk(0, 1, 2)).toBe(false);
    expect(squadOk(3, 1, 2)).toBe(false);
  });
});
