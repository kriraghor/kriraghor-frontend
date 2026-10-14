import { describe, expect, it } from "vitest";
import { areaForHost } from "../area";

describe("portal host routing", () => {
  it.each([
    ["admin.kriraghor.com", undefined, "admin"],
    ["admin.staging.kriraghor.com", undefined, "admin"],
    ["vendor.kriraghor.localhost", undefined, "vendor"],
    ["localhost:3002", undefined, "admin"],
    ["localhost:3002", "vendor", "vendor"],
    [null, undefined, "admin"],
  ])("%s (default %s) → %s", (host, fallback, area) => {
    expect(areaForHost(host, fallback)).toBe(area);
  });
});
