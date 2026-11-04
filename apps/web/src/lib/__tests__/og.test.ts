import { describe, expect, it } from "vitest";
import { hireCard, playerCard } from "../og";

const hireLabels = { rating: "Rating", jobs: "Jobs done", years: "Years" };
const playerLabels = { player: "Player", sports: "Sports", teams: "Teams" };

describe("hireCard (Round B1 part 5)", () => {
  const profile = {
    name: "Rafi Ahmed",
    headline: "ICC level 1 umpire",
    specialisation: "T20 umpiring",
    role: { nameEn: "Umpire", nameBn: "আম্পায়ার" },
    area: { nameEn: "Mirpur", nameBn: "মিরপুর" },
    ratingAvg: 4.75,
    ratingCount: 12,
    jobsDone: 31,
    years: 6,
  };

  it("puts the role above the name, specialisation and area under it, then rating, jobs and years", () => {
    expect(hireCard(profile, "en", hireLabels)).toEqual({
      eyebrow: "Umpire",
      title: "Rafi Ahmed",
      subtitle: "T20 umpiring · Mirpur",
      stats: [
        { label: "Rating", value: "4.8 (12)", star: true },
        { label: "Jobs done", value: "31" },
        { label: "Years", value: "6" },
      ],
    });
  });

  it("uses Bangla names and digits in Bangla", () => {
    const c = hireCard(profile, "bn", hireLabels)!;
    expect(c.eyebrow).toBe("আম্পায়ার");
    expect(c.subtitle).toBe("T20 umpiring · মিরপুর");
    expect(c.stats[1].value).toBe("৩১");
  });

  it("leaves out a rating nobody gave, no jobs and no years; falls back to the headline", () => {
    const c = hireCard({ ...profile, specialisation: null, area: null, ratingAvg: null, ratingCount: 0, jobsDone: 0, years: 0 }, "en", hireLabels)!;
    expect(c.stats).toEqual([]);
    expect(c.subtitle).toBe("ICC level 1 umpire");
    expect(hireCard({ ...profile, ratingAvg: 4, ratingCount: 0 }, "en", hireLabels)!.stats.some((s) => s.star)).toBe(false);
  });

  it("is null without a name (the route draws the brand card)", () => {
    expect(hireCard(null, "en", hireLabels)).toBeNull();
    expect(hireCard({}, "en", hireLabels)).toBeNull();
  });

  it("an English name falls back to Bangla and back; no role gives no eyebrow", () => {
    const c = hireCard({ name: "X", role: { nameEn: "", nameBn: "কোচ" }, area: { nameEn: "Uttara", nameBn: "" } }, "bn", hireLabels)!;
    expect(c.eyebrow).toBe("কোচ");
    expect(c.subtitle).toBe("Uttara");
    expect(hireCard({ name: "X" }, "en", hireLabels)!.eyebrow).toBeNull();
    expect(hireCard({ name: "X" }, "en", hireLabels)!.subtitle).toBeNull();
  });
});

describe("playerCard (Round B1 part 5)", () => {
  const player = {
    handle: "tamim",
    displayName: "Tamim Hasan",
    sports: [
      { nameEn: "Cricket", nameBn: "ক্রিকেট", positions: [{ en: "Batter", bn: "ব্যাটার" }, { en: "Wicket-keeper", bn: "উইকেটরক্ষক" }] },
      { nameEn: "Futsal", nameBn: "ফুটসাল", positions: [] },
    ],
    teams: [{}, {}, {}],
  };

  it("names the sports with positions and counts sports and teams", () => {
    expect(playerCard(player, "en", playerLabels)).toEqual({
      eyebrow: "Player",
      title: "Tamim Hasan",
      subtitle: "Cricket (Batter, Wicket-keeper) · Futsal",
      stats: [
        { label: "Sports", value: "2" },
        { label: "Teams", value: "3" },
      ],
    });
    expect(playerCard(player, "bn", playerLabels)!.subtitle).toBe("ক্রিকেট (ব্যাটার, উইকেটরক্ষক) · ফুটসাল");
  });

  it("no sports and no teams: no subtitle and no stats; no name is null", () => {
    expect(playerCard({ displayName: "A" }, "en", playerLabels)).toEqual({ eyebrow: "Player", title: "A", subtitle: null, stats: [] });
    expect(playerCard(undefined, "en", playerLabels)).toBeNull();
  });
});
