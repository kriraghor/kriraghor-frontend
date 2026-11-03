/** A same-site path to return to after sign-in (never another host, so the link can't redirect away). */
export function safeNext(raw: string | string[] | undefined, fallback = "/me"): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : fallback;
}
