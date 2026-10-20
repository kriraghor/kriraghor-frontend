/** Read a cookie visible to this page (the API sets the hint and CSRF cookies on COOKIE_HINT_DOMAIN). */
export function readCookie(name: string, source: string = typeof document === "undefined" ? "" : document.cookie): string | undefined {
  for (const part of source.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}
