import { describe, expect, it } from "vitest";
import { sportsWithPositions, togglePosition } from "../players";
import { safeNext } from "../safe-next";

describe("player profiles", () => {
  it("offers only sports with positions", () => {
    const sports = [
      { id: "1", key: "cricket", nameEn: "Cricket", nameBn: "ক্রিকেট", positions: [{ key: "bat", en: "Batter", bn: "ব্যাটার" }] },
      { id: "2", key: "badminton", nameEn: "Badminton", nameBn: "ব্যাডমিন্টন", positions: [] },
      { id: "3", key: "chess", nameEn: "Chess", nameBn: "দাবা" },
    ];
    expect(sportsWithPositions(sports).map((s) => s.key)).toEqual(["cricket"]);
  });

  it("toggles a position for one sport", () => {
    const start = [
      { sportKey: "cricket", positions: ["bat"] },
      { sportKey: "football", positions: [] },
    ];
    expect(togglePosition(start, "cricket", "bowl")[0].positions).toEqual(["bat", "bowl"]);
    expect(togglePosition(start, "cricket", "bat")[0].positions).toEqual([]);
    expect(togglePosition(start, "cricket", "bat")[1]).toEqual(start[1]);
  });
});

describe("safeNext", () => {
  it("returns only to same-site paths after sign-in", () => {
    expect(safeNext("/me/orders")).toBe("/me/orders");
    expect(safeNext(["/shop", "/x"])).toBe("/shop");
    expect(safeNext(undefined)).toBe("/me");
    expect(safeNext("https://evil.example")).toBe("/me");
    expect(safeNext("//evil.example")).toBe("/me");
    expect(safeNext("/\\evil.example")).toBe("/me");
    expect(safeNext(undefined, "/tournaments")).toBe("/tournaments");
  });
});
