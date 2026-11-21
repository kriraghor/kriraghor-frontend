import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import en from "../../../messages/en.json";
import bn from "../../../messages/bn.json";
import { isSignupCancel, parseSignupMessage } from "../meta-signup";
import { emptySegment, segmentFrom } from "../gym-ops";
import { notReached, previewText, sendBlock, sendCounts, unitsCardState, waProblemKey, type PreviewSay } from "../whatsapp";

const sayIn = (locale: "en" | "bn"): PreviewSay => {
  const t = createTranslator({ locale, messages: (locale === "bn" ? bn : en).gw.preview }) as unknown as (k: string, v?: Record<string, string>) => string;
  return (key, values) => t(key, values ?? {});
};
const msgs = (locale: "en" | "bn") => createTranslator({ locale, messages: (locale === "bn" ? bn : en).gw }) as unknown as (k: string, v?: Record<string, string>) => string;

describe("Meta embedded sign-up messages (M24-FR-160)", () => {
  const finish = { type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: { phone_number_id: "111", waba_id: "222" } };
  it("reads the ids from Facebook's FINISH message, as JSON text or an object", () => {
    expect(parseSignupMessage({ origin: "https://www.facebook.com", data: JSON.stringify(finish) })).toEqual({ phoneNumberId: "111", wabaId: "222" });
    expect(parseSignupMessage({ origin: "https://web.facebook.com", data: finish })).toEqual({ phoneNumberId: "111", wabaId: "222" });
    expect(parseSignupMessage({ origin: "https://www.facebook.com", data: { ...finish, event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING", data: { phone_number_id: 333, waba_id: 444 } } })).toEqual({ phoneNumberId: "333", wabaId: "444" });
  });

  it("ignores other origins, other messages, other events, missing ids and bad JSON", () => {
    expect(parseSignupMessage({ origin: "https://evil.example", data: finish })).toBeNull();
    expect(parseSignupMessage({ origin: "https://www.facebook.com", data: { ...finish, type: "OTHER" } })).toBeNull();
    expect(parseSignupMessage({ origin: "https://www.facebook.com", data: { ...finish, event: "CANCEL" } })).toBeNull();
    expect(parseSignupMessage({ origin: "https://www.facebook.com", data: { ...finish, data: { phone_number_id: "111" } } })).toBeNull();
    expect(parseSignupMessage({ origin: "https://www.facebook.com", data: "{not json" })).toBeNull();
    expect(parseSignupMessage({ origin: "https://www.facebook.com", data: null })).toBeNull();
  });

  it("knows a cancelled or failed sign-up", () => {
    expect(isSignupCancel({ origin: "https://www.facebook.com", data: JSON.stringify({ type: "WA_EMBEDDED_SIGNUP", event: "CANCEL", data: {} }) })).toBe(true);
    expect(isSignupCancel({ origin: "https://www.facebook.com", data: { type: "WA_EMBEDDED_SIGNUP", event: "ERROR" } })).toBe(true);
    expect(isSignupCancel({ origin: "https://www.facebook.com", data: finish })).toBe(false);
    expect(isSignupCancel({ origin: "https://evil.example", data: { type: "WA_EMBEDDED_SIGNUP", event: "CANCEL" } })).toBe(false);
  });
});

describe("the message bubble (approved templates, M24-FR-166)", () => {
  it("a notice in English and Bangla, with the STOP line", () => {
    expect(previewText(sayIn("en"), { kind: "notice", gym: "Iron House", title: "Closed on Friday", message: "We open again on Saturday." })).toBe("Iron House: Closed on Friday\n\nWe open again on Saturday.\n\nReply STOP to stop these messages.");
    expect(previewText(sayIn("bn"), { kind: "notice", gym: "Iron House", title: "শুক্রবার বন্ধ", message: "শনিবার আবার খোলা।" })).toBe("Iron House: শুক্রবার বন্ধ\n\nশনিবার আবার খোলা।\n\nএই মেসেজ বন্ধ করতে STOP লিখে উত্তর দিন।");
  });

  it("a greeting has no title; empty parts show as dots", () => {
    expect(previewText(sayIn("en"), { kind: "greeting", gym: "Iron House", title: "ignored", message: "Eid Mubarak!" })).toBe("Iron House: Eid Mubarak!\n\nReply STOP to stop these messages.");
    expect(previewText(sayIn("bn"), { kind: "greeting", gym: "Iron House", message: "  " })).toBe("Iron House: …\n\nএই মেসেজ বন্ধ করতে STOP লিখে উত্তর দিন।");
    expect(previewText(sayIn("en"), { kind: "notice", gym: "G", message: "" })).toBe("G: …\n\n…\n\nReply STOP to stop these messages.");
  });
});

describe("whether a group send can go (M24-FR-166, FR-167)", () => {
  const est = { reachable: 10, unitsNeeded: 20, balance: 100, bulkLeft: 2, senderConnected: true, addonActive: true };
  it("names the first thing in the way", () => {
    expect(sendBlock({ apiEnabled: false, est })).toBe("off");
    expect(sendBlock({ apiEnabled: true, est: null })).toBeNull();
    expect(sendBlock({ apiEnabled: true, est })).toBeNull();
    expect(sendBlock({ apiEnabled: true, est: { ...est, senderConnected: false, addonActive: false } })).toBe("no_sender");
    expect(sendBlock({ apiEnabled: true, est: { ...est, addonActive: false } })).toBe("addon");
    expect(sendBlock({ apiEnabled: true, est: { ...est, reachable: 0 } })).toBe("nobody");
    expect(sendBlock({ apiEnabled: true, est: { ...est, bulkLeft: 0 } })).toBe("cap");
    expect(sendBlock({ apiEnabled: true, est: { ...est, unitsNeeded: 101 } })).toBe("balance");
    expect(sendBlock({ apiEnabled: true, est: { ...est, unitsNeeded: 100 } })).toBeNull();
  });

  it("lists only the reasons with members in them, and every block has words", () => {
    expect(notReached({ no_consent: 3, template: 0, no_sender: 1 })).toEqual([
      { key: "no_consent", n: 3 },
      { key: "no_sender", n: 1 },
    ]);
    expect(notReached({ no_consent: 0, template: 0, no_sender: 0 })).toEqual([]);
    for (const locale of ["en", "bn"] as const) {
      const t = msgs(locale);
      for (const b of ["off", "no_sender", "addon", "nobody", "cap", "balance"]) expect(t(`send.block.${b}`)).not.toBe(`send.block.${b}`);
      expect(t("send.notReached.template", { n: "2" })).toContain("2");
    }
  });
});

describe("WhatsApp problems as words", () => {
  it("maps codes and blocked reasons to gw.err keys, others to the app's helper", () => {
    expect(waProblemKey({ code: "GYM_WHATSAPP_BLOCKED", meta: { reason: "no_consent" } })).toBe("blocked.no_consent");
    expect(waProblemKey({ code: "GYM_WHATSAPP_BLOCKED", meta: { reason: "balance" } })).toBe("blocked.balance");
    expect(waProblemKey({ code: "GYM_WHATSAPP_BLOCKED", meta: { reason: "something_new" } })).toBe("blocked.other");
    expect(waProblemKey({ code: "GYM_WHATSAPP_BLOCKED" })).toBe("blocked.other");
    expect(waProblemKey({ code: "GYM_WHATSAPP_NO_SENDER" })).toBe("blocked.no_sender");
    expect(waProblemKey({ code: "GYM_WHATSAPP_API_OFF" })).toBe("blocked.off");
    expect(waProblemKey({ code: "GYM_WHATSAPP_CAP" })).toBe("cap");
    expect(waProblemKey({ code: "GYM_WHATSAPP_UNAVAILABLE" })).toBe("unavailable");
    expect(waProblemKey({ code: "GYM_WHATSAPP_OFF" })).toBe("addonOff");
    expect(waProblemKey({ code: "GYM_WHATSAPP_NUMBER_TAKEN" })).toBe("numberTaken");
    expect(waProblemKey({ code: "GYM_WHATSAPP_META_FAILED" })).toBe("metaFailed");
    expect(waProblemKey({ code: "GYM_WHATSAPP_RECEIPT" })).toBe("receipt");
    expect(waProblemKey({ code: "GYM_TIER_REQUIRED" })).toBeNull();
    expect(waProblemKey(null)).toBeNull();
  });

  it("every key has EN and BN words", () => {
    const keys = ["off", "tier", "restricted", "addon", "balance", "no_consent", "nobody", "template", "no_sender", "other"].map((r) => `err.blocked.${r}`).concat(["cap", "unavailable", "addonOff", "numberTaken", "metaFailed", "receipt"].map((k) => `err.${k}`));
    for (const locale of ["en", "bn"] as const) {
      const t = msgs(locale);
      for (const k of keys) expect(t(k)).not.toBe(k);
    }
  });
});

describe("sends, segments and the units card", () => {
  it("delivered counts include read; waiting is queued or sent", () => {
    expect(sendCounts({ queued: 2, sent: 3, delivered: 4, read: 5, failed: 1 })).toEqual({ delivered: 9, read: 5, failed: 1, waiting: 5 });
  });

  it("a segment is complete only with its days or package", () => {
    expect(segmentFrom(emptySegment())).toEqual({ kind: "active" });
    expect(segmentFrom({ ...emptySegment(), kind: "expiring", days: "7" })).toEqual({ kind: "expiring", days: 7 });
    expect(segmentFrom({ ...emptySegment(), kind: "not_seen", days: "0" })).toBeNull();
    expect(segmentFrom({ ...emptySegment(), kind: "expired", days: "" })).toBeNull();
    expect(segmentFrom({ ...emptySegment(), kind: "package" })).toBeNull();
    expect(segmentFrom({ ...emptySegment(), kind: "package", packageId: "p1" })).toEqual({ kind: "package", packageId: "p1" });
    expect(segmentFrom({ ...emptySegment(), kind: "class", classId: "c1" })).toEqual({ kind: "class", classId: "c1" });
  });

  it("the billing card: coming soon, the plan, off, on", () => {
    expect(unitsCardState({ enabled: false, available: false, status: null })).toBe("soon");
    expect(unitsCardState({ enabled: true, available: false, status: null })).toBe("plan");
    expect(unitsCardState({ enabled: true, available: true, status: null })).toBe("off");
    expect(unitsCardState({ enabled: true, available: true, status: "paused" })).toBe("off");
    expect(unitsCardState({ enabled: true, available: true, status: "active" })).toBe("on");
  });
});
