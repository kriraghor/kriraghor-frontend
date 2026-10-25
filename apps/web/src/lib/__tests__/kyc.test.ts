import { beforeEach, describe, expect, it, vi } from "vitest";
import { canSubmitNid, consentBody, consentReady, fileProblem, kycErrorKey, kycErrorText, MAX_UPLOAD_BYTES, nidLooksValid, SLOTS, submitBusiness, submitNid } from "../kyc";
import en from "../../../messages/en.json";
import bn from "../../../messages/bn.json";

const post = vi.hoisted(() => vi.fn(async () => ({ data: { id: "doc-1" } })));
vi.mock("@kriraghor/api-client", () => ({ api: () => ({ POST: post, GET: vi.fn() }) }));

describe("the consent gate (M02-FR-05, 25 Oct 2026)", () => {
  const base = {
    files: { front: "f1", back: "f2", selfie: "f3" },
    legalName: "Fahim Rahman",
    number: "1234567890",
    dob: "2000-01-01",
    maxDob: "2008-10-25",
    consented: true,
    consentVersion: 1,
  };

  it("lets the NID form submit only when everything is there and the box is ticked", () => {
    expect(canSubmitNid(base)).toBe(true);
    expect(canSubmitNid({ ...base, consented: false })).toBe(false);
    expect(canSubmitNid({ ...base, consentVersion: undefined })).toBe(false);
    expect(canSubmitNid({ ...base, consentVersion: null })).toBe(false);
    expect(canSubmitNid({ ...base, files: { front: "f1", back: "f2" } })).toBe(false);
    expect(canSubmitNid({ ...base, files: { ...base.files, selfie: null } })).toBe(false);
    expect(canSubmitNid({ ...base, legalName: " F " })).toBe(false);
    expect(canSubmitNid({ ...base, number: "123" })).toBe(false);
    expect(canSubmitNid({ ...base, dob: "" })).toBe(false);
  });

  it("blocks a date of birth after the latest allowed one (18+), and allows that day itself", () => {
    expect(canSubmitNid({ ...base, dob: "2008-10-26" })).toBe(false);
    expect(canSubmitNid({ ...base, dob: "2008-10-25" })).toBe(true);
  });

  it("needs a ticked box and a positive whole version", () => {
    expect(consentReady(true, 1)).toBe(true);
    expect(consentReady(true, 3)).toBe(true);
    expect(consentReady(false, 1)).toBe(false);
    expect(consentReady(true, undefined)).toBe(false);
    expect(consentReady(true, null)).toBe(false);
    expect(consentReady(true, 0)).toBe(false);
    expect(consentReady(true, 1.5)).toBe(false);
  });

  it("builds the consent body with the version ticked", () => {
    expect(consentBody(2)).toEqual({ accepted: true, version: 2 });
  });
});

describe("submitting documents sends the consent version (M02-FR-05)", () => {
  beforeEach(() => post.mockClear());

  it("sends { accepted: true, version } with the NID", async () => {
    await submitNid({ legalName: "Fahim Rahman", number: "1234567890", dob: "2000-01-01" }, { front: "a", back: "b", selfie: "c" }, 3);
    expect(post).toHaveBeenCalledWith("/me/documents", {
      body: { docType: "nid", fields: { legalName: "Fahim Rahman", number: "1234567890", dob: "2000-01-01" }, files: { front: "a", back: "b", selfie: "c" }, consent: { accepted: true, version: 3 } },
    });
  });

  it("sends { accepted: true, version } and the role with a business document", async () => {
    await submitBusiness("trade_license", { number: "TRAD/1" }, "file-1", "ground_owner", 1);
    expect(post).toHaveBeenCalledWith("/me/documents", {
      body: { docType: "trade_license", fields: { number: "TRAD/1" }, files: { document: "file-1" }, consent: { accepted: true, version: 1 }, role: "ground_owner" },
    });
  });

  it("never sends the old consent: true", async () => {
    await submitNid({ legalName: "Fahim Rahman", number: "1234567890", dob: "2000-01-01" }, { front: "a", back: "b", selfie: "c" }, 1);
    const calls = post.mock.calls as unknown as [string, { body: { consent: unknown } }][];
    expect(calls[0]![1].body.consent).not.toBe(true);
  });
});

