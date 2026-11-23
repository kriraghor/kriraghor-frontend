import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import en from "../../../messages/en.json";
import bn from "../../../messages/bn.json";
import { chatHref, classMessage, gymMessage, gymPageUrl, isNumberProblem, needsRecheck, numberOrNull, packageMessage, type WaSay } from "../whatsapp";

// The real words from messages (gym.wa.msg), so a changed sentence shows up here.
const sayIn = (locale: "en" | "bn"): WaSay => {
  const t = createTranslator({ locale, messages: (locale === "bn" ? bn : en).gym.wa.msg }) as unknown as WaSay;
  return (key, values) => t(key, values);
};
const url = gymPageUrl("https://gym.kriraghor.com/", "iron-house");

describe("WhatsApp chat messages on the gym page (M24-FR-158)", () => {
  it("the page address is the share button's", () => {
    expect(url).toBe("https://gym.kriraghor.com/gyms/iron-house");
    expect(gymPageUrl("https://gym.kriraghor.com", "a b")).toBe("https://gym.kriraghor.com/gyms/a%20b");
  });

  it("the header button says where they found the gym", () => {
    expect(gymMessage(sayIn("en"), { gym: "Iron House", url })).toBe("Hi Iron House, I found you on Kriraghor: https://gym.kriraghor.com/gyms/iron-house");
    expect(gymMessage(sayIn("bn"), { gym: "Iron House", url })).toBe("হ্যালো Iron House, ক্রীড়াঘরে আপনাদের খুঁজে পেলাম: https://gym.kriraghor.com/gyms/iron-house");
  });

  it("a pass carries its title, price and days, Bangla digits in bn", () => {
    const x = { gym: "Iron House", title: "Monthly", pricePoisha: 150000, days: 30, url };
    expect(packageMessage(sayIn("en"), "en", x)).toBe("Hi Iron House, I'd like to know about the Monthly pass (৳1,500, 30 days). https://gym.kriraghor.com/gyms/iron-house");
    expect(packageMessage(sayIn("en"), "en", { ...x, days: 1 })).toContain("(৳1,500, 1 day)");
    expect(packageMessage(sayIn("bn"), "bn", x)).toBe("হ্যালো Iron House, Monthly পাস (৳১,৫০০, ৩০ দিন) সম্পর্কে জানতে চাই। https://gym.kriraghor.com/gyms/iron-house");
  });

  it("a class carries its name, day and Dhaka time", () => {
    // 22 Nov 2026 is a Sunday; 12:30 UTC is 18:30 in Dhaka.
    const x = { gym: "Iron House", name: "Zumba", date: "2026-11-22", startsAt: "2026-11-22T12:30:00.000Z" };
    expect(classMessage(sayIn("en"), "en", x)).toBe("Hi Iron House, I'd like to join the Zumba class on Sunday 22 Nov at 18:30.");
    const b = classMessage(sayIn("bn"), "bn", x);
    expect(b).toContain("১৮:৩০");
    expect(b).toContain("রবিবার");
    expect(b).toContain("Zumba ক্লাসে যোগ দিতে চাই।");
  });

  it("no number, no link; a number gives the wa.me chat with the message", () => {
    expect(chatHref(null, "x")).toBeNull();
    expect(chatHref(undefined, "x")).toBeNull();
    expect(chatHref("+8801712345678", "Hi & bye")).toBe("https://wa.me/8801712345678?text=Hi%20%26%20bye");
  });
});

describe("WhatsApp choices (M24-FR-159)", () => {
  it("asks again only after the consent text changed", () => {
    expect(needsRecheck({ consentVersion: null, currentVersion: 2 })).toBe(false);
    expect(needsRecheck({ consentVersion: 1, currentVersion: 2 })).toBe(true);
    expect(needsRecheck({ consentVersion: 2, currentVersion: 2 })).toBe(false);
  });

  it("a blank number is null (the owner's number, or the member's phone)", () => {
    expect(numberOrNull("  ")).toBeNull();
    expect(numberOrNull(" 01712345678 ")).toBe("01712345678");
  });

  it("knows a bad number from other problems", () => {
    expect(isNumberProblem({ code: "VALIDATION_FAILED", errors: [{ field: "number" }] })).toBe(true);
    expect(isNumberProblem({ code: "VALIDATION_FAILED", errors: [{ field: "news" }] })).toBe(false);
    expect(isNumberProblem({ code: "GYM_SUSPENDED" })).toBe(false);
    expect(isNumberProblem(null)).toBe(false);
  });
});
