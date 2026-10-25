import { describe, expect, it } from "vitest";
import { addDays, subscriptionTone } from "../trainer";
import { asOfRole, roleFromAs } from "../kyc";

// The member's gym pages (hub, gym page, passes) moved to gym.kriraghor.com with their tests
// (apps/gym/src/lib/__tests__/gym.test.ts). Trainers' monthly plans stay here with Hire (M20 §6).
describe("trainer plans (M20 §6)", () => {
  it("counts calendar days across month ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("colours subscriptions by phase", () => {
    expect(subscriptionTone("active")).toBe("ok");
    expect(subscriptionTone("renewal_due")).toBe("warn");
    expect(subscriptionTone("grace")).toBe("warn");
    expect(subscriptionTone("pending_payment")).toBe("warn");
    expect(subscriptionTone("lapsed")).toBe("error");
    expect(subscriptionTone("ended")).toBe("muted");
  });

  it("maps ?as=gym to the gym_owner role and back", () => {
    expect(roleFromAs("gym")).toBe("gym_owner");
    expect(asOfRole("gym_owner")).toBe("gym");
    expect(roleFromAs(null)).toBe("ground_owner");
  });
});
