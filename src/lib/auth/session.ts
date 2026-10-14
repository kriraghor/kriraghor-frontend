import { publicEnv } from "@/lib/env";
import { readCookie } from "@/lib/cookies";

/**
 * Client session (ADR-004).
 * - The access token lives only in memory (never localStorage).
 * - The refresh token is an httpOnly cookie on the API host; refresh sends it with credentials: "include".
 * - Refresh also sends X-CSRF-Token, copied from the readable CSRF cookie.
 * - The readable "signed in" hint cookie only tells us whether a refresh is worth trying.
 * Customer apps use audience "api"; the admin portal uses "admin" (separate cookies and endpoints).
 */
export type Audience = "api" | "admin";

const tokens: Record<Audience, string | null> = { api: null, admin: null };
const inflight: Partial<Record<Audience, Promise<string | null>>> = {};

const cookieNames = (audience: Audience) => {
  const p = publicEnv().COOKIE_PREFIX;
  return audience === "admin" ? { hint: `${p}_asi`, csrf: `${p}_acsrf` } : { hint: `${p}_si`, csrf: `${p}_csrf` };
};

export const getAccessToken = (audience: Audience = "api") => tokens[audience];

export function setAccessToken(token: string | null, audience: Audience = "api") {
  tokens[audience] = token;
}

/** True when the API says a session probably exists (routing hint only, never authorisation). */
export const hasSessionHint = (audience: Audience = "api") => readCookie(cookieNames(audience).hint) === "1";

export const csrfToken = (audience: Audience = "api") => readCookie(cookieNames(audience).csrf);

/**
 * Rotate the refresh cookie and get a new access token. Concurrent callers share one request,
 * because a second rotation with the same cookie would look like token theft and end the session.
 */
export function refresh(audience: Audience = "api", fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const existing = inflight[audience];
  if (existing) return existing;
  const path = audience === "admin" ? "/auth/admin/refresh" : "/auth/refresh";
  const run = (async () => {
    try {
      const res = await fetchImpl(`${publicEnv().API_URL}${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken(audience) ?? "" },
        body: "{}",
      });
      if (!res.ok) {
        setAccessToken(null, audience);
        return null;
      }
      const body = (await res.json()) as { accessToken: string };
      setAccessToken(body.accessToken, audience);
      return body.accessToken;
    } catch {
      return null;
    } finally {
      delete inflight[audience];
    }
  })();
  inflight[audience] = run;
  return run;
}

/** Codes after which a refresh can fix the request (M01-FR-07/08). */
const REFRESHABLE = new Set(["TOKEN_EXPIRED", "AUTHZ_STALE"]);

/**
 * fetch with the bearer token. On 401 TOKEN_EXPIRED or AUTHZ_STALE it refreshes once and retries.
 * Used as the openapi-fetch `fetch` option.
 */
export function createAuthFetch(audience: Audience = "api", fetchImpl: typeof fetch = fetch) {
  return async function authFetch(input: Request): Promise<Response> {
    const send = (token: string | null) => {
      const req = input.clone();
      if (token) req.headers.set("Authorization", `Bearer ${token}`);
      return fetchImpl(req);
    };
    const first = await send(getAccessToken(audience));
    if (first.status !== 401) return first;
    const code = await first
      .clone()
      .json()
      .then((b: { code?: string }) => b.code)
      .catch(() => undefined);
    if (!code || !REFRESHABLE.has(code)) return first;
    const token = await refresh(audience, fetchImpl);
    return token ? send(token) : first;
  };
}
