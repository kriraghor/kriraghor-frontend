import { api, problemOf, type Problem } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "./finance";

/**
 * Users desk client (M01-FR-19..FR-22, admin.kriraghor.com/admin/users): search members (every
 * search with a query is audited, so the desk only searches on a settled query of 2+ characters),
 * one account with roles and sanctions, suspend and restore (manage_users), sign out everywhere,
 * gender correction (M16), role status decisions, and the master's ban and unban (step-up user.ban).
 */
export type AdminUser = components["schemas"]["AdminUser"];
export type UserRoleRow = components["schemas"]["UserRole"];
export type RoleName = UserRoleRow["role"];
export type RoleStatus = UserRoleRow["status"];
export type Sanction = AdminUser["sanctions"][number];
export type Gender = NonNullable<AdminUser["gender"]>;

export const USER_STATUSES = ["active", "suspended", "banned", "closed"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
export const ROLES = ["member", "player", "pro", "ground_owner", "shop_owner", "organiser", "gym_owner", "staff", "master_admin"] as const satisfies readonly RoleName[];
export const ROLE_STATUSES = ["applied", "documents_pending", "in_review", "active", "changes_requested", "rejected", "suspended", "withdrawn"] as const satisfies readonly RoleStatus[];
export const REASON_CODES = ["fraud", "abuse", "fake_documents", "chargebacks", "policy_breach", "risk_flag", "other"] as const;
export type ReasonCode = (typeof REASON_CODES)[number];
export const GENDERS = ["male", "female", "third"] as const satisfies readonly Gender[];

/** The statuses staff may set on a role (the API refuses the rest). */
export type SettableRoleStatus = "in_review" | "active" | "changes_requested" | "rejected" | "suspended";
/** Staff and master roles are managed on the Staff desk, never here. */
export const STAFF_ROLES: readonly RoleName[] = ["staff", "master_admin"];

/** Mirrors the API's role transitions (common/enums ROLE_TRANSITIONS, plus documents_pending). */
const TRANSITIONS: Partial<Record<RoleStatus, SettableRoleStatus[]>> = {
  applied: ["in_review", "active", "rejected"],
  documents_pending: ["in_review", "rejected"],
  in_review: ["active", "changes_requested", "rejected"],
  changes_requested: ["in_review", "rejected"],
  active: ["suspended"],
  suspended: ["active"],
};

/** Where a role can move from its current status; nothing for staff roles. */
export function nextRoleStatuses(role: RoleName, status: RoleStatus): SettableRoleStatus[] {
  if (STAFF_ROLES.includes(role)) return [];
  return TRANSITIONS[status] ?? [];
}

/** Suspending, rejecting or asking for changes needs a reason code. */
export const roleStatusNeedsReason = (status: SettableRoleStatus) => status === "suspended" || status === "rejected" || status === "changes_requested";

export const SEARCH_MIN = 2;
export const SEARCH_MAX = 100;
/** The q the API gets: trimmed, 2–100 characters, or nothing (shorter text never reaches the audit log). */
export function searchQuery(raw: string | null | undefined): string | undefined {
  const q = (raw ?? "").trim();
  return q.length >= SEARCH_MIN ? q.slice(0, SEARCH_MAX) : undefined;
}

export const MAX_SUSPENSION_DAYS = 365;
/** A "suspend until" date (YYYY-MM-DD) means the end of that day in Dhaka. */
export const untilIso = (date: string) => `${date}T23:59:59+06:00`;
/** Why an until date can't be used, or null when it can (or is empty: open-ended). */
export function untilProblem(date: string, now: number): "invalid" | "past" | "tooLong" | null {
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "invalid";
  const at = Date.parse(untilIso(date));
  if (Number.isNaN(at)) return "invalid";
  if (at <= now) return "past";
  if (at - now > MAX_SUSPENSION_DAYS * 24 * 3600 * 1000) return "tooLong";
  return null;
}

export type Viewer = { id: string; isMaster: boolean };
export type UserActions = { suspend: boolean; restore: boolean; ban: boolean; unban: boolean; signOut: boolean; gender: boolean; roles: boolean };
const NONE: UserActions = { suspend: false, restore: false, ban: false, unban: false, signOut: false, gender: false, roles: false };

/** A staff account still in post (offboarded staff are ordinary members again). */
export const isCurrentStaff = (u: Pick<AdminUser, "staff">) => Boolean(u.staff && u.staff.status !== "offboarded");

/**
 * What the viewer may do to this account, matching the API's guards: never to yourself; staff
 * accounts only by a master; a ban only by a master; restore lifts a suspension, never a ban.
 */
export function userActions(u: Pick<AdminUser, "id" | "status" | "staff">, viewer: Viewer | null | undefined): UserActions {
  if (!viewer || viewer.id === u.id) return NONE;
  if (isCurrentStaff(u) && !viewer.isMaster) return NONE;
  const closed = u.status === "closed";
  return {
    suspend: u.status === "active",
    restore: u.status === "suspended",
    ban: viewer.isMaster && (u.status === "active" || u.status === "suspended"),
    unban: viewer.isMaster && u.status === "banned",
    signOut: !closed,
    gender: !closed,
    roles: !closed,
  };
}

/** Sanction rows: in force, lifted early, or ended on their date. */
export function sanctionState(s: Pick<Sanction, "liftedAt" | "endsAt">, now: number): "active" | "lifted" | "ended" {
  if (s.liftedAt) return "lifted";
  if (s.endsAt && Date.parse(s.endsAt) <= now) return "ended";
  return "active";
}

/** Badge tone for an account status (plain kit tones; status-tones has no user domain). */
export function userStatusTone(status: string): "brand" | "warning" | "danger" | "neutral" {
  if (status === "active") return "brand";
  if (status === "suspended") return "warning";
  if (status === "banned") return "danger";
  return "neutral";
}

/** Badge tone for a role status. */
export function roleStatusTone(status: string): "brand" | "warning" | "danger" | "info" | "neutral" {
  if (status === "active") return "brand";
  if (status === "applied" || status === "documents_pending" || status === "in_review") return "info";
  if (status === "changes_requested") return "warning";
  if (status === "rejected" || status === "suspended") return "danger";
  return "neutral";
}

/** Problem codes the desks explain in plain words (messages usersDesk.errors.* and staffDesk.errors.*). */
export const KNOWN_ERRORS = [
  "SELF_ACTION_FORBIDDEN",
  "MASTER_REQUIRED",
  "TARGET_PROTECTED",
  "ALREADY_SANCTIONED",
  "USER_NOT_ACTIVE",
  "USER_ALREADY_BANNED",
  "USER_ALREADY_ACTIVE",
  "USER_CLOSED",
  "NOT_SANCTIONED",
  "UNTIL_IN_PAST",
  "SUSPENSION_TOO_LONG",
  "ROLE_TRANSITION_INVALID",
  "ROLE_NOT_MANAGEABLE",
  "MEMBER_NOT_ACTIVE",
  "ALREADY_STAFF",
  "PERMISSION_NOT_GRANTABLE",
  "MASTER_PERMISSIONS_FIXED",
  "LAST_MASTER",
  "STAFF_NOT_ACTIVE",
  "ALREADY_MASTER",
  "STEP_UP_REQUIRED",
  "STEP_UP_FAILED",
  "TOTP_INVALID",
  "TOTP_REPLAYED",
  "TWO_FACTOR_REQUIRED",
  "PERMISSION_REQUIRED",
  "VALIDATION_FAILED",
  "NOT_FOUND",
] as const;

/** The message key for a known problem code, or null (then the API's own title is shown). */
export function errorKey(err: unknown): (typeof KNOWN_ERRORS)[number] | null {
  const code = problemOf(err)?.code;
  return code && (KNOWN_ERRORS as readonly string[]).includes(code) ? (code as (typeof KNOWN_ERRORS)[number]) : null;
}

/** The problem with a plain-language title (for CodeDialog, which shows `title`). */
export function plainProblem(err: unknown, explain: (code: (typeof KNOWN_ERRORS)[number]) => string): Problem {
  const p = problemOf(err) ?? ({ code: "UNKNOWN", title: "Something went wrong", status: 0 } satisfies Problem);
  const key = errorKey(p);
  return key ? { ...p, title: explain(key), detail: undefined } : p;
}

const a = () => api("admin");
const step = (token: string) => ({ "x-step-up": token });

export const usersAdmin = {
  /** One page of users; `data` becomes `items` for useCursorList. */
  list: async (query: { q?: string; status?: string; role?: string; roleStatus?: string; cursor?: string }) => {
    const res = unwrap(
      await a().GET("/admin/users", {
        params: {
          query: {
            ...(query.q ? { q: query.q } : {}),
            ...(query.status ? { status: query.status as UserStatus } : {}),
            ...(query.role ? { role: query.role as RoleName } : {}),
            ...(query.roleStatus ? { roleStatus: query.roleStatus as RoleStatus } : {}),
            ...(query.cursor ? { cursor: query.cursor } : {}),
            limit: 50,
          },
        },
      }),
    );
    return { items: res.data, nextCursor: res.nextCursor };
  },
  get: async (id: string) => unwrap(await a().GET("/admin/users/{id}", { params: { path: { id } } })),
  suspend: async (id: string, body: { reasonCode: ReasonCode; note: string; until?: string }) => unwrap(await a().POST("/admin/users/{id}/suspend", { params: { path: { id } }, body })),
  restore: async (id: string, note?: string) => unwrap(await a().POST("/admin/users/{id}/restore", { params: { path: { id } }, body: note ? { note } : {} })),
  signOut: async (id: string) => unwrap(await a().POST("/admin/users/{id}/sign-out", { params: { path: { id } } })),
  gender: async (id: string, gender: Gender, reason: string) => unwrap(await a().PUT("/admin/users/{id}/gender", { params: { path: { id } }, body: { gender, reason } })),
  setRoleStatus: async (id: string, role: RoleName, body: { status: SettableRoleStatus; reasonCode?: string; note?: string }) =>
    unwrap(await a().POST("/admin/users/{id}/roles/{role}/status", { params: { path: { id, role } }, body })),
  ban: async (id: string, body: { reasonCode: ReasonCode; note: string }, stepUpToken: string) => unwrap(await a().POST("/admin/users/{id}/ban", { params: { path: { id }, header: step(stepUpToken) }, body })),
  unban: async (id: string, note: string, stepUpToken: string) => unwrap(await a().POST("/admin/users/{id}/unban", { params: { path: { id }, header: step(stepUpToken) }, body: { note } })),
};
