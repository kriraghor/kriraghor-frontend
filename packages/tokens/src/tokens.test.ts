import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { palette, radius } from "./tokens";

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
