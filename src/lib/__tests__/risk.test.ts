import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import bn from "../../../messages/bn.json";
import { MASTER_ACTIONS, SEVERITY_ORDER, stepUpScope } from "../admin/risk";

describe("risk desk helpers (M18)", () => {
  it("asks for the right step-up: freezes risk.manage, bans user.ban, nothing else", () => {
    expect(stepUpScope("freeze_payouts")).toBe("risk.manage");
    expect(stepUpScope("unfreeze_payouts")).toBe("risk.manage");
    expect(stepUpScope("ban")).toBe("user.ban");
    expect(stepUpScope("suspend")).toBeNull();
    expect(stepUpScope("request_documents")).toBeNull();
  });

  it("keeps freezes and bans for masters; critical first", () => {
    expect([...MASTER_ACTIONS].sort()).toEqual(["ban", "freeze_payouts"]);
    expect(SEVERITY_ORDER[0]).toBe("critical");
  });

  it("keeps the English and Bangla risk texts in step", () => {
    const keys = (o: object, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(keys(bn.riskDesk).sort()).toEqual(keys(en.riskDesk).sort());
    expect(keys(bn.vendorTrust).sort()).toEqual(keys(en.vendorTrust).sort());
  });
});
