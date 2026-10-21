import { describe, expect, it } from "vitest";
import { DOMAINS, badgeTone, toneOf } from "../status-tones";
import { readFilters, writeFilters, type FilterSpec } from "../use-url-filters";

describe("status tones", () => {
  it("a desk's own meaning wins, then the shared money statuses, then neutral", () => {
    expect(toneOf("awaiting_response", "dispute")).toBe("muted"); // routine for staff
    expect(toneOf("awaiting_response", "ownerDispute")).toBe("bad"); // the owner must answer
    expect(toneOf("failed", "payout")).toBe("bad");
    expect(toneOf("succeeded", "order")).toBe("ok"); // not in order: the shared map
    expect(toneOf("something_new", "order")).toBe("muted");
    expect(toneOf(null)).toBe("muted");
    expect(badgeTone("live", "listing")).toBe("brand");
    expect(badgeTone("on_hold", "payout")).toBe("danger");
  });

  it("every domain uses only the four tones", () => {
    for (const map of Object.values(DOMAINS)) for (const tone of Object.values(map)) expect(["ok", "warn", "bad", "muted"]).toContain(tone);
  });
});

describe("URL filters", () => {
  const spec = { status: { default: "pending_master", allowed: ["", "pending_master", "approved", "failed"] }, q: { default: "" } } satisfies FilterSpec<"status" | "q">;

  it("reads defaults, values, and refuses values that are not allowed", () => {
    expect(readFilters(new URLSearchParams(""), spec)).toEqual({ status: "pending_master", q: "" });
    expect(readFilters(new URLSearchParams("status=failed&q=bkash"), spec)).toEqual({ status: "failed", q: "bkash" });
    expect(readFilters(new URLSearchParams("status=hacked"), spec).status).toBe("pending_master");
    expect(readFilters(new URLSearchParams("status="), spec).status).toBe(""); // "all" is allowed
  });

  it("writes only what differs from the default and keeps other parameters", () => {
    const now = new URLSearchParams("tab=refunds&id=r1&status=failed");
    expect(writeFilters(now, spec, { status: "pending_master" })).toBe("?tab=refunds&id=r1");
    expect(writeFilters(now, spec, { q: "nagad" })).toBe("?tab=refunds&id=r1&status=failed&q=nagad");
    expect(writeFilters(now, spec, { id: null })).toBe("?tab=refunds&status=failed");
    expect(writeFilters(new URLSearchParams(""), spec, { status: "pending_master", q: "" })).toBe("");
  });

  it("an empty status that is not the default is kept, so 'all' survives a reload", () => {
    expect(writeFilters(new URLSearchParams(""), spec, { status: "" })).toBe("?status=");
    expect(readFilters(new URLSearchParams("status="), spec).status).toBe("");
  });
});
