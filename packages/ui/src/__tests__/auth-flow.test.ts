import { afterEach, describe, expect, it } from "vitest";
import { handoffFrom, identifierKind, maskTarget, normalizePhone, normalizeUsername, saveHandoff, signupSteps, takeHandoff } from "../auth/flow";

afterEach(() => sessionStorage.clear());

describe("identifiers (same rules as the backend's common/identifiers)", () => {
  it.each([
    ["01712345678", "+8801712345678"],
    ["8801712345678", "+8801712345678"],
    ["+880 1712-345678", "+8801712345678"],
    ["01912345678", "+8801912345678"],
  ])("%s is a Bangladesh mobile", (input, e164) => {
    expect(normalizePhone(input)).toBe(e164);
    expect(identifierKind(input)).toBe("phone");
  });

  it("rejects numbers outside the 013–019 operators and the wrong length", () => {
    expect(normalizePhone("01212345678")).toBeNull();
    expect(normalizePhone("0171234567")).toBeNull();
    expect(identifierKind("0171234567")).toBeNull();
  });

  it("knows an email, and neither", () => {
    expect(identifierKind(" Rafi@Example.com ")).toBe("email");
    expect(identifierKind("rafi@example")).toBeNull();
    expect(identifierKind("rafi")).toBeNull();
  });

  it("masks where the code went", () => {
    expect(maskTarget("01712345678")).toBe("0171•••5678");
    expect(maskTarget("rafi.ahmed@gmail.com")).toBe("ra•••@gmail.com");
  });
});

describe("usernames", () => {
  it.each([
    ["Rafi_71", "rafi_71"],
    ["@rafi.ahmed", "rafi.ahmed"],
  ])("%s → %s", (input, out) => expect(normalizeUsername(input)).toBe(out));

  it.each(["ra", "1rafi", "rafi.", "rafi..ahmed", "rafi-ahmed", "a".repeat(31)])("%s is refused", (input) => expect(normalizeUsername(input)).toBeNull());
});

describe("the wizard's steps", () => {
  it("has a role step only where the app offers roles", () => {
    expect(signupSteps(true)).toEqual(["verify", "about", "role", "done"]);
    expect(signupSteps(false)).toEqual(["verify", "about", "done"]);
  });
});

describe("sign-in → sign-up hand-over", () => {
  const now = Date.parse("2026-10-20T12:00:00Z");

  it("a signed-in answer is not a hand-over", () => {
    expect(handoffFrom({ status: "signed_in", accessToken: "x" }, "phone", now)).toBeNull();
    expect(handoffFrom(undefined, "phone", now)).toBeNull();
  });

  it("keeps the token, the server's expiry and Google's suggestion", () => {
    const h = handoffFrom(
      { status: "signup", signupToken: "t".repeat(30), signupTokenExpiresAt: "2026-10-20T12:15:00Z", suggested: { displayName: "Rafi Ahmed", email: "r@x.com", needsUsername: false } },
      "google",
      now,
    );
    expect(h).toEqual({ signupToken: "t".repeat(30), expiresAt: Date.parse("2026-10-20T12:15:00Z"), via: "google", suggested: { displayName: "Rafi Ahmed", needsUsername: false } });
  });

  it("falls back to ten minutes when the server gives no expiry", () => {
    expect(handoffFrom({ status: "signup", signupToken: "t".repeat(30) }, "phone", now)?.expiresAt).toBe(now + 600_000);
  });

  it("is read once, from sessionStorage, and an expired one is dropped", () => {
    saveHandoff({ signupToken: "a".repeat(30), expiresAt: now + 1000, via: "phone" });
    expect(takeHandoff(now)?.signupToken).toBe("a".repeat(30));
    expect(takeHandoff(now)).toBeNull();

    saveHandoff({ signupToken: "b".repeat(30), expiresAt: now - 1, via: "email" });
    expect(takeHandoff(now)).toBeNull();
  });

  it("survives junk in storage", () => {
    sessionStorage.setItem("kg.signup", "{not json");
    expect(takeHandoff(now)).toBeNull();
  });
});
