import { describe, expect, it } from "vitest";
import { amountProblem, birthRange, emailProblem, memberProblems, nameProblem, phoneProblem, photoProblem, wholeProblem } from "../validate";

const TODAY = "2026-11-19";
const ok = { displayName: "Rafiq Hasan", phone: "01712345678", birthDate: "", email: "", ecName: "", ecPhone: "" };

describe("gym form checks", () => {
  it("names, emails and phones", () => {
    expect(nameProblem("")).toBe("required");
    expect(nameProblem("a")).toBe("name");
    expect(nameProblem("1234")).toBe("name");
    expect(nameProblem("রফিক")).toBeNull();
    expect(emailProblem("")).toBeNull();
    expect(emailProblem("rumee_@outlook")).toBe("email");
    expect(emailProblem("rumee_@outlook.com")).toBeNull();
    expect(phoneProblem("")).toBe("required");
    expect(phoneProblem("", { required: false })).toBeNull();
    expect(phoneProblem("016555555555555555")).toBeNull(); // trimmed to its first 11 digits by the field
    expect(phoneProblem("0165555555")).toBe("phone");
    expect(phoneProblem("01212345678")).toBe("phone");
  });

  it("a member: birth date 5 to 100 years ago, both emergency fields or none, a real photo", () => {
    expect(memberProblems(ok, TODAY)).toEqual({});
    expect(birthRange(TODAY)).toEqual({ min: "1926-11-19", max: "2021-11-19" });
    expect(memberProblems({ ...ok, birthDate: "2026-11-02" }, TODAY).birthDate).toBe("birthDate");
    expect(memberProblems({ ...ok, birthDate: "1995-05-01" }, TODAY).birthDate).toBeUndefined();
    expect(memberProblems({ ...ok, ecPhone: "01812345678" }, TODAY).ecName).toBe("ecBoth");
    expect(memberProblems({ ...ok, ecName: "Mother" }, TODAY).ecPhone).toBe("required");
    expect(memberProblems({ ...ok, phone: "" }, TODAY, null, { phoneRequired: false }).phone).toBeUndefined();
    const big = new File([new Uint8Array(11 * 1024 * 1024)], "a.jpg", { type: "image/jpeg" });
    expect(photoProblem(big)).toBe("photoSize");
    expect(photoProblem(new File(["x"], "a.gif", { type: "image/gif" }))).toBe("photoType");
    expect(photoProblem(new File(["x"], "a.png", { type: "image/png" }))).toBeNull();
  });

  it("amounts and whole numbers", () => {
    expect(amountProblem("")).toBe("required");
    expect(amountProblem("", { required: false })).toBeNull();
    expect(amountProblem("2,500")).toBeNull();
    expect(amountProblem("12.345")).toBe("amount");
    expect(amountProblem("0")).toBe("amountRange");
    expect(amountProblem("0", { allowZero: true })).toBeNull();
    expect(amountProblem("-5")).toBe("amount");
    expect(wholeProblem("")).toBeNull();
    expect(wholeProblem("3.5")).toBe("whole");
    expect(wholeProblem("400", { max: 365 })).toBe("range");
  });
});
