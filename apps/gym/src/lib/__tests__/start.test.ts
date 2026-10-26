import { describe, expect, it } from "vitest";
import { startStep } from "../start";
import { privateStep, suggestShortCode } from "../gym-manage";

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

describe("/start: the private gym path (M24-FR-01, FR-09)", () => {
  it("needs a signed-in account with a verified phone, then walks gym → short code → packages → next", () => {
    expect(privateStep({ signedIn: false, phoneVerified: true, gymId: null, step: null })).toBe("signIn");
    expect(privateStep({ signedIn: true, phoneVerified: false, gymId: null, step: null })).toBe("phone");
    expect(privateStep({ signedIn: true, phoneVerified: true, gymId: null, step: "packages" })).toBe("gym");
    expect(privateStep({ signedIn: true, phoneVerified: true, gymId: "g1", step: null })).toBe("code");
    expect(privateStep({ signedIn: true, phoneVerified: true, gymId: "g1", step: null, setupDone: true })).toBe("packages");
    expect(privateStep({ signedIn: true, phoneVerified: true, gymId: "g1", step: "code", setupDone: true })).toBe("code");
    expect(privateStep({ signedIn: true, phoneVerified: true, gymId: "g1", step: "packages" })).toBe("packages");
    expect(privateStep({ signedIn: true, phoneVerified: true, gymId: "g1", step: "next" })).toBe("next");
    expect(privateStep({ signedIn: true, phoneVerified: true, gymId: "g1", step: "nonsense" })).toBe("code");
  });

  it("suggests a short code from the gym's name (2 to 6 capitals)", () => {
    expect(suggestShortCode("PowerHouse Gym Mirpur")).toBe("PM");
    expect(suggestShortCode("Iron Paradise Fitness Club Uttara Sector 7")).toBe("IPUS");
    expect(suggestShortCode("Lift")).toBe("LIF");
    expect(suggestShortCode("জিম ১")).toBe("GYM");
    expect(suggestShortCode("The Gym")).toBe("GYM");
  });
});
