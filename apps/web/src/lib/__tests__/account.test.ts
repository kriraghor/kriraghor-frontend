import { describe, expect, it } from "vitest";
import {
  businessHref,
  canUnlinkGoogle,
  canWithdrawRole,
  canWithdrawSubmission,
  displayNameOk,
  emailLooksValid,
  errorKey,
  isSelfServiceRole,
  maskPhone,
  passwordProblem,
  roleNext,
  sortSessions,
  sortSubmissions,
  workplaceDesk,
  type MySubmission,
  type SessionItem,
} from "../account";

describe("account settings (M01 profile and sign-in methods)", () => {
  it("accepts a display name of 2 to 80 characters after trimming", () => {
    expect(displayNameOk("Fa")).toBe(true);
    expect(displayNameOk(" F ")).toBe(false);
    expect(displayNameOk("x".repeat(80))).toBe(true);
    expect(displayNameOk("x".repeat(81))).toBe(false);
  });

  it("checks an email's shape", () => {
    expect(emailLooksValid(" fahim@example.com ")).toBe(true);
    expect(emailLooksValid("fahim@example")).toBe(false);
    expect(emailLooksValid("fahim example.com")).toBe(false);
  });

  it("masks a phone number, keeping the operator and the last three digits", () => {
    expect(maskPhone("+8801712345678")).toBe("+880 17•• •••678");
    expect(maskPhone("01712345678")).toBe("+880 17•• •••678");
    expect(maskPhone("12345")).toBe("12345");
    expect(maskPhone(null)).toBe("");
  });

  it("asks for the current password only when one is set, then length and confirmation", () => {
    const base = { hasPassword: true, current: "old-secret", next: "new-secret-1", confirm: "new-secret-1" };
    expect(passwordProblem(base)).toBeNull();
    expect(passwordProblem({ ...base, current: "" })).toBe("currentRequired");
    expect(passwordProblem({ ...base, hasPassword: false, current: "" })).toBeNull();
    expect(passwordProblem({ ...base, next: "short", confirm: "short" })).toBe("tooShort");
    expect(passwordProblem({ ...base, next: "x".repeat(129), confirm: "x".repeat(129) })).toBe("tooLong");
    expect(passwordProblem({ ...base, confirm: "something-else" })).toBe("mismatch");
  });

  it("lets Google go only when another way in remains", () => {
    const none = { phone: null, email: null, emailVerified: false, hasPassword: false, username: null };
    expect(canUnlinkGoogle(none)).toBe(false);
    expect(canUnlinkGoogle({ ...none, phone: "+8801712345678" })).toBe(true);
    expect(canUnlinkGoogle({ ...none, email: "a@b.co", emailVerified: false })).toBe(false);
    expect(canUnlinkGoogle({ ...none, email: "a@b.co", emailVerified: true })).toBe(true);
    expect(canUnlinkGoogle({ ...none, hasPassword: true })).toBe(false);
    expect(canUnlinkGoogle({ ...none, hasPassword: true, username: "fahim" })).toBe(true);
  });

  it("maps problem codes to plain messages, and leaves unknown codes to the server's title", () => {
    expect(errorKey("EMAIL_IN_USE")).toBe("emailInUse");
    expect(errorKey("EMAIL_TAKEN")).toBe("emailInUse");
    expect(errorKey("LAST_SIGN_IN_METHOD")).toBe("lastSignIn");
    expect(errorKey("PASSWORD_BREACHED")).toBe("passwordBreached");
    expect(errorKey("SOMETHING_NEW")).toBeNull();
    expect(errorKey(undefined)).toBeNull();
  });

  it("lists this device first, then the most recently seen", () => {
    const s = (id: string, lastSeenAt: string, current = false): SessionItem => ({ id, device: null, ip: null, lastSeenAt, createdAt: lastSeenAt, current });
    const sorted = sortSessions([s("old", "2026-10-01T00:00:00Z"), s("new", "2026-10-20T00:00:00Z"), s("me", "2026-09-01T00:00:00Z", true)]);
    expect(sorted.map((x) => x.id)).toEqual(["me", "new", "old"]);
  });
});

