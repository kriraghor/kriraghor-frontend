import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import bn from "../../../messages/bn.json";
import { ACTIVE_CASE, REPORT_REASONS, evidenceTypeOk } from "../trust";

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
