import Script from "next/script";

/**
 * Applies the visitor's theme before the first paint (no flash of the wrong theme): "light" or "dark" goes
 * on <html data-theme>; none means follow the system, or `fallback` when the site has its own default (the
 * gym and esports sites are dark first). The layout marks <html> suppressHydrationWarning because this
 * attribute is set before React hydrates.
 *
 * One choice for every site (tester feedback, 19 Nov 2026): the pick is a cookie on the shared parent
 * domain (kriraghor.com for www, gym, esports, admin and vendor; staging.kriraghor.com on staging;
 * kriraghor.localhost in k3d), so switching on one site switches them all. A pick saved before then only in
 * this site's localStorage is copied to the cookie once. Hosts without a shared parent (localhost, an IP,
 * a Vercel preview) keep a cookie of their own.
 */
export const THEME_KEY = "kg.theme";
export const THEME_COOKIE = "kg_theme";
/** First labels of the Kriraghor sites; what follows them is the shared parent domain. */
export const SITE_LABELS = ["www", "gym", "esports", "admin", "vendor"];

/** The domain the theme cookie is shared on, or null for a host-only cookie. */
export function themeCookieDomain(hostname: string): string | null {
  const h = hostname.toLowerCase();
  if (!h.includes(".") || /^[\d.]+$/.test(h) || h.startsWith("[")) return null;
  const parts = h.split(".");
  return parts.length >= 3 && SITE_LABELS.includes(parts[0]!) ? parts.slice(1).join(".") : h;
}

/** The cookie string that saves a theme for every site (a year; not secret, so readable by scripts). */
export function themeCookie(theme: "light" | "dark", hostname: string, secure: boolean): string {
  const domain = themeCookieDomain(hostname);
  return `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; SameSite=Lax${domain ? `; domain=${domain}` : ""}${secure ? "; Secure" : ""}`;
}

// ES5 on purpose: it runs before any bundle. Mirrors themeCookieDomain and themeCookie above (tested together).
export const themeScript = (fallback?: "light" | "dark") =>
  `(function(){var d=document.documentElement,L=location,t=null;` +
  `function dm(h){h=h.toLowerCase();if(h.indexOf(".")<0||/^[\\d.]+$/.test(h)||h.charAt(0)==="[")return"";var p=h.split(".");return"; domain="+(p.length>=3&&${JSON.stringify(SITE_LABELS)}.indexOf(p[0])>=0?p.slice(1).join("."):h)}` +
  `var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)(?:;|$)/);if(m)t=m[1];` +
  `if(!t){try{var l=localStorage.getItem("${THEME_KEY}");if(l==="light"||l==="dark"){t=l;document.cookie="${THEME_COOKIE}="+l+"; path=/; max-age=31536000; SameSite=Lax"+dm(L.hostname)+(L.protocol==="https:"?"; Secure":"")}}catch(e){}}` +
  `if(t){d.dataset.theme=t;return}${fallback ? `d.dataset.theme="${fallback}"` : ""}})();`;

export function ThemeScript({ fallback }: { fallback?: "light" | "dark" } = {}) {
  // beforeInteractive: in the document head, before the body paints and before React loads.
  // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document -- App Router root layout (a Pages Router rule)
  return <Script id="kg-theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript(fallback) }} />;
}
