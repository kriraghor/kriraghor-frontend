import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import bn from "../../../messages/bn.json";
import {
  ACTIVE_CASE,
  REPORT_REASONS,
  REVIEW_SUBJECTS,
  SUBJECT_OF,
  evidenceTypeOk,
  rateErrorKey,
  ratingSummary,
  replyErrorKey,
  replyOk,
  reviewedGymFromOtherPass,
  sourceHref,
  subjectHref,
  subjectNameOf,
} from "../trust";

const file = (type: string) => new File(["x"], "f", { type });

describe("disputes, reviews and reports helpers (M17)", () => {
  it("accepts only the evidence types the API takes", () => {
    for (const t of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) expect(evidenceTypeOk(file(t))).toBe(true);
    expect(evidenceTypeOk(file("image/gif"))).toBe(false);
    expect(evidenceTypeOk(file(""))).toBe(false);
  });

  it("knows which cases are still open", () => {
    expect([...ACTIVE_CASE]).toEqual(["awaiting_response", "under_review", "escalated"]);
  });

  it("has a label in both languages for every report reason it offers", () => {
    for (const reasons of Object.values(REPORT_REASONS)) {
      for (const r of reasons) {
        expect(en.trust.report.reasons[r]).toBeTruthy();
        expect(bn.trust.report.reasons[r]).toBeTruthy();
      }
    }
  });

  it("keeps the English and Bangla trust texts in step", () => {
    const keys = (o: object, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(keys(bn.trust).sort()).toEqual(keys(en.trust).sort());
  });
});

describe("reviews for venues, pros, shops and gyms (M17 FR-30 to FR-35, Round B1)", () => {
  it("shows the average only when the API sends one, with each star's share", () => {
    const s = ratingSummary({ avg: 4.25, count: 8, histogram: [0, 1, 1, 2, 4] });
    expect(s.showAvg).toBe(true);
    expect(s.avg).toBe(4.25);
    expect(s.spread.map((x) => x.stars)).toEqual([5, 4, 3, 2, 1]);
    expect(s.spread.map((x) => x.n)).toEqual([4, 2, 1, 1, 0]);
    expect(s.spread.map((x) => x.pct)).toEqual([50, 25, 13, 13, 0]);
  });

  it("holds the average back below the display minimum (avg null) but keeps the count", () => {
    const s = ratingSummary({ avg: null, count: 2, histogram: [0, 0, 0, 1, 1] });
    expect(s.showAvg).toBe(false);
    expect(s.count).toBe(2);
  });

  it("copes with no reviews and a missing summary", () => {
    expect(ratingSummary({ avg: null, count: 0, histogram: [] }).spread.every((x) => x.pct === 0 && x.n === 0)).toBe(true);
    expect(ratingSummary(undefined)).toMatchObject({ avg: null, count: 0, showAvg: false });
  });

  it("links each subject to its public page, and nowhere without a slug", () => {
    expect(subjectHref("ground", "dhanmondi-turf")).toBe("/venues/dhanmondi-turf");
    expect(subjectHref("hire_profile", "rafi-coach")).toBe("/hiring/rafi-coach");
    expect(subjectHref("shop", "gear hub")).toBe("/shop/s/gear%20hub");
    expect(subjectHref("gym", "iron-house")).toBe("/gym/gyms/iron-house");
    expect(subjectHref("gym", null)).toBeNull();
  });

  it("opens each waiting item on its own page in the account", () => {
    expect(sourceHref({ sourceType: "booking", sourceId: "b-uuid", ref: "BK-7Q2X", bookingId: "b-uuid" })).toBe("/me/bookings/b-uuid");
    expect(sourceHref({ sourceType: "booking", sourceId: "b-uuid", ref: "BK-7Q2X" })).toBe("/me/bookings/b-uuid");
    // A hire job's code is the request's code plus "-n"; a sub-order's is the order's plus "-A".
    expect(sourceHref({ sourceType: "hire_job", sourceId: "j", ref: "HR-4K9P-2" })).toBe("/me/hire/HR-4K9P");
    expect(sourceHref({ sourceType: "sub_order", sourceId: "s", ref: "KG-88AB-B" })).toBe("/me/orders/KG-88AB");
    expect(sourceHref({ sourceType: "sub_order", sourceId: "s", ref: "PLAIN" })).toBe("/me/orders/PLAIN");
    expect(sourceHref({ sourceType: "gym_pass", sourceId: "p", ref: "GP-31XZ" })).toBe("/me/passes/GP-31XZ");
  });

  it("names the subject from subjectName, then the v1 groundName, else nothing", () => {
    expect(subjectNameOf({ subjectName: "Iron House" })).toBe("Iron House");
    expect(subjectNameOf({ subjectName: null, groundName: "Dhanmondi Turf" })).toBe("Dhanmondi Turf");
    expect(subjectNameOf({ subjectName: "  " })).toBeNull();
    expect(subjectNameOf({})).toBeNull();
  });

  it("maps every source to the subject it rates", () => {
    expect(SUBJECT_OF).toEqual({ booking: "ground", hire_job: "hire_profile", sub_order: "shop", gym_pass: "gym" });
  });

  it("explains the rating errors it knows and falls back to 'failed' for the rest", () => {
    for (const c of ["NOT_YOUR_JOB", "NOT_YOUR_ORDER", "NOT_YOUR_PASS", "JOB_NOT_RELEASED", "ORDER_NOT_COMPLETED", "PASS_NOT_REDEEMED", "REVIEW_WINDOW_CLOSED", "REVIEW_EXISTS", "REVIEW_HIDDEN"]) expect(rateErrorKey(c)).toBe(c);
    expect(rateErrorKey("SOMETHING_ELSE")).toBe("failed");
    expect(rateErrorKey(null)).toBe("failed");
    expect(rateErrorKey(undefined)).toBe("failed");
  });

  it("explains a refused reply (contact details) and falls back to 'failed'", () => {
    expect(replyErrorKey("REPLY_HAS_CONTACT")).toBe("REPLY_HAS_CONTACT");
    expect(replyErrorKey("NOT_OWNER")).toBe("NOT_OWNER");
    expect(replyErrorKey("RATE_LIMITED")).toBe("failed");
    expect(replyErrorKey(null)).toBe("failed");
  });

  it("accepts a reply of 2 to 1,000 characters after trimming", () => {
    expect(replyOk(" a ")).toBe(false);
    expect(replyOk("ok")).toBe(true);
    expect(replyOk("x".repeat(1000))).toBe(true);
    expect(replyOk("x".repeat(1001))).toBe(false);
  });

  it("knows when a gym pass would update my one review of that gym (M20-FR-10)", () => {
    const mine = [
      { subjectType: "gym", subjectId: "g1", sourceType: "gym_pass", sourceId: "p1" },
      { subjectType: "ground", subjectId: "v1", sourceType: "booking", sourceId: "b1" },
    ];
    expect(reviewedGymFromOtherPass(mine, "g1", "p2")).toBe(true);
    expect(reviewedGymFromOtherPass(mine, "g1", "p1")).toBe(false); // the same pass: REVIEW_EXISTS
    expect(reviewedGymFromOtherPass(mine, "g2", "p2")).toBe(false);
    expect(reviewedGymFromOtherPass(undefined, "g1", "p2")).toBe(false);
    expect(reviewedGymFromOtherPass(mine, null, "p2")).toBe(false);
  });

  it("has every rating, reply and subject text in both languages", () => {
    const codes = ["NOT_YOUR_BOOKING", "NOT_YOUR_JOB", "NOT_YOUR_ORDER", "NOT_YOUR_PASS", "NOT_PLAYED", "JOB_NOT_RELEASED", "ORDER_NOT_COMPLETED", "PASS_NOT_REDEEMED", "REVIEW_WINDOW_CLOSED", "REVIEW_EXISTS", "REVIEW_HIDDEN", "failed"] as const;
    for (const m of [en, bn]) {
      for (const c of codes) expect(m.trust.rate.errors[c]).toBeTruthy();
      for (const c of ["REPLY_HAS_CONTACT", "NOT_OWNER", "REVIEW_STATE", "VALIDATION_FAILED", "failed"] as const) expect(m.trust.replyDialog.errors[c]).toBeTruthy();
      for (const s of REVIEW_SUBJECTS) {
        expect(m.trust.subjects[s]).toBeTruthy();
        expect(m.trust.reviews.replyFrom[s]).toBeTruthy();
        expect(m.trust.reviews.empty[s]).toBeTruthy();
        expect(m.trust.rate.titleFor[s]).toBeTruthy();
      }
      for (const src of Object.keys(SUBJECT_OF) as (keyof typeof SUBJECT_OF)[]) expect(m.trust.reviewable.source[src]).toContain("{ref}");
      expect(m.hire.desk.reviews).toBeTruthy();
    }
  });
});
