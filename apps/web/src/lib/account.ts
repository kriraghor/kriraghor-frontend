import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { asOfRole, BUSINESS_ROLES, type BusinessRole } from "./kyc";

/**
 * The member's account settings and roles on kriraghor.com (M01 profile, sign-in methods and
 * devices; M05 role applications and submissions). API calls plus pure helpers, unit-tested.
 */
export type Me = components["schemas"]["Me"];
export type UserRole = components["schemas"]["UserRole"];
export type RoleStatus = UserRole["status"];
export type SessionItem = components["schemas"]["SessionItem"];
export type MySubmission = components["schemas"]["MySubmission"];

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}
/** For 204 replies (no body): only the error matters. */
async function done(res: { error?: unknown }): Promise<void> {
  if (res.error) throw res.error;
}

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 80;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

// ---------------- API

export const updateProfile = async (body: { displayName?: string; locale?: "en" | "bn" }) => ok(await api().PATCH("/me", { body }));
export const sendEmailCode = async (email: string) => ok(await api().POST("/me/email", { body: { email } }));
export const verifyEmailCode = async (email: string, code: string) => ok(await api().POST("/me/email/verify", { body: { email, code } }));
export const linkGoogle = async (idToken: string) => ok(await api().POST("/me/identities/google", { body: { idToken } }));
export const unlinkGoogle = async () => done(await api().DELETE("/me/identities/google"));
export const changePassword = async (body: { currentPassword?: string; newPassword: string }) => done(await api().POST("/me/password", { body }));
export const listSessions = async () => (await ok(await api().GET("/me/sessions"))).data;
export const endSession = async (id: string) => done(await api().DELETE("/me/sessions/{id}", { params: { path: { id } } }));
export const withdrawRole = async (role: string) => ok(await api().POST("/me/roles/{role}/withdraw", { params: { path: { role } } }));
export const listSubmissions = async () => (await ok(await api().GET("/me/submissions"))).items;
export const withdrawSubmission = async (id: string) => ok(await api().POST("/me/submissions/{id}/withdraw", { params: { path: { id } } }));

// ---------------- profile and sign-in

/** The display name the server accepts (2–80 after trimming). */
export const displayNameOk = (name: string) => {
  const n = name.trim().length;
  return n >= DISPLAY_NAME_MIN && n <= DISPLAY_NAME_MAX;
};

export const emailLooksValid = (raw: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());

/** "+8801712345678" → "+880 17•• •••678": enough to recognise the number, not to copy it. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("880") ? digits.slice(3) : digits.replace(/^0/, "");
  if (local.length < 6) return phone;
  return `+880 ${local.slice(0, 2)}•• •••${local.slice(-3)}`;
}

/** Why the password form can't be sent yet (the server re-checks strength and breaches). */
export function passwordProblem(input: { hasPassword: boolean; current: string; next: string; confirm: string }): "currentRequired" | "tooShort" | "tooLong" | "mismatch" | null {
  if (input.hasPassword && !input.current) return "currentRequired";
  if (input.next.length < PASSWORD_MIN) return "tooShort";
  if (input.next.length > PASSWORD_MAX) return "tooLong";
  if (input.next !== input.confirm) return "mismatch";
  return null;
}

/**
 * Whether Google can be disconnected without locking the member out (mirrors the server: a phone,
 * a verified email, or a password with a username). The server still decides (409 LAST_SIGN_IN_METHOD).
 */
export const canUnlinkGoogle = (me: Pick<Me, "phone" | "email" | "emailVerified" | "hasPassword" | "username">) =>
  Boolean(me.phone) || Boolean(me.email && me.emailVerified) || Boolean(me.hasPassword && me.username);

/** Problem codes → message keys under "accountSettings.errors" (anything else shows the server's own title). */
const ERRORS: Record<string, string> = {
  EMAIL_IN_USE: "emailInUse",
  EMAIL_TAKEN: "emailInUse",
  EMAIL_ALREADY_VERIFIED: "emailAlreadyVerified",
  OTP_INVALID: "codeWrong",
  OTP_EXPIRED: "codeExpired",
  OTP_RATE_LIMITED: "tooMany",
  OTP_COOLDOWN: "tooMany",
  RATE_LIMITED: "tooMany",
  GOOGLE_ALREADY_LINKED: "googleLinkedElsewhere",
  GOOGLE_ALREADY_CONNECTED: "googleAlreadyConnected",
  GOOGLE_TOKEN_INVALID: "googleFailed",
  LAST_SIGN_IN_METHOD: "lastSignIn",
  PASSWORD_INCORRECT: "passwordIncorrect",
  PASSWORD_WEAK: "passwordWeak",
  PASSWORD_BREACHED: "passwordBreached",
  ROLE_NOT_WITHDRAWABLE: "roleNotWithdrawable",
  WITHDRAW_NOT_ALLOWED: "submissionNotWithdrawable",
  INVALID_STATE: "submissionClosed",
};
export const errorKey = (code: string | undefined | null) => (code ? (ERRORS[code] ?? null) : null);

