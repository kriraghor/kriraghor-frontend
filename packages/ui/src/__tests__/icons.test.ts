import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_ICONS, ICON_VERSION, MANIFEST_ICONS } from "../brand/icons";

// The icons every app links to (the new "K", 23 Nov 2026) exist in each app, under versioned addresses.
const root = join(__dirname, "..", "..", "..", "..");
const urls = [...BRAND_ICONS.icon, ...BRAND_ICONS.apple].map((i) => i.url).concat(MANIFEST_ICONS.map((i) => i.src));

describe("site icons", () => {
  it("are versioned so browsers and Google fetch the new logo", () => {
    for (const u of urls) expect(u).toBe(`${u.split("?")[0]}?v=${ICON_VERSION}`);
    for (const u of urls) expect(u).toMatch(/^\/[a-z0-9-]+\.(png|ico)\?v=/);
  });

  it.each(["web", "esports", "gym", "portal"])("exist in the %s app", (app) => {
    for (const u of urls) {
      const file = u.split("?")[0].slice(1);
      const at = file === "favicon.ico" ? join(root, "apps", app, "src", "app", file) : join(root, "apps", app, "public", file);
      expect(existsSync(at), at).toBe(true);
    }
  });

  it("give Google a size that is a multiple of 48 px", () => {
    expect(BRAND_ICONS.icon.some((i) => Number(i.sizes.split("x")[0]) % 48 === 0)).toBe(true);
  });
});