describe("KYC helpers (M02 §4)", () => {
  it("accepts NID numbers the way the server does", () => {
    expect(nidLooksValid("1234567890")).toBe(true);
    expect(nidLooksValid("269-1234567-890")).toBe(true);
    expect(nidLooksValid("1990 1234 5678 9012 3")).toBe(true);
    expect(nidLooksValid("12345678901")).toBe(false);
    expect(nidLooksValid("12345678AB")).toBe(false);
    expect(nidLooksValid("")).toBe(false);
  });

  it("checks type and size before uploading", () => {
    const file = (type: string, size: number) => ({ type, size }) as File;
    expect(fileProblem(file("image/jpeg", 1000), MAX_UPLOAD_BYTES)).toBeNull();
    expect(fileProblem(file("application/pdf", 1000), MAX_UPLOAD_BYTES)).toBeNull();
    expect(fileProblem(file("image/gif", 1000), MAX_UPLOAD_BYTES)).toBe("type");
    expect(fileProblem(file("image/png", MAX_UPLOAD_BYTES + 1), MAX_UPLOAD_BYTES)).toBe("size");
  });

  it("asks for the front, the back and a selfie", () => {
    expect(SLOTS).toEqual(["front", "back", "selfie"]);
  });
});

describe("KYC submit errors (M02-FR-05, §6.3 age_ok, consent of 25 Oct 2026)", () => {
  const codes = [
    "UNDER_MIN_AGE",
    "CONSENT_REQUIRED",
    "CONSENT_VERSION_STALE",
    "DOB_IN_FUTURE",
    "DOB_INVALID",
    "NID_FORMAT_INVALID",
    "FILES_INCOMPLETE",
    "PHONE_REQUIRED",
    "DOC_ALREADY_APPROVED",
    "MEMBER_NOT_ACTIVE",
  ];

  it("maps each known code to a key under kyc.error", () => {
    for (const code of codes) expect(kycErrorKey(code)).toBe(`error.${code}`);
  });

  it("returns null for anything else", () => {
    expect(kycErrorKey("ROLE_NOT_APPLIED")).toBeNull();
    expect(kycErrorKey("")).toBeNull();
    expect(kycErrorKey(undefined)).toBeNull();
    expect(kycErrorKey(null)).toBeNull();
  });

  it("has an English and a Bangla text for every key", () => {
    for (const msgs of [en, bn] as { kyc: { error: Record<string, string> } }[]) {
      for (const code of codes) expect(msgs.kyc.error[code], code).toBeTruthy();
    }
    expect(en.kyc.error.UNDER_MIN_AGE).toBe("NID verification is for people aged {age} and over.");
    expect(bn.kyc.error.UNDER_MIN_AGE).toContain("{age}");
  });

  const t = (key: string, values?: Record<string, string | number>) => `${key}|${values?.age ?? ""}`;

  it("uses the server's minimum age, then the page's, then 18", () => {
    expect(kycErrorText({ code: "UNDER_MIN_AGE", title: "x", minAge: 21 }, t, { minAge: 19 })).toBe("error.UNDER_MIN_AGE|21");
    expect(kycErrorText({ code: "UNDER_MIN_AGE", title: "x" }, t, { minAge: 19 })).toBe("error.UNDER_MIN_AGE|19");
    expect(kycErrorText({ code: "UNDER_MIN_AGE", title: "x" }, t)).toBe("error.UNDER_MIN_AGE|18");
  });

  it("falls back to the server's title, then the given fallback", () => {
    expect(kycErrorText({ code: "CONSENT_REQUIRED", title: "x" }, t)).toBe("error.CONSENT_REQUIRED|18");
    expect(kycErrorText({ code: "ROLE_NOT_APPLIED", title: "Apply first" }, t)).toBe("Apply first");
    expect(kycErrorText({ code: "UNKNOWN", title: "" }, t, { fallback: "Something went wrong" })).toBe("Something went wrong");
  });
});
