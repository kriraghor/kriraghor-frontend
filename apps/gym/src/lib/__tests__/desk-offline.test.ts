import { describe, expect, it } from "vitest";
import { copyStale, copyUsable, dueLeft, elapsedSince, isNetworkError, maySend, memberOfToken, newItem, newSlipNo, offlineEntry, searchCopy, sendVerdict, serverNow, waitingCounts, type HeldCopy, type WaitingItem } from "../desk-offline";

// M24 §22 the desk through a lost connection: the copy, finding members in it, items taken offline.
const ID = (n: number) => `0190a0a0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const member = (n: number, over: Partial<HeldCopy["members"][number]> = {}): HeldCopy["members"][number] => ({
  id: ID(n),
  memberCode: `IY-${String(n).padStart(4, "0")}`,
  displayName: `Member ${n}`,
  phoneLast4: String(1000 + n),
  package: { title: "Monthly", endsOn: "2026-12-01", status: "active" },
  flags: [],
  reasons: [],
  decision: "allow",
  inToday: false,
  ...over,
});
// 17 Nov 2026, 10:00 in Dhaka (04:00 UTC); the copy arrived when the device's steady clock read 1,000 ms.
const copy: HeldCopy = {
  gymId: ID(99),
  date: "2026-11-17",
  serverTime: "2026-11-17T04:00:00.000Z",
  stamp: "v1.gso.stamp",
  refreshMinutes: 10,
  maxHours: 24,
  policy: "warn",
  members: [member(1, { displayName: "Rafiq Hasan" }), member(2, { displayName: "Tanvir Ahmed", decision: "warn", reasons: ["unpaid"] }), member(3, { displayName: "Rafiqul Islam", decision: "block", phoneLast4: null }), member(12, { displayName: "Ánika Rahman" })],
  dues: [{ id: ID(50), memberId: ID(2), title: "Monthly", dueOn: "2026-11-01", outstandingPoisha: 250000 }],
  receivedAt: 1000,
};

describe("the desk copy (M24-FR-144)", () => {
  it("counts the time since it arrived on the steady clock, and tells the server's time now", () => {
    expect(elapsedSince(copy, 61_000)).toBe(60_000);
    expect(elapsedSince(copy, 500)).toBe(0);
    expect(serverNow(copy, 61_000).toISOString()).toBe("2026-11-17T04:01:00.000Z");
  });

  it("is good for its Dhaka day only, and is fetched again after the refresh time", () => {
    expect(copyUsable(copy, 1000)).toBe(true);
    expect(copyUsable(null, 1000)).toBe(false);
    // 14 hours later it is 00:00 the next day in Dhaka.
    expect(copyUsable(copy, 1000 + 14 * 3600_000 - 1)).toBe(true);
    expect(copyUsable(copy, 1000 + 14 * 3600_000)).toBe(false);
    expect(copyStale(null, 0)).toBe(true);
    expect(copyStale(copy, 1000 + 10 * 60_000 - 1)).toBe(false);
    expect(copyStale(copy, 1000 + 10 * 60_000)).toBe(true);
  });
});

describe("finding members in the copy (M24-FR-145)", () => {
  it("finds by member QR, code, the last four phone digits or part of the name", () => {
    const qr = `v1.gm.${ID(2)}.123456.${"a".repeat(32)}`;
    expect(searchCopy(copy, qr).map((m) => m.id)).toEqual([ID(2)]);
    expect(memberOfToken(` ${qr} `)).toBe(ID(2));
    expect(memberOfToken("not a token")).toBeNull();
    expect(searchCopy(copy, "iy-0003").map((m) => m.displayName)).toEqual(["Rafiqul Islam"]);
    expect(searchCopy(copy, "1001").map((m) => m.displayName)).toEqual(["Rafiq Hasan"]);
    expect(searchCopy(copy, "017-1100 1002").map((m) => m.displayName)).toEqual(["Tanvir Ahmed"]);
    expect(searchCopy(copy, "rafiq").map((m) => m.displayName)).toEqual(["Rafiq Hasan", "Rafiqul Islam"]);
    // Accents do not matter; a code prefix matches; at most `limit`.
    expect(searchCopy(copy, "anika").map((m) => m.id)).toEqual([ID(12)]);
    expect(searchCopy(copy, "IY-001").map((m) => m.id)).toEqual([ID(12)]);
    expect(searchCopy(copy, "member", 2)).toHaveLength(0);
    expect(searchCopy(copy, "a", 2)).toHaveLength(2);
    expect(searchCopy(copy, "   ")).toEqual([]);
  });

  it("checks in only those the copy lets in", () => {
    expect(copy.members.map(offlineEntry)).toEqual(["checkIn", "checkInWarn", "blocked", "checkIn"]);
  });
});

describe("items taken offline (M24-FR-146 to FR-148)", () => {
  const taker = { userId: ID(70), displayName: "Desk Rumi", unlockId: ID(71) };
  const checkin = newItem({ copy, nowPerf: 31_000, kind: "checkin", member: copy.members[0], taker, clientId: ID(80) });
  const cash = newItem({ copy, nowPerf: 61_000, kind: "cash_fee", member: copy.members[1], taker: { ...taker, unlockId: null, pinOnDevice: true }, due: copy.dues![0], amountPoisha: 100000, slipNo: "T-ABC234", clientId: ID(81) });

  it("carries the stamp, the time on the device and who took it", () => {
    expect(checkin).toEqual({
      gymId: ID(99),
      body: { clientId: ID(80), kind: "checkin", memberId: ID(1), stamp: "v1.gso.stamp", elapsedMs: 30_000, takenBy: ID(70), unlockId: ID(71), pinOnDevice: false, method: "desk" },
      member: { displayName: "Rafiq Hasan", memberCode: "IY-0001" },
      dueTitle: null,
      takenByName: "Desk Rumi",
      takenAtIso: "2026-11-17T04:00:30.000Z",
    });
    expect(cash.body).toMatchObject({ kind: "cash_fee", dueId: ID(50), amountPoisha: 100000, slipNo: "T-ABC234", unlockId: null, pinOnDevice: true });
    expect(cash.body).not.toHaveProperty("method");
    expect(cash.dueTitle).toBe("Monthly");
    // A QR check-in says so; a client id is made when none is given.
    const qr = newItem({ copy, nowPerf: 1000, kind: "checkin", member: copy.members[0], taker: { userId: ID(70), displayName: null }, method: "member_qr" });
    expect(qr.body).toMatchObject({ method: "member_qr", unlockId: null, pinOnDevice: false });
    expect(qr.body.clientId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("makes slip numbers that are easy to read aloud", () => {
    expect(newSlipNo(() => new Uint8Array([0, 1, 31, 32, 255, 8]))).toBe("T-AB9A9J");
    expect(newSlipNo()).toMatch(/^T-[A-HJ-NP-Z2-9]{6}$/);
  });

  it("takes off what already waits for a due, and counts what waits", () => {
    expect(dueLeft(copy.dues![0], [checkin, cash])).toBe(150000);
    expect(dueLeft(copy.dues![0], [cash, cash, cash])).toBe(0);
    const refused: WaitingItem = { ...checkin, problem: "Refused" };
    expect(waitingCounts([checkin, cash, refused])).toEqual({ checkins: 1, payments: 1, problems: 1 });
    expect(maySend(cash, null)).toBe(true);
    expect(maySend(cash, ["attendance.mark"])).toBe(false);
    expect(maySend(checkin, ["attendance.mark"])).toBe(true);
  });

  it("knows when to try again and when the server refused", () => {
    expect(sendVerdict(null)).toBe("sent");
    expect(sendVerdict(new TypeError("Failed to fetch"))).toBe("wait");
    expect(isNetworkError({ name: "TypeError" })).toBe(true);
    expect(isNetworkError(null)).toBe(false);
    for (const status of [0, 401, 403, 409, 423, 429, 500, 503]) expect(sendVerdict({ status })).toBe("wait");
    expect(sendVerdict({})).toBe("wait");
    for (const status of [400, 404, 422]) expect(sendVerdict({ status })).toBe("refused");
  });
});
