/**
 * The site icons for every app's metadata and web app manifest (the new "K", 23 Nov 2026).
 *
 * Browsers and Google keep a site's icon by its address, so a new logo needs new addresses: bump
 * ICON_VERSION whenever scripts/split-logo.mjs writes new icons. Google wants a square icon whose side is a
 * multiple of 48 px (the 48 px favicon.ico and icon-192.png); phones use apple-icon.png and the 512s.
 */
export const ICON_VERSION = "k1";

const v = (path: string) => `${path}?v=${ICON_VERSION}`;

/** For Next's `metadata.icons`. */
export const BRAND_ICONS = {
  icon: [
    { url: v("/favicon.ico"), sizes: "48x48", type: "image/x-icon" },
    { url: v("/icon-192.png"), sizes: "192x192", type: "image/png" },
    { url: v("/icon-512.png"), sizes: "512x512", type: "image/png" },
  ],
  apple: [{ url: v("/apple-icon.png"), sizes: "180x180", type: "image/png" }],
};

/** For a web app manifest's `icons`: the rounded tiles, and a full-bleed one Android can crop to its shape. */
export const MANIFEST_ICONS = [
  { src: v("/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" as const },
  { src: v("/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" as const },
  { src: v("/icon-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" as const },
];
