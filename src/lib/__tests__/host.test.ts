import { describe, expect, it } from "vitest";
import { organiserOf } from "../host";

describe("organiser subdomains (M22-FR-12)", () => {
  it("reads {sub}.esports.<domain> and nothing else", () => {
    expect(organiserOf("dhaka-clutch.esports.kriraghor.com")).toBe("dhaka-clutch");
    expect(organiserOf("dhaka-clutch.esports.staging.kriraghor.com")).toBe("dhaka-clutch");
    expect(organiserOf("Dhaka-Clutch.esports.kriraghor.localhost:80")).toBe("dhaka-clutch");
    expect(organiserOf("esports.kriraghor.com")).toBeNull();
    expect(organiserOf("www.esports.kriraghor.com")).toBeNull();
    expect(organiserOf("www.kriraghor.com")).toBeNull();
    expect(organiserOf("-bad.esports.kriraghor.com")).toBeNull();
    expect(organiserOf("localhost:3001")).toBeNull();
    expect(organiserOf(null)).toBeNull();
  });
});
