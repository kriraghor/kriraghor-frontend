import { describe, expect, it } from "vitest";
import en from "../../../../messages/en.json";
import bn from "../../../../messages/bn.json";
import { replyErrorKey, replyOk, replyState, reviewSubjectsFor, subjectName } from "../trust";

describe("the business panel's reviews (M17 FR-34, Round B1)", () => {
  it("offers the review kinds for the business roles held, in sidebar order", () => {
    expect(reviewSubjectsFor(["gym_owner", "ground_owner"])).toEqual(["ground", "gym"]);
    expect(reviewSubjectsFor(["shop_owner"])).toEqual(["shop"]);
    expect(reviewSubjectsFor(["organiser", "member"])).toEqual([]);
    expect(reviewSubjectsFor([])).toEqual([]);
  });

  it("marks a review replied or waiting for the owner's reply", () => {
    expect(replyState({ reply: null })).toBe("awaiting_reply");
    expect(replyState({ reply: { text: "Thanks for coming" } })).toBe("replied");
  });

  it("names the place from the API's subjectName, else the owner's own list", () => {
    const names = new Map([["g1", "Dhanmondi Turf"]]);
    expect(subjectName({ subjectId: "g1", subjectName: "Iron House" }, names)).toBe("Iron House");
    expect(subjectName({ subjectId: "g1" }, names)).toBe("Dhanmondi Turf");
    expect(subjectName({ subjectId: "g1", subjectName: " " }, names)).toBe("Dhanmondi Turf");
    expect(subjectName({ subjectId: "x" }, names)).toBeNull();
  });

  it("checks the reply length and explains a refused reply", () => {
    expect(replyOk("a")).toBe(false);
    expect(replyOk("  ok  ")).toBe(true);
    expect(replyOk("x".repeat(1001))).toBe(false);
    expect(replyErrorKey("REPLY_HAS_CONTACT")).toBe("REPLY_HAS_CONTACT");
    expect(replyErrorKey("REVIEW_STATE")).toBe("REVIEW_STATE");
    expect(replyErrorKey("BOOM")).toBe("failed");
    expect(replyErrorKey(undefined)).toBe("failed");
  });

  it("has every reply state, error and kind in both languages", () => {
    for (const m of [en, bn]) {
      for (const s of ["replied", "awaiting_reply"] as const) expect(m.vendorTrust.replyState[s]).toBeTruthy();
      for (const c of ["REPLY_HAS_CONTACT", "NOT_OWNER", "REVIEW_STATE", "VALIDATION_FAILED", "failed"] as const) expect(m.vendorTrust.replyErrors[c]).toBeTruthy();
      for (const k of ["ground", "shop", "gym"] as const) {
        expect(m.vendorTrust.subject[k]).toBeTruthy();
        expect(m.vendorTrust.subjectPlural[k]).toBeTruthy();
      }
    }
  });
});
