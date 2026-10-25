import { describe, expect, it } from "vitest";
import { consentLine } from "../admin/kyc";
import { formatDhaka } from "../../components/admin/useAdminMe";
import en from "../../../messages/en.json";
import bn from "../../../messages/bn.json";

describe("the consent row on the document panel (M02-FR-05, 25 Oct 2026)", () => {
  it("shows the version and when it was given, in Dhaka time", () => {
    expect(consentLine({ version: 1, at: "2026-10-25T08:03:00Z" }, (iso) => formatDhaka(iso, "en"))).toBe("v1, 25 Oct 2026, 14:03");
  });

  it("is null for documents sent before consent was recorded", () => {
    expect(consentLine(null, () => "x")).toBeNull();
  });

  it("has the labels in English and Bangla", () => {
    expect(en.kyc.consentNone).toBe("Not recorded (sent before 25 Oct 2026)");
    expect(bn.kyc.consentNone).toBeTruthy();
    for (const m of [en, bn]) {
      expect(m.kyc.consent).toBeTruthy();
      for (const s of ["approved", "in_review", "changes_requested"] as const) expect(m.usersDesk.underAge.status[s]).toBeTruthy();
    }
  });
});
