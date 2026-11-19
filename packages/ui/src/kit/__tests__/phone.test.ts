import { describe, expect, it } from "vitest";
import { bdMobile } from "../PhoneField";

describe("Bangladesh mobile numbers", () => {
  it("keeps the local 11-digit form of what was typed or pasted", () => {
    expect(bdMobile.local("01712-345678")).toBe("01712345678");
    expect(bdMobile.local("+8801712345678")).toBe("01712345678");
    expect(bdMobile.local("8801712345678")).toBe("01712345678");
    expect(bdMobile.local("1712345678")).toBe("01712345678");
    expect(bdMobile.local("016555555555555555")).toBe("01655555555");
    expect(bdMobile.local("abc")).toBe("");
  });
  it("accepts 013 to 019 with 11 digits only", () => {
    expect(bdMobile.valid("01712345678")).toBe(true);
    expect(bdMobile.valid("01312345678")).toBe(true);
    expect(bdMobile.valid("01212345678")).toBe(false);
    expect(bdMobile.valid("0171234567")).toBe(false);
    expect(bdMobile.valid("")).toBe(false);
  });
});
