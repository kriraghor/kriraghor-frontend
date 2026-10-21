import { describe, expect, it } from "vitest";
import { ORGANISER_SUBDOMAINS_ENABLED, organiserOf, organiserRewrite } from "../host";

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

  it("is switched off: esports is organised by Kriraghor only (21 Oct 2026)", () => {
    expect(ORGANISER_SUBDOMAINS_ENABLED).toBe(false);
    expect(organiserRewrite("dhaka-clutch.esports.kriraghor.com", "/")).toBeNull();
    expect(organiserRewrite("esports.kriraghor.com", "/")).toBeNull();
  });

  it("rewrites only an organiser host's home page when switched on", () => {
    expect(organiserRewrite("dhaka-clutch.esports.kriraghor.com", "/", true)).toBe("/o/dhaka-clutch");
    expect(organiserRewrite("dhaka-clutch.esports.kriraghor.com", "/events", true)).toBeNull();
    expect(organiserRewrite("esports.kriraghor.com", "/", true)).toBeNull();
  });
});
