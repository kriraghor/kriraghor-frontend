import { describe, expect, it } from "vitest";
import { sharedMessages } from "@kriraghor/ui/i18n/messages";
import en from "../../../messages/en.json";
import bn from "../../../messages/bn.json";

/**
 * Product owner, 23 Nov 2026: a gym package a member buys is a **pass** (পাস), never a "subscription".
 * "Subscription" stays only for fitness trainers' monthly plans, listed here key by key. A new key that
 * says "subscription" fails until it says "pass" or joins this list for a trainer plan.
 */
const TRAINER_SUBSCRIPTION_KEYS = [
  "gym.signInToSubscribe",
  "gym.subscribeFor",
  "gym.mySubscriptions",
  "gym.noSubscriptions",
  "gym.cancelAtEnd",
  "gym.err.OWN_PLAN",
  "gym.err.ALREADY_SUBSCRIBED",
  "gym.desk.subscribers",
  "gym.desk.noSubscribers",
  "gp.trainers.mine",
];
/** The kit's shared messages (packages/ui), merged under the gym app's. */
const SHARED_TRAINER_SUBSCRIPTION_KEYS = ["payments.backToSubscriptions"];

const SUBSCRIPTION = /subscription|সাবস্ক্রিপশন/i;

function flatten(tree: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (typeof tree === "string") out[prefix] = tree;
  else if (tree && typeof tree === "object") for (const [k, v] of Object.entries(tree)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}
const offenders = (messages: unknown, allow: string[]) =>
  Object.entries(flatten(messages))
    .filter(([key, value]) => SUBSCRIPTION.test(value) && !allow.includes(key))
    .map(([key, value]) => `${key}: ${value}`);

describe("gym packages are passes (23 Nov 2026)", () => {
  it.each([
    ["en", en],
    ["bn", bn],
  ] as const)("no gym-app %s message calls a pass a subscription", (_locale, messages) => {
    expect(offenders(messages, TRAINER_SUBSCRIPTION_KEYS)).toEqual([]);
  });

  it.each([
    ["en", sharedMessages.en],
    ["bn", sharedMessages.bn],
  ] as const)("no shared %s message calls a pass a subscription", (_locale, messages) => {
    expect(offenders(messages, SHARED_TRAINER_SUBSCRIPTION_KEYS)).toEqual([]);
  });

  it("every allow-listed key still exists in both languages", () => {
    for (const key of TRAINER_SUBSCRIPTION_KEYS) {
      expect(flatten(en)[key], key).toBeTruthy();
      expect(flatten(bn)[key], key).toBeTruthy();
    }
    for (const key of SHARED_TRAINER_SUBSCRIPTION_KEYS) {
      expect(flatten(sharedMessages.en)[key], key).toBeTruthy();
      expect(flatten(sharedMessages.bn)[key], key).toBeTruthy();
    }
  });

  it("the nav, footer and member area say My passes, apart from trainers' My subscriptions", () => {
    for (const m of [en, bn]) {
      const want = m === en ? "My passes" : "আমার পাস";
      expect([m.nav.myPasses, m.footer.myPasses, m.gym.myPasses]).toEqual([want, want, want]);
      expect(m.gym.mySubscriptions).not.toBe(want);
    }
  });
});