describe("my roles and submissions (M05)", () => {
  it("withdraws only open applications", () => {
    for (const st of ["applied", "documents_pending", "in_review", "changes_requested"] as const) expect(canWithdrawRole(st)).toBe(true);
    for (const st of ["active", "rejected", "suspended", "withdrawn"] as const) expect(canWithdrawRole(st)).toBe(false);
  });

  it("knows the self-service roles", () => {
    expect(isSelfServiceRole("organiser")).toBe(true);
    expect(isSelfServiceRole("member")).toBe(false);
    expect(isSelfServiceRole("staff")).toBe(false);
  });

  it("links each role to its business page", () => {
    expect(businessHref("ground_owner")).toBe("/account/business");
    expect(businessHref("organiser")).toBe("/account/business?as=organiser");
    expect(businessHref("shop_owner")).toBe("/account/business?as=shop");
  });

  it("says what to do next for every status", () => {
    expect(roleNext("shop_owner", "applied", false)).toEqual({ kind: "verify", href: "/account/verification" });
    expect(roleNext("shop_owner", "documents_pending", true)).toEqual({ kind: "documents", href: "/account/business?as=shop" });
    expect(roleNext("gym_owner", "changes_requested", true)).toEqual({ kind: "fix", href: "/account/business?as=gym" });
    expect(roleNext("organiser", "in_review", true)).toEqual({ kind: "wait" });
    expect(roleNext("pro", "active", true)).toEqual({ kind: "openProDesk", href: "/pro" });
    expect(roleNext("player", "active", true)).toEqual({ kind: "openProDesk", href: "/pro" });
    expect(roleNext("ground_owner", "active", true)).toEqual({ kind: "openVendorDesk" });
    expect(roleNext("organiser", "rejected", true)).toEqual({ kind: "applyAgain", href: "/account/business?as=organiser" });
    expect(roleNext("organiser", "withdrawn", true)).toEqual({ kind: "applyAgain", href: "/account/business?as=organiser" });
    expect(roleNext("ground_owner", "suspended", true)).toEqual({ kind: "contact" });
  });

  const sub = (over: Partial<MySubmission>): MySubmission => ({
    id: "s",
    kind: "organisation",
    subjectId: "x",
    version: 1,
    title: "T",
    status: "pending_review",
    reasonCode: null,
    reasonText: null,
    submittedAt: "2026-10-01T00:00:00Z",
    decidedAt: null,
    appliedAt: null,
    ...over,
  });

  it("withdraws open submissions of kinds that allow it", () => {
    expect(canWithdrawSubmission(sub({}))).toBe(true);
    expect(canWithdrawSubmission(sub({ kind: "tournament", status: "changes_requested" }))).toBe(true);
    expect(canWithdrawSubmission(sub({ status: "approved" }))).toBe(false);
    expect(canWithdrawSubmission(sub({ kind: "ground" }))).toBe(false);
    expect(canWithdrawSubmission(sub({ kind: "document" }))).toBe(false);
  });

  it("lists open submissions first, newest first", () => {
    const sorted = sortSubmissions([
      sub({ id: "done-new", status: "approved", submittedAt: "2026-10-20T00:00:00Z" }),
      sub({ id: "open-old", submittedAt: "2026-10-01T00:00:00Z" }),
      sub({ id: "open-new", status: "changes_requested", submittedAt: "2026-10-10T00:00:00Z" }),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["open-new", "open-old", "done-new"]);
  });
});

describe("where I work as staff (Round B3)", () => {
  it("opens each workplace on its first desk the permissions allow, else the vendor home", () => {
    expect(workplaceDesk({ businessType: "venue", businessId: "g1", permissions: ["bookings.view", "bookings.check_in"] })).toBe("/vendor/bookings?groundId=g1");
    expect(workplaceDesk({ businessType: "venue", businessId: "g1", permissions: ["reviews.reply"] })).toBe("/vendor");
    expect(workplaceDesk({ businessType: "gym", businessId: "y1", permissions: ["desk.admissions"] })).toBe("/vendor/gyms/y1/desk");
    expect(workplaceDesk({ businessType: "gym", businessId: "y1", permissions: ["passes.view"] })).toBe("/vendor/gyms/y1/passes");
    expect(workplaceDesk({ businessType: "shop", businessId: "s1", permissions: ["orders.view"] })).toBe("/vendor/orders?shopId=s1");
    expect(workplaceDesk({ businessType: "shop", businessId: "s1", permissions: ["stock.view"] })).toBe("/vendor/inventory?shopId=s1");
    expect(workplaceDesk({ businessType: "shop", businessId: "s1", permissions: [] })).toBe("/vendor");
  });
});
