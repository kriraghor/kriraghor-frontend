import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "./finance";

/**
 * Staff desk client (M01-FR-16..FR-18, admin.kriraghor.com/admin/staff, masters only): the staff
 * list with the grantable and locked permissions, invite a member as staff, the permission matrix
 * (one atomic save with a reason), offboard and promote (step-up staff.write) and two-factor reset
 * (step-up twofa.reset). Every change revokes the person's sessions on the API side.
 */
export type StaffList = components["schemas"]["StaffList"];
export type StaffRow = StaffList["data"][number];

export const PERMISSIONS = [
  "approve_listings",
  "approve_documents",
  "resolve_reports",
  "refund_small",
  "view_payouts",
  "release_payouts",
  "manage_users",
  "manage_catalog",
  "manage_esports",
  "enter_results",
  "manage_organisers",
  "manage_gyms",
  "view_analytics",
  "edit_fees",
  "manage_staff",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
/** Held only by masters; never granted to staff (the API answers PERMISSION_NOT_GRANTABLE). */
export const MASTER_ONLY: readonly Permission[] = ["edit_fees", "manage_staff"];

export const STAFF_STATUSES = ["invited", "active", "suspended", "offboarded"] as const;
export const EMPLOYEE_ID_MIN = 2;
export const EMPLOYEE_ID_MAX = 32;
export const TEAM_MAX = 60;
export const REASON_MIN = 3;
export const REASON_MAX = 500;

export const isPermission = (p: string): p is Permission => (PERMISSIONS as readonly string[]).includes(p);

/** The permissions a master may tick for staff: the API's grantable list, else everything not master-only. */
export function grantableSet(list: Pick<StaffList, "grantable"> | null | undefined): Set<Permission> {
  const from = list?.grantable?.length ? list.grantable.filter(isPermission) : PERMISSIONS.filter((p) => !MASTER_ONLY.includes(p));
  return new Set(from);
}

/** What to send for one person: grants and revokes between the saved and the ticked set, grantable only, in matrix order. */
export function permissionDiff(saved: readonly string[], ticked: Iterable<string>, grantable: Set<Permission>): { grant: Permission[]; revoke: Permission[] } {
  const before = new Set(saved);
  const after = new Set(ticked);
  const grant = PERMISSIONS.filter((p) => grantable.has(p) && after.has(p) && !before.has(p));
  const revoke = PERMISSIONS.filter((p) => grantable.has(p) && before.has(p) && !after.has(p));
  return { grant, revoke };
}

/** Active masters, so the desk never offers to offboard the last one (the API refuses with LAST_MASTER). */
export const activeMasters = (rows: readonly StaffRow[]) => rows.filter((r) => r.isMaster && r.status === "active").length;

export type StaffActions = { editPermissions: boolean; offboard: boolean; reset2fa: boolean; promote: boolean };

/**
 * What a master may do to this staff member: masters' permissions are fixed; nobody offboards
 * themselves or the last active master; 2FA reset only when it is set up; promotion needs an
 * active (two-factor) staff member who is not already a master.
 */
export function staffActions(row: Pick<StaffRow, "userId" | "isMaster" | "status" | "twoFactorEnabled">, viewerId: string | null | undefined, masters: number): StaffActions {
  const current = row.status !== "offboarded";
  return {
    editPermissions: current && !row.isMaster,
    offboard: current && row.userId !== viewerId && !(row.isMaster && row.status === "active" && masters <= 1),
    reset2fa: current && row.twoFactorEnabled,
    promote: row.status === "active" && !row.isMaster,
  };
}

/** The form check for an invite; the first problem, or null. */
export function inviteProblem(v: { userId: string | null; employeeId: string; team: string }): "user" | "employeeId" | "team" | null {
  if (!v.userId) return "user";
  const id = v.employeeId.trim();
  if (id.length < EMPLOYEE_ID_MIN || id.length > EMPLOYEE_ID_MAX) return "employeeId";
  if (v.team.trim().length > TEAM_MAX) return "team";
  return null;
}

const a = () => api("admin");
const step = (token: string) => ({ "x-step-up": token });

export const staffAdmin = {
  list: async () => unwrap(await a().GET("/admin/staff")),
  invite: async (body: { userId: string; employeeId: string; team?: string; permissions: Permission[] }, stepUpToken: string) =>
    unwrap(await a().POST("/admin/staff", { params: { header: step(stepUpToken) }, body })),
  setPermissions: async (changes: { userId: string; grant: Permission[]; revoke: Permission[] }[], reason: string, stepUpToken: string) =>
    unwrap(await a().PUT("/admin/staff/permissions", { params: { header: step(stepUpToken) }, body: { changes, reason } })),
  offboard: async (id: string, note: string | undefined, stepUpToken: string) =>
    unwrap(await a().POST("/admin/staff/{id}/offboard", { params: { path: { id }, header: step(stepUpToken) }, body: note ? { note } : {} })),
  reset2fa: async (id: string, stepUpToken: string) => unwrap(await a().POST("/admin/staff/{id}/reset-2fa", { params: { path: { id }, header: step(stepUpToken) } })),
  promote: async (id: string, stepUpToken: string) => unwrap(await a().POST("/admin/staff/{id}/promote-master", { params: { path: { id }, header: step(stepUpToken) } })),
};

/** Badge tone for a staff status (plain kit tones; status-tones has no staff domain). */
export function staffStatusTone(status: string): "brand" | "info" | "warning" | "neutral" {
  if (status === "active") return "brand";
  if (status === "invited") return "info";
  if (status === "suspended") return "warning";
  return "neutral";
}
