import { describe, expect, it } from "vitest";
import { fileProblem, MAX_UPLOAD_BYTES, nidLooksValid, SLOTS } from "../kyc";

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
