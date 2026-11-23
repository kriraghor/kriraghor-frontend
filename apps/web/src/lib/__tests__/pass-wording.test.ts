import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import bn from "../../../messages/bn.json";

/**
 * Product owner, 23 Nov 2026: a gym package a member buys is a **pass** (পাস), never a "subscription".
 * "Subscription" stays only for fitness trainers' monthly plans and the plan a gym owner pays Kriraghor,
 * listed here key by key. A new key that says "subscription" fails until it says "pass" or joins this list.
 */
const ALLOWED_SUBSCRIPTION_KEYS = [
  // trainers' monthly plans (/me/subscriptions)
  "me.subscriptions",
  "gym.signInToSubscribe",
  "gym.subscribeFor",
  "gym.cancelAtEnd",
  "gym.err.OWN_PLAN",
  "gym.err.ALREADY_SUBSCRIBED",
  "gym.desk.subscribers",
  "gym.desk.noSubscribers",
  // the plans gym owners pay Kriraghor (gym_saas revenue), not a member's pass
  "dashboard.verticals.gym_saas",
];

const SUBSCRIPTION = /subscription|সাবস্ক্রিপশন/i;

function flatten(tree: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (typeof tree === "string") out[prefix] = tree;
  else if (tree && typeof tree === "object") for (const [k, v] of Object.entries(tree)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

describe("gym packages are passes on kriraghor.com (23 Nov 2026)", () => {
  it.each([
    ["en", en],
    ["bn", bn],
  ] as const)("no %s message calls a pass a subscription", (_locale, messages) => {
    const offenders = Object.entries(flatten(messages))
      .filter(([key, value]) => SUBSCRIPTION.test(value) && !ALLOWED_SUBSCRIPTION_KEYS.includes(key))
      .map(([key, value]) => `${key}: ${value}`);
    expect(offenders).toEqual([]);
  });

  it("every allow-listed key still exists in both languages", () => {
    for (const key of ALLOWED_SUBSCRIPTION_KEYS) {
      expect(flatten(en)[key], key).toBeTruthy();
      expect(flatten(bn)[key], key).toBeTruthy();
    }
  });

  it("the member area names gym passes apart from trainer subscriptions", () => {
    expect([en.me.passes, bn.me.passes]).toEqual(["Gym passes", "জিম পাস"]);
    expect(en.me.subscriptions).toBe("Trainer subscriptions");
  });
});
