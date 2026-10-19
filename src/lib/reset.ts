/**
 * Forgot password (M01 /signin/reset): phone or email → a 6-digit code → a new password. The backend
 * answers "sent" for every target (no enumeration), checks the code and the password in one call,
 * and signs out every session. Pure helpers, unit-tested.
 */

export type ResetStep = { kind: "enter" } | { kind: "code"; target: string } | { kind: "done"; target: string };
export type ResetEvent = { type: "sent"; target: string } | { type: "reset" } | { type: "restart" };

export function resetStep(step: ResetStep, event: ResetEvent): ResetStep {
  switch (event.type) {
    case "sent":
      return { kind: "code", target: event.target };
    case "reset":
      return step.kind === "code" ? { kind: "done", target: step.target } : step;
    case "restart":
      return { kind: "enter" };
  }
}

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** A phone (01XXXXXXXXX, with or without +880) or an email; usernames can't receive a code. */
export function targetKind(raw: string): "phone" | "email" | null {
  const v = raw.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "email";
  const digits = v.replace(/[\s-]/g, "");
  if (/^(\+?880|0)?1[3-9]\d{8}$/.test(digits)) return "phone";
  return null;
}

/** Problem codes → the message key under "reset" (anything else shows the server's own text). */
const MESSAGES: Record<string, string> = {
  OTP_INVALID: "codeWrong",
  OTP_EXPIRED: "codeExpired",
  OTP_RATE_LIMITED: "tooMany",
  RATE_LIMITED: "tooMany",
  PASSWORD_WEAK: "weak",
  PASSWORD_BREACHED: "breached",
  ACCOUNT_SUSPENDED: "blocked",
  ACCOUNT_BANNED: "blocked",
  ACCOUNT_CLOSED: "blocked",
};

export function resetMessage(problem: { code?: string; retryAfter?: number } | null): { key: string; seconds?: number } | null {
  if (!problem?.code) return null;
  const key = MESSAGES[problem.code];
  if (!key) return null;
  return key === "tooMany" && problem.retryAfter ? { key: "tooManyWait", seconds: problem.retryAfter } : { key };
}
