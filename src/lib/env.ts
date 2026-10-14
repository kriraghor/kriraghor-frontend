/**
 * Runtime public config (ADR-003). The same image runs in dev, staging and prod: the server reads
 * process.env, and the browser reads window.__ENV, which /env.js sets before hydration.
 * Only the keys listed here are ever exposed. Never add a secret.
 */
export const PUBLIC_ENV_KEYS = [
  "API_URL",
  "REALTIME_URL",
  "WEB_URL",
  "ESPORTS_URL",
  "ADMIN_URL",
  "VENDOR_URL",
  "COOKIE_PREFIX",
  "GOOGLE_CLIENT_ID",
  "APP_ENV",
] as const;

export type PublicEnvKey = (typeof PUBLIC_ENV_KEYS)[number];
export type PublicEnv = Record<PublicEnvKey, string>;

const DEFAULTS: PublicEnv = {
  API_URL: "http://localhost:4000/api/v1",
  REALTIME_URL: "http://localhost:4001",
  WEB_URL: "http://localhost:3000",
  ESPORTS_URL: "http://localhost:3001",
  ADMIN_URL: "http://localhost:3002",
  VENDOR_URL: "http://localhost:3002",
  COOKIE_PREFIX: "kg",
  GOOGLE_CLIENT_ID: "",
  APP_ENV: "local",
};

declare global {
  interface Window {
    __ENV?: Partial<PublicEnv>;
  }
}

/** Values for /env.js, read from the server environment at request time. */
export function serverPublicEnv(source: Record<string, string | undefined> = process.env): PublicEnv {
  const out = { ...DEFAULTS };
  for (const key of PUBLIC_ENV_KEYS) {
    const v = source[key];
    if (typeof v === "string" && v !== "") out[key] = v;
  }
  return out;
}

/** Public config in the browser (window.__ENV) or on the server (process.env). */
export function publicEnv(): PublicEnv {
  if (typeof window !== "undefined") return { ...DEFAULTS, ...(window.__ENV ?? {}) };
  return serverPublicEnv();
}