/** This device first, then the most recently seen. */
export const sortSessions = (items: SessionItem[]) =>
  [...items].sort((a, b) => Number(b.current) - Number(a.current) || Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt));

// ---------------- roles and submissions

/** Role applications the member can still withdraw (the server answers 409 ROLE_NOT_WITHDRAWABLE otherwise). */
export const WITHDRAWABLE_ROLE: RoleStatus[] = ["applied", "documents_pending", "in_review", "changes_requested"];
export const canWithdrawRole = (status: RoleStatus) => WITHDRAWABLE_ROLE.includes(status);

/** Roles the member applies for themselves (member, staff and master admin are not shown as applications). */
export const isSelfServiceRole = (role: string): role is BusinessRole => (BUSINESS_ROLES as string[]).includes(role);

/** The /account/business link for a role (ground owner is the page's default). */
export const businessHref = (role: BusinessRole) => {
  const as = asOfRole(role);
  return as ? `/account/business?as=${as}` : "/account/business";
};

export type RoleNext =
  | { kind: "verify"; href: string }
  | { kind: "documents"; href: string }
  | { kind: "fix"; href: string }
  | { kind: "wait" }
  | { kind: "openProDesk"; href: string }
  | { kind: "openVendorDesk" }
  | { kind: "applyAgain"; href: string }
  | { kind: "contact" };

/** What the member does next for one role application. Most roles need a verified NID first. */
export function roleNext(role: BusinessRole, status: RoleStatus, kycVerified: boolean): RoleNext {
  switch (status) {
    case "applied":
    case "documents_pending":
      return kycVerified ? { kind: "documents", href: businessHref(role) } : { kind: "verify", href: "/account/verification" };
    case "changes_requested":
      return { kind: "fix", href: businessHref(role) };
    case "in_review":
      return { kind: "wait" };
    case "active":
      return role === "player" || role === "pro" ? { kind: "openProDesk", href: "/pro" } : { kind: "openVendorDesk" };
    case "rejected":
    case "withdrawn":
      return { kind: "applyAgain", href: businessHref(role) };
    case "suspended":
      return { kind: "contact" };
  }
}

/**
 * Submissions the owner withdraws here (M05 FR-14): kinds whose module allows it, while open. Other
 * kinds (venues, shops, products, documents, profiles) are withdrawn or replaced from their own page.
 */
const OWNER_WITHDRAW_KINDS = ["organisation", "tournament"];
export const OPEN_SUBMISSION: MySubmission["status"][] = ["pending_review", "changes_requested"];
export const canWithdrawSubmission = (s: Pick<MySubmission, "kind" | "status">) => OWNER_WITHDRAW_KINDS.includes(s.kind) && OPEN_SUBMISSION.includes(s.status);

/** Open submissions first (newest first), then decided ones. */
export const sortSubmissions = (items: MySubmission[]) =>
  [...items].sort((a, b) => Number(OPEN_SUBMISSION.includes(b.status)) - Number(OPEN_SUBMISSION.includes(a.status)) || Date.parse(b.submittedAt) - Date.parse(a.submittedAt));

// ---------------- Round B3: where the member works as staff

export type Workplace = components["schemas"]["BusinessWorkplace"];

/** GET /me/workplaces: the venues, gyms and shops the member works at as staff (live owners only). */
export async function listWorkplaces(): Promise<Workplace[]> {
  return (await ok(await api().GET("/me/workplaces"))).items;
}

/**
 * The vendor.kriraghor.com page a workplace opens on (its first desk by the permissions held), or the
 * vendor home when none of its desks is open to the member. Relative to the vendor site.
 */
export function workplaceDesk(w: Pick<Workplace, "businessType" | "businessId" | "permissions">): string {
  const has = (p: string) => w.permissions.includes(p);
  if (w.businessType === "venue" && has("bookings.view")) return "/vendor/bookings?groundId=" + w.businessId;
  if (w.businessType === "gym" && (has("desk.admit") || has("desk.admissions"))) return "/vendor/gyms/" + w.businessId + "/desk";
  if (w.businessType === "gym" && has("passes.view")) return "/vendor/gyms/" + w.businessId + "/passes";
  if (w.businessType === "shop" && has("orders.view")) return "/vendor/orders?shopId=" + w.businessId;
  if (w.businessType === "shop" && has("stock.view")) return "/vendor/inventory?shopId=" + w.businessId;
  return "/vendor";
}
