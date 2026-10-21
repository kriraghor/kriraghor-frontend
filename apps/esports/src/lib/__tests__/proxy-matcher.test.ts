import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The proxy matcher decides which paths get locale handling. Read it as text (importing proxy.ts
// pulls in next-intl's middleware) and check that pages go through and files do not. A matcher with
// an unescaped dot sent every page but "/" to a 404 (Round A, 21 Oct 2026).
const source = readFileSync(path.join(__dirname, "..", "..", "proxy.ts"), "utf8");
const pattern = JSON.parse(source.match(/matcher:\s*\[\s*("(?:[^"\\]|\\.)*")/)![1]) as string;
const matches = (p: string) => new RegExp(`^${pattern}$`).test(p);

describe("esports proxy matcher", () => {
  it("runs on pages", () => {
    for (const p of ["/", "/events", "/events/ff-weekly-cup", "/p/shadowbd10", "/leaderboards", "/me/matches", "/showcases/winter-clash"]) expect(matches(p)).toBe(true);
  });

  it("skips files, Next internals, the API, /go/ and /env.js", () => {
    for (const p of ["/logo.png", "/_next/static/chunk.js", "/api/health", "/go/abc", "/env.js", "/sitemap.xml", "/robots.txt"]) expect(matches(p)).toBe(false);
  });
});
