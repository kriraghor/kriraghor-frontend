import { describe, expect, it } from "vitest";
import { isWalletNumber, toneOf } from "../payouts";

describe("payout helpers (M07 §4.1, §4.2)", () => {
  it("accepts Bangladeshi wallet numbers the way the server does", () => {
    expect(isWalletNumber("01712345678")).toBe(true);
    expect(isWalletNumber("+880 1712-345678")).toBe(true);
    expect(isWalletNumber("8801912345678")).toBe(true);
    expect(isWalletNumber("01212345678")).toBe(false);
    expect(isWalletNumber("0171234567")).toBe(false);
    expect(isWalletNumber("")).toBe(false);
  });

  it("reads payout statuses for the payee", () => {
    expect(toneOf("paid")).toBe("ok");
    expect(toneOf("failed")).toBe("bad");
    expect(toneOf("on_hold")).toBe("bad");
    expect(toneOf("cancelled")).toBe("muted");
    for (const s of ["scheduled", "needs_approval", "processing"] as const) expect(toneOf(s)).toBe("waiting");
  });
});
