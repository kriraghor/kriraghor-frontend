import { describe, expect, it } from "vitest";
import { resetMessage, resetStep, targetKind } from "../reset";

describe("forgot password (M01 /signin/reset)", () => {
  it("moves enter → code → done, and can start again", () => {
    const code = resetStep({ kind: "enter" }, { type: "sent", target: "01711000001" });
    expect(code).toEqual({ kind: "code", target: "01711000001" });
    expect(resetStep(code, { type: "sent", target: "01711000001" })).toEqual(code);
    const done = resetStep(code, { type: "reset" });
    expect(done).toEqual({ kind: "done", target: "01711000001" });
    expect(resetStep({ kind: "enter" }, { type: "reset" })).toEqual({ kind: "enter" });
    expect(resetStep(done, { type: "restart" })).toEqual({ kind: "enter" });
  });

  it("accepts a phone or an email, never a username", () => {
    expect(targetKind("01711000001")).toBe("phone");
    expect(targetKind("+880 1711-000001")).toBe("phone");
    expect(targetKind("1711000001")).toBe("phone");
    expect(targetKind("fahim@example.com")).toBe("email");
    expect(targetKind("fahim_r")).toBeNull();
    expect(targetKind("01211000001")).toBeNull();
  });

  it("maps problem codes to friendly messages, with the wait when known", () => {
    expect(resetMessage({ code: "OTP_INVALID" })).toEqual({ key: "codeWrong" });
    expect(resetMessage({ code: "OTP_EXPIRED" })).toEqual({ key: "codeExpired" });
    expect(resetMessage({ code: "OTP_RATE_LIMITED", retryAfter: 42 })).toEqual({ key: "tooManyWait", seconds: 42 });
    expect(resetMessage({ code: "RATE_LIMITED" })).toEqual({ key: "tooMany" });
    expect(resetMessage({ code: "PASSWORD_WEAK" })).toEqual({ key: "weak" });
    expect(resetMessage({ code: "PASSWORD_BREACHED" })).toEqual({ key: "breached" });
    expect(resetMessage({ code: "ACCOUNT_BANNED" })).toEqual({ key: "blocked" });
    expect(resetMessage({ code: "VALIDATION_FAILED" })).toBeNull();
    expect(resetMessage(null)).toBeNull();
  });
});
