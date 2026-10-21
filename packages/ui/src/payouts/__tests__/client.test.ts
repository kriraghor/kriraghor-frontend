import { describe, expect, it } from "vitest";
import { accountGap, formatTaka, isWalletNumber, nextPayoutAmount, toneOf, type PayoutAccount } from "../client";

const account = { id: "a", type: "bkash", masked: "bKash ••• 5678", last4: "5678", accountName: "E2E", status: "active" } as PayoutAccount;

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

  it("says when the payee still needs a payout account (the get-paid notice)", () => {
    expect(accountGap(undefined)).toBeNull();
    expect(accountGap({ account: null, pendingAccount: null } as never)).toBe("missing");
    expect(accountGap({ account: null, pendingAccount: { ...account, status: "pending_verification" } } as never)).toBe("pending");
    expect(accountGap({ account, pendingAccount: null } as never)).toBeNull();
    expect(accountGap({ account, pendingAccount: { ...account, status: "pending_verification" } } as never)).toBeNull();
  });

  it("adds what is already in a payout to the next run's projection", () => {
    expect(nextPayoutAmount({ nextPayout: { date: null, projected: 19000, minimum: 10000 }, inPayouts: 500 })).toBe(19500);
    expect(nextPayoutAmount({ nextPayout: { date: null, projected: 0, minimum: 10000 }, inPayouts: 0 })).toBe(0);
  });

  it("formats poisha as taka with Indian grouping, Bangla digits for bn", () => {
    expect(formatTaka(19000)).toBe("৳190");
    expect(formatTaka(12345650)).toBe("৳1,23,456.50");
    expect(formatTaka(-505)).toBe("−৳5.05");
    expect(formatTaka(19000, "bn")).toBe("৳১৯০");
  });
});
