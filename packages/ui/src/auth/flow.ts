/**
 * Sign-in and sign-up rules shared by the forms (M01): which kind of identifier the visitor typed,
 * how it is shown back, the username rule, the wizard's steps and the sign-in → sign-up hand-over.
 * The server is the judge of every rule; these only give early, friendly feedback.
 */

export type IdentifierKind = "phone" | "email";

/** The same normalisation as the backend (common/identifiers): 01…, 8801…, +880 1… → +8801…. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/[\s\-()]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("880")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  const e164 = `+880${d}`;
  return /^\+8801[3-9]\d{8}$/.test(e164) ? e164 : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** "phone", "email", or null when it is neither (shown as an error before any request). */
export function identifierKind(input: string): IdentifierKind | null {
  const v = input.trim();
  if (normalizePhone(v)) return "phone";
  if (EMAIL.test(v)) return "email";
  return null;
}

/** How the code step names where the code went: 0171•••5678, ra•••@gmail.com. */
export function maskTarget(input: string): string {
  const v = input.trim();
  const phone = normalizePhone(v);
  if (phone) return `0${phone.slice(4, 7)}•••${phone.slice(-4)}`;
  const [user, domain] = v.split("@");
  if (!domain) return v;
  return `${user.slice(0, 2)}•••@${domain}`;
}

/** Username: 3–30 chars, starts with a letter, letters/digits/dot/underscore (stored lower-case). */
export function normalizeUsername(input: string): string | null {
  const u = input.trim().toLowerCase().replace(/^@/, "");
  if (!/^[a-z][a-z0-9._]{2,29}$/.test(u) || u.endsWith(".") || u.includes("..")) return null;
  return u;
}

/** Roles a person can ask for at sign-up (the backend's SELF_SERVICE_ROLES); "none" asks for nothing. */
export const SIGNUP_ROLES = ["none", "player", "pro", "ground_owner", "shop_owner", "gym_owner"] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

export type SignupStep = "verify" | "about" | "role" | "done";

/** The wizard's steps: the role step only where the app offers roles. */
export function signupSteps(withRoles: boolean): SignupStep[] {
  return withRoles ? ["verify", "about", "role", "done"] : ["verify", "about", "done"];
}

/** What the sign-up page needs when a sign-in turned out to be a new account. */
export type SignupHandoff = {
  signupToken: string;
  /** Epoch ms; past it the token is refused and the visitor verifies again. */
  expiresAt: number;
  via: "phone" | "email" | "google";
  suggested?: { displayName?: string | null; needsUsername?: boolean };
};

const KEY = "kg.signup";

/** Kept in sessionStorage (this tab only), never in the URL. */
export function saveHandoff(h: SignupHandoff) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(h));
  } catch {
    /* storage off: the sign-up page starts at the verify step */
  }
}

/** Reads and removes the hand-over; an expired one is dropped. */
export function takeHandoff(now = Date.now()): SignupHandoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const h = JSON.parse(raw) as SignupHandoff;
    return typeof h.signupToken === "string" && h.expiresAt > now ? h : null;
  } catch {
    return null;
  }
}

/** The body the API returns from verify, login, google and signup. */
export type AuthBody =
  | {
      status?: string;
      accessToken?: string;
      signupToken?: string;
      signupTokenExpiresAt?: string;
      suggested?: { displayName?: string | null; email?: string | null; needsUsername?: boolean };
    }
  | undefined;

/** Turns a "signup" answer into a hand-over (expiry from the server, else 10 minutes). */
export function handoffFrom(body: AuthBody, via: SignupHandoff["via"], now = Date.now()): SignupHandoff | null {
  if (body?.status !== "signup" || !body.signupToken) return null;
  const exp = body.signupTokenExpiresAt ? Date.parse(body.signupTokenExpiresAt) : NaN;
  return {
    signupToken: body.signupToken,
    expiresAt: Number.isFinite(exp) ? exp : now + 10 * 60_000,
    via,
    suggested: body.suggested ? { displayName: body.suggested.displayName ?? null, needsUsername: body.suggested.needsUsername } : undefined,
  };
}
