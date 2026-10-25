import type { Tone } from "../kit";

/**
 * Who may use a business desk (Round B3 staff accounts), shared by the business panel
 * (vendor.kriraghor.com) and the gym app's /manage (gym.kriraghor.com). Pure helpers, unit-tested.
 * They only shape the screens: the API enforces every rule (business-members actFor, ADR-004).
 */
export type BusinessType = "venue" | "gym" | "shop";
export type BusinessRole = "ground_owner" | "shop_owner" | "gym_owner" | "organiser";
/** The business roles in sidebar order. */
export const BUSINESS_ROLES: BusinessRole[] = ["ground_owner", "shop_owner", "gym_owner", "organiser"];
/** What /me says about a workplace (ids and permissions; names come from /me/workplaces). */
export type WorkplaceRef = { businessType: BusinessType; businessId: string; permissions: readonly string[] };

/** The business roles a person holds and that are active, in sidebar order. */
export function activeBusinessRoles(me: { roles: readonly { role: string; status: string }[] } | undefined): BusinessRole[] {
  return BUSINESS_ROLES.filter((r) => me?.roles.some((x) => x.role === r && x.status === "active"));
}

/** The permissions held at one business as staff, or null when the person does not work there (the owner). */
export function staffPermissionsAt(workplaces: readonly WorkplaceRef[] | undefined, type: BusinessType, businessId: string | null | undefined): readonly string[] | null {
  if (!businessId) return null;
  return (workplaces ?? []).find((w) => w.businessType === type && w.businessId === businessId)?.permissions ?? null;
}

/** Can the person do this here? The owner (null permissions) can do everything on a staff-capable desk. */
export const deskCan = (permissions: readonly string[] | null, permission: string) => permissions === null || permissions.includes(permission);

/** Does the person hold a permission at any workplace of a type? */
export const worksWith = (workplaces: readonly WorkplaceRef[] | undefined, type: BusinessType, permission?: string) =>
  (workplaces ?? []).some((w) => w.businessType === type && (!permission || w.permissions.includes(permission)));

/** The access answers a desk shows as a clear message instead of its own error (B3). */
export function deskAccessKey(code: string | null | undefined): "PERMISSION_REQUIRED" | "PHONE_REQUIRED" | "BUSINESS_REQUIRED" | null {
  return code === "PERMISSION_REQUIRED" || code === "PHONE_REQUIRED" || code === "BUSINESS_REQUIRED" ? code : null;
}

/** A desk status colour (colour is never the only signal: the chip always carries the status text). */
export type StatusTone = "ok" | "warn" | "bad" | "muted";
/** The kit Badge tone for a desk status colour. */
export const KIT_TONE: Record<StatusTone, Tone> = { ok: "brand", warn: "warning", bad: "danger", muted: "neutral" };

/** A listing's review state (venues and gyms) as a desk colour. */
export const STATUS_TONE: Record<string, StatusTone> = {
  draft: "muted",
  pending_review: "warn",
  changes_requested: "bad",
  live: "ok",
  paused: "muted",
  rejected: "bad",
  withdrawn: "muted",
  suspended: "bad",
};

/** A gym pass's state as a desk colour (the passes sold list). */
export const PASS_TONE: Record<string, StatusTone> = { active: "ok", redeemed: "muted", expired: "muted", cancelled: "bad", refunded: "bad", pending_payment: "warn", void: "muted" };
