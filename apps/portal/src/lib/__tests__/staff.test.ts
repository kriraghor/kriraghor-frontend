import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import bn from "../../../messages/bn.json";
import { MASTER_ONLY, PERMISSIONS, activeMasters, grantableSet, inviteProblem, isPermission, permissionDiff, staffActions, staffStatusTone } from "../admin/staff";

const row = (over: Partial<{ userId: string; isMaster: boolean; status: string; twoFactorEnabled: boolean }> = {}) => ({ userId: "s1", isMaster: false, status: "active", twoFactorEnabled: true, ...over });

describe("staff permissions (M01-FR-17)", () => {
  it("lists the 15 permissions, two of them master-only (manage_gyms since M24 prompt 2)", () => {
    expect(PERMISSIONS).toHaveLength(15);
    expect(isPermission("manage_gyms")).toBe(true);
    expect(MASTER_ONLY).toEqual(["edit_fees", "manage_staff"]);
    expect(isPermission("manage_users")).toBe(true);
    expect(isPermission("godmode")).toBe(false);
  });
  it("has a label and a description in English and Bangla for every permission", () => {
    for (const m of [en, bn]) {
      const perm = m.staffDesk.perm as Record<string, { label?: string; desc?: string }>;
      for (const p of PERMISSIONS) {
        expect(perm[p]?.label, p).toBeTruthy();
        expect(perm[p]?.desc, p).toBeTruthy();
      }
    }
  });
  it("takes the grantable set from the API, or everything but the master-only ones", () => {
    expect([...grantableSet({ grantable: ["manage_users", "nonsense"] })]).toEqual(["manage_users"]);
    const fallback = grantableSet(null);
    expect(fallback.size).toBe(13);
    expect(fallback.has("manage_gyms")).toBe(true);
    expect(fallback.has("edit_fees")).toBe(false);
    expect(grantableSet({ grantable: [] }).size).toBe(13);
  });
  it("sends only the changes, in matrix order, never a locked permission", () => {
    const g = grantableSet(null);
    expect(permissionDiff(["manage_users", "view_payouts"], ["view_payouts", "approve_listings", "enter_results"], g)).toEqual({ grant: ["approve_listings", "enter_results"], revoke: ["manage_users"] });
    expect(permissionDiff(["manage_users"], new Set(["manage_users", "edit_fees"]), g)).toEqual({ grant: [], revoke: [] });
    expect(permissionDiff(["manage_staff"], [], g)).toEqual({ grant: [], revoke: [] });
    expect(permissionDiff([], [], g)).toEqual({ grant: [], revoke: [] });
  });
});

describe("staffActions", () => {
  it("edits permissions of current non-master staff only", () => {
    expect(staffActions(row(), "m1", 2).editPermissions).toBe(true);
    expect(staffActions(row({ status: "invited" }), "m1", 2).editPermissions).toBe(true);
    expect(staffActions(row({ isMaster: true }), "m1", 2).editPermissions).toBe(false);
    expect(staffActions(row({ status: "offboarded" }), "m1", 2).editPermissions).toBe(false);
  });
  it("never offboards yourself, an offboarded member or the last active master", () => {
    expect(staffActions(row(), "m1", 1).offboard).toBe(true);
    expect(staffActions(row({ userId: "m1" }), "m1", 2).offboard).toBe(false);
    expect(staffActions(row({ status: "offboarded" }), "m1", 2).offboard).toBe(false);
    expect(staffActions(row({ isMaster: true }), "m1", 1).offboard).toBe(false);
    expect(staffActions(row({ isMaster: true }), "m1", 2).offboard).toBe(true);
    expect(staffActions(row({ isMaster: true, status: "invited" }), "m1", 1).offboard).toBe(true);
  });
  it("resets two-factor only when it is set up, promotes active non-masters", () => {
    expect(staffActions(row(), "m1", 1).reset2fa).toBe(true);
    expect(staffActions(row({ twoFactorEnabled: false }), "m1", 1).reset2fa).toBe(false);
    expect(staffActions(row({ status: "offboarded" }), "m1", 1).reset2fa).toBe(false);
    expect(staffActions(row(), "m1", 1).promote).toBe(true);
    expect(staffActions(row({ status: "invited" }), "m1", 1).promote).toBe(false);
    expect(staffActions(row({ isMaster: true }), "m1", 1).promote).toBe(false);
  });
  it("counts active masters", () => {
    expect(activeMasters([row({ isMaster: true }), row({ isMaster: true, status: "offboarded" }), row()] as never)).toBe(1);
  });
});

describe("invite form", () => {
  it("needs a member, an employee id of 2–32 characters and a short team", () => {
    expect(inviteProblem({ userId: null, employeeId: "KG-01", team: "" })).toBe("user");
    expect(inviteProblem({ userId: "u1", employeeId: " K ", team: "" })).toBe("employeeId");
    expect(inviteProblem({ userId: "u1", employeeId: "K".repeat(33), team: "" })).toBe("employeeId");
    expect(inviteProblem({ userId: "u1", employeeId: "KG-01", team: "x".repeat(61) })).toBe("team");
    expect(inviteProblem({ userId: "u1", employeeId: "KG-01", team: "Ops" })).toBeNull();
  });
  it("colours staff statuses", () => {
    expect(["active", "invited", "suspended", "offboarded"].map(staffStatusTone)).toEqual(["brand", "info", "warning", "neutral"]);
  });
});
