import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The proxy matcher decides which paths get locale handling. Read it as text (importing proxy.ts
// pulls in next-intl's middleware) and check that pages go through and files do not. A matcher with
// an unescaped dot sent every page but "/" to a 404 (Round A, 21 Oct 2026).
const source = readFileSync(path.join(__dirname, "..", "..", "proxy.ts"), "utf8");
const pattern = JSON.parse(source.match(/matcher:\s*\[\s*("(?:[^"\\]|\\.)*")/)![1]) as string;
const matches = (p: string) => new RegExp(`^${pattern}$`).test(p);

describe("gym proxy matcher", () => {
  it("runs on pages", () => {
    for (const p of ["/", "/gyms", "/gyms/iron-house", "/me/passes", "/me/passes/GP-31XZ", "/me/subscriptions", "/manage", "/manage/g1/desk", "/start", "/sign-in", "/pay/0b9e2c1a-7f00-4a1e-9c51-2f7f0f2b6a10", "/pay/0b9e2c1a-7f00-4a1e-9c51-2f7f0f2b6a10/result"]) expect(matches(p), p).toBe(true);
  });

  it("also runs on the receipt links, whose tokens carry dots (M24-FR-37)", () => {
    expect(matches("/r/v1.01a17594-ec2b.e18c2bff")).toBe(false);
    expect(source).toContain('"/r/:token"');
  });

  it("also runs on the payment links, whose tokens carry dots too (M24 prompt 2)", () => {
    expect(matches("/p/v1.01a17594-ec2b.e18c2bff")).toBe(false);
    expect(source).toContain('"/p/:token"');
  });

  it("skips files, Next internals, the API, /go/ and /env.js", () => {
    for (const p of ["/logo.png", "/_next/static/chunk.js", "/api/health", "/go/web/help", "/env.js", "/sitemap.xml", "/robots.txt", "/manifest.webmanifest"]) expect(matches(p), p).toBe(false);
  });
});
