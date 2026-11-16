import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { duration, palette, paletteV2, radius } from "./tokens";

const css = readFileSync(join(__dirname, "..", "tokens.css"), "utf8");
const darkStart = css.indexOf("@media (prefers-color-scheme: dark)");
const themeStart = css.indexOf("@theme inline");

/** --kg-* hex values from one block of tokens.css. */
function block(from: number, to: number) {
  const out = new Map<string, string>();
  for (const m of css.slice(from, to).matchAll(/--kg-([a-z0-9-]+):\s*(#[0-9a-f]{6})/g)) out.set(m[1], m[2]);
  return out;
}
const camel = (s: string) => s.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

describe("tokens.ts matches tokens.css", () => {
  it.each([
    ["light", block(0, darkStart)],
    ["dark", block(darkStart, themeStart)],
  ] as const)("%s colours", (mode, values) => {
    expect(values.size).toBeGreaterThan(10);
    for (const [name, hex] of values) {
      const key = camel(name) as keyof (typeof palette)["light"];
      if (!(key in palette[mode])) continue; // web-only tokens (focus, band-2 …)
      expect([name, palette[mode][key]]).toEqual([name, hex]);
    }
  });

  it("every app colour exists in the CSS", () => {
    const light = block(0, darkStart);
    for (const key of Object.keys(palette.light)) {
      const name = key.replace(/[A-Z0-9]/g, (c) => `-${c.toLowerCase()}`);
      expect(light.has(name), name).toBe(true);
    }
  });

  it("the shape rule", () => {
    expect(css).toContain(`--radius-control: ${radius.control}px`);
    expect(css).toContain(`--radius-card: ${radius.card}px`);
  });
});

describe("UI v2 tokens match between tokens.ts and tokens.css", () => {
  const v2Light = css.indexOf('[data-ui="v2"] {');
  const v2Media = css.indexOf('@media (prefers-color-scheme: dark)', v2Light);
  const v2Dark = css.indexOf(':root[data-theme="dark"] [data-ui="v2"]');
  const kebab = (k: string) => k.replace(/[A-Z0-9]/g, (c) => `-${c.toLowerCase()}`);

  it("has the three blocks in order, after everything else", () => {
    expect(v2Light).toBeGreaterThan(themeStart);
    expect(v2Media).toBeGreaterThan(v2Light);
    expect(v2Dark).toBeGreaterThan(v2Media);
  });

  it.each([
    ["light", () => block(v2Light, v2Media)],
    ["dark (system)", () => block(v2Media, v2Dark)],
    // The extras that follow (the band shades and focus ring) are not palette colours.
    ["dark (chosen)", () => block(v2Dark, css.includes("/* UI v2 extras") ? css.indexOf("/* UI v2 extras") : css.length)],
  ] as const)("%s colours", (mode, read) => {
    const values = read();
    const source = paletteV2[mode === "light" ? "light" : "dark"];
    expect([...values.keys()].sort()).toEqual(Object.keys(source).map(kebab).sort());
    for (const [key, hex] of Object.entries(source)) expect([key, values.get(kebab(key))]).toEqual([key, hex]);
  });

  it("gives light and dark the same names", () => {
    expect(Object.keys(paletteV2.dark)).toEqual(Object.keys(paletteV2.light));
  });
});

describe("motion durations match", () => {
  it.each(Object.entries(duration))("%s", (name, ms) => {
    expect(css).toContain(`--duration-${name}: ${ms}ms`);
  });
});
