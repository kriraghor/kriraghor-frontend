import { describe, expect, it } from "vitest";
import { startStep, tierName, tierPrices } from "../start";

describe("landing prices from the public settings (never hard-coded)", () => {
  it("shows no price until the M24 tier settings exist", () => {
    expect(tierPrices(undefined)).toBeNull();
    expect(tierPrices({})).toBeNull();
    expect(tierPrices({ gym: { passAdvanceDays: 7, subscriptionGraceDays: 3 } })).toBeNull();
    expect(tierPrices({ gym: "x" })).toBeNull();
  });

  it("lists each numeric gym.tier* setting, cheapest first", () => {
    expect(tierPrices({ gym: { tierProPoisha: 150000, tierStarterPoisha: 50000, tierBad: "x", passAdvanceDays: 7 } })).toEqual([
      { key: "tierStarterPoisha", poisha: 50000 },
      { key: "tierProPoisha", poisha: 150000 },
    ]);
    expect(tierPrices({ gym: { tierFree: 0 } })).toEqual([{ key: "tierFree", poisha: 0 }]);
    expect(tierName("tierStarterPoisha")).toBe("Starter");
    expect(tierName("tierMultiBranchPrice")).toBe("Multi Branch");
  });
});

describe("/start: from the gym owner application to the first gym", () => {
  const role = (status: string) => [{ role: "member", status: "active" }, { role: "gym_owner", status }];
  it("asks a visitor to sign in, then to apply", () => {
    expect(startStep(false, role("active"))).toBe("signIn");
    expect(startStep(true, undefined)).toBe("apply");
    expect(startStep(true, [{ role: "shop_owner", status: "active" }])).toBe("apply");
    expect(startStep(true, role("rejected"))).toBe("apply");
    expect(startStep(true, role("withdrawn"))).toBe("apply");
  });

  it("sends an application on to its documents, waits during review, and opens gym creation once active", () => {
    expect(startStep(true, role("applied"))).toBe("documents");
    expect(startStep(true, role("documents_pending"))).toBe("documents");
    expect(startStep(true, role("changes_requested"))).toBe("documents");
    expect(startStep(true, role("in_review"))).toBe("review");
    expect(startStep(true, role("active"))).toBe("create");
    expect(startStep(true, role("suspended"))).toBe("suspended");
  });
});
