import { describe, expect, it } from "vitest";
import { canWrite, deskTabs, dhakaLocalToIso, foundingParam, invoiceTotals, overrideBody, overrideValue, periodParam, problemInfo, voidable, type OverrideForm } from "../admin/gymManage";

const OWNER = "7d1b6c3e-2a4f-4b8e-9c1d-0e2f3a4b5c6d";
const form = (p: Partial<OverrideForm> = {}): OverrideForm => ({ scopeType: "owner", scopeId: OWNER, kind: "referral", value: "150", reason: "Launch partner", validFrom: "", validTo: "", ...p });

describe("/admin/gym-manage tabs and writes (M24 §4.4, §9.2)", () => {
  it("owners and invoices for manage_gyms or view_payouts; overrides for manage_gyms; masters see all", () => {
    expect(deskTabs({ isMaster: true, permissions: [] })).toEqual(["owners", "invoices", "overrides"]);
    expect(deskTabs({ isMaster: false, permissions: ["manage_gyms"] })).toEqual(["owners", "invoices", "overrides"]);
    expect(deskTabs({ isMaster: false, permissions: ["view_payouts"] })).toEqual(["owners", "invoices"]);
    expect(deskTabs({ isMaster: false, permissions: ["manage_users"] })).toEqual([]);
    expect(deskTabs(undefined)).toEqual([]);
  });

  it("only masters write; only issued and overdue invoices can be voided", () => {
    expect(canWrite({ isMaster: true, permissions: [] })).toBe(true);
    expect(canWrite({ isMaster: false, permissions: ["manage_gyms", "view_payouts"] })).toBe(false);
    expect(canWrite(undefined)).toBe(false);
    expect(["issued", "overdue", "paid", "void"].filter((s) => voidable(s as never))).toEqual(["issued", "overdue"]);
  });
});

describe("fee override form (M24-FR-94)", () => {
  it("sends the referral fee as whole poisha and the pass commission as a percent", () => {
    expect(overrideBody(form())).toEqual({ ok: true, body: { scopeType: "owner", scopeId: OWNER, key: "fees.gym_referral_poisha", value: 15000, reason: "Launch partner" } });
    expect(overrideBody(form({ value: "1,250.5" }))).toMatchObject({ ok: true, body: { value: 125050 } });
    expect(overrideBody(form({ value: "0" }))).toMatchObject({ ok: true, body: { value: 0 } });
    expect(overrideBody(form({ kind: "pass", value: "2.5", scopeType: "gym" }))).toMatchObject({ ok: true, body: { key: "fees.gym_pct", value: 2.5, scopeType: "gym" } });
    expect(overrideBody(form({ kind: "pass", value: "100" }))).toMatchObject({ ok: true, body: { value: 100 } });
  });

  it("names the first problem", () => {
    expect(overrideBody(form({ scopeId: "not-an-id" }))).toEqual({ ok: false, problem: "scope" });
    expect(overrideBody(form({ value: "" }))).toEqual({ ok: false, problem: "value" });
    expect(overrideBody(form({ value: "-5" }))).toEqual({ ok: false, problem: "value" });
    expect(overrideBody(form({ value: "1.234" }))).toEqual({ ok: false, problem: "value" });
    expect(overrideBody(form({ kind: "pass", value: "100.5" }))).toEqual({ ok: false, problem: "value" });
    expect(overrideBody(form({ reason: " x " }))).toEqual({ ok: false, problem: "reason" });
    expect(overrideBody(form({ reason: "x".repeat(301) }))).toEqual({ ok: false, problem: "reason" });
    expect(overrideBody(form({ validFrom: "soon" }))).toEqual({ ok: false, problem: "from" });
    expect(overrideBody(form({ validTo: "2026-13" }))).toEqual({ ok: false, problem: "to" });
    expect(overrideBody(form({ validFrom: "2027-01-02T00:00", validTo: "2027-01-01T00:00" }))).toEqual({ ok: false, problem: "order" });
    expect(overrideBody(form({ validTo: "2020-01-01T00:00" }))).toEqual({ ok: false, problem: "order" });
  });

  it("reads valid from and to as Dhaka time", () => {
    expect(dhakaLocalToIso("2026-11-01T09:30")).toBe("2026-11-01T03:30:00.000Z");
    expect(dhakaLocalToIso("  ")).toBeNull();
    expect(dhakaLocalToIso("2026-11-01")).toBeUndefined();
    expect(overrideBody(form({ validFrom: "2027-01-01T00:00", validTo: "2027-06-30T23:59" }))).toMatchObject({ ok: true, body: { validFrom: "2026-12-31T18:00:00.000Z", validTo: "2027-06-30T17:59:00.000Z" } });
  });

  it("shows a value as taka or a percent", () => {
    const taka = (p: number) => `৳${p / 100}`;
    expect(overrideValue("fees.gym_referral_poisha", 15000, taka)).toBe("৳150");
    expect(overrideValue("fees.gym_pct", 2.5, taka)).toBe("2.5%");
  });
});

describe("filters, totals and problems", () => {
  it("keeps only valid filter values", () => {
    expect(foundingParam("true")).toBe("true");
    expect(foundingParam("false")).toBe("false");
    expect(foundingParam("")).toBeUndefined();
    expect(foundingParam("yes")).toBeUndefined();
    expect(periodParam("2026-10")).toBe("2026-10");
    expect(periodParam("2026-13")).toBeUndefined();
    expect(periodParam("")).toBeUndefined();
  });

  it("orders the totals by status and leaves out empty ones", () => {
    expect(invoiceTotals({ paid: { count: 2, totalPoisha: 300000 }, issued: { count: 1, totalPoisha: 100000 }, void: { count: 0, totalPoisha: 0 } })).toEqual([
      { status: "issued", count: 1, totalPoisha: 100000 },
      { status: "paid", count: 2, totalPoisha: 300000 },
    ]);
    expect(invoiceTotals(undefined)).toEqual([]);
  });

  it("reads a problem's code and bounds", () => {
    expect(problemInfo({ code: "GYM_OVERRIDE_OUT_OF_BOUNDS", status: 422, title: "Out", min: 0, max: 50000 })).toEqual({ code: "GYM_OVERRIDE_OUT_OF_BOUNDS", title: "Out", min: 0, max: 50000 });
    expect(problemInfo({ code: "GYM_FOUNDING_FULL", status: 409, title: "Full" })).toEqual({ code: "GYM_FOUNDING_FULL", title: "Full" });
    expect(problemInfo(new Error("x"))).toEqual({ code: null, title: null });
  });
});
