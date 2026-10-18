import { describe, expect, it } from "vitest";
import { dhakaIso, dhakaLocal, stageBody } from "../admin/bigEvents";

describe("big events desk (M23)", () => {
  it("turns stage rows into the API body, or null when a row is unfinished", () => {
    const final = { tournamentId: "f", role: "final" as const, labelEn: "Grand final", labelBn: "গ্র্যান্ড ফাইনাল", qualifyCount: "", finalTournamentId: "" };
    const q = { tournamentId: "q", role: "qualifier" as const, labelEn: " Qualifier A ", labelBn: "কোয়ালিফায়ার", qualifyCount: "4", finalTournamentId: "f" };
    expect(stageBody([final, q])).toEqual([
      { tournamentId: "f", role: "final", labelEn: "Grand final", labelBn: "গ্র্যান্ড ফাইনাল" },
      { tournamentId: "q", role: "qualifier", labelEn: "Qualifier A", labelBn: "কোয়ালিফায়ার", qualifyCount: 4, finalTournamentId: "f" },
    ]);
    expect(stageBody([{ ...final, tournamentId: "" }])).toBeNull();
    expect(stageBody([{ ...final, labelEn: "x" }])).toBeNull();
    expect(stageBody([final, { ...q, qualifyCount: "0" }])).toBeNull();
    expect(stageBody([final, { ...q, finalTournamentId: "" }])).toBeNull();
  });

  it("converts Dhaka wall-clock times both ways", () => {
    expect(dhakaIso("2026-11-10T18:00")).toBe("2026-11-10T12:00:00.000Z");
    expect(dhakaLocal("2026-11-10T12:00:00.000Z")).toBe("2026-11-10T18:00");
  });
});
