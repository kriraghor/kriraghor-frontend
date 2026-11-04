import { describe, expect, it } from "vitest";
import { checkTone, fixHref, safeNext, sortMembers, teamSports, togglePosition, whatsappUrl, type TeamMember } from "../teams";

const m = (displayName: string, role: TeamMember["role"], jerseyNo: number | null = null): TeamMember => ({ userId: displayName, displayName, username: null, role, jerseyNo, joinedAt: "2026-10-18T00:00:00Z", nidVerified: false });

describe("teams (M16)", () => {
  it("shares the invite link on WhatsApp, encoded", () => {
    expect(whatsappUrl("Join Gulshan Gladiators: https://kriraghor.com/teams/join/abc?x=1&y")).toBe("https://wa.me/?text=Join%20Gulshan%20Gladiators%3A%20https%3A%2F%2Fkriraghor.com%2Fteams%2Fjoin%2Fabc%3Fx%3D1%26y");
  });

  it("links each readiness fix to where it is done", () => {
    expect(fixHref("add_phone")).toBe("/me/eligibility#phone");
    expect(fixHref("set_gender")).toBe("/me/eligibility#gender");
    expect(fixHref("verify_nid")).toBe("/account/verification");
    expect(fixHref(null)).toBeNull();
    expect(fixHref("something_else")).toBeNull();
  });

  it("lists the captain, the vice-captain, then players by number, then name", () => {
    const sorted = sortMembers([m("Zed", "player"), m("Ali", "player", 9), m("Bina", "player"), m("Cap", "captain"), m("Vice", "vice_captain", 7), m("Ruma", "player", 3)]);
    expect(sorted.map((x) => x.displayName)).toEqual(["Cap", "Vice", "Ruma", "Ali", "Bina", "Zed"]);
  });

  it("offers only sports with positions for teams", () => {
    const s = (key: string, positions?: string[]) => ({ id: key, key, nameEn: key, nameBn: key, ...(positions ? { positions: positions.map((p) => ({ key: p, en: p, bn: p })) } : {}) });
    expect(teamSports([s("football", ["goalkeeper"]), s("gym", []), s("swimming")]).map((x) => x.key)).toEqual(["football"]);
  });

  it("toggles a position for one sport", () => {
    const start = [
      { sportKey: "football", positions: ["goalkeeper"] },
      { sportKey: "cricket", positions: [] },
    ];
    expect(togglePosition(start, "football", "defender")[0].positions).toEqual(["goalkeeper", "defender"]);
    expect(togglePosition(start, "football", "goalkeeper")[0].positions).toEqual([]);
    expect(togglePosition(start, "football", "goalkeeper")[1]).toBe(start[1]);
  });

  it("colours readiness checks", () => {
    expect(checkTone("pass")).toBe("ok");
    expect(checkTone("pending")).toBe("warn");
    expect(checkTone("missing")).toBe("warn");
    expect(checkTone("fail")).toBe("error");
    expect(checkTone("n_a")).toBe("muted");
  });

  it("returns only to same-site paths after sign-in", () => {
    expect(safeNext("/teams/join/abc")).toBe("/teams/join/abc");
    expect(safeNext(["/me/teams", "/x"])).toBe("/me/teams");
    expect(safeNext(undefined)).toBe("/me");
    expect(safeNext("https://evil.example")).toBe("/me");
    expect(safeNext("//evil.example")).toBe("/me");
    expect(safeNext("/\\evil.example")).toBe("/me");
    expect(safeNext("", "/me/teams")).toBe("/me/teams");
  });
});
