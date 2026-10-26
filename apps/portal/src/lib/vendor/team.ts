import { api } from "@kriraghor/api-client";
import type { components, paths } from "@kriraghor/api-client/schema";
import { normalizePhone } from "@kriraghor/ui/auth-flow";
import { unwrap } from "../admin/finance";
import { gymHref } from "../links";
import { deskCan, type BusinessType, type WorkplaceRef } from "@kriraghor/ui/desk/access";

/**
 * Round B3 staff accounts for businesses (Q69, Q169, Q170; vendor.kriraghor.com).
 *  - The owner's team: GET/POST /me/team, PATCH /me/team/:id, POST /me/team/:id/remove. Members are
 *    added by a verified phone; the list shows the last four digits only.
 *  - The staff member's workplaces: GET /me/workplaces (names and owners) and /me `workplaces` (ids
 *    and permissions, what the sidebar and the desks follow), and the staff to-do
 *    (GET /me/dashboard/actions?role=business_staff).
 * The API enforces every rule (business-members actFor); these helpers only shape the screens.
 */
// The staff-access rules every desk follows are shared with gym.kriraghor.com/manage (@kriraghor/ui/desk).
export { deskAccessKey, deskCan, staffPermissionsAt, worksWith, type BusinessType, type WorkplaceRef } from "@kriraghor/ui/desk/access";
export const BUSINESS_TYPES: readonly BusinessType[] = ["venue", "gym", "shop"];
export type TeamMember = components["schemas"]["BusinessTeamMember"];
export type Workplace = components["schemas"]["BusinessWorkplace"];
export type TeamList = paths["/me/team"]["get"]["responses"][200]["content"]["application/json"];
export type TeamBusiness = TeamList["businesses"][number];
export type CatalogueEntry = { key: string; default: boolean; needs: string | null };
/** A staff to-do line (M19 actions) with the workplace it belongs to. */
export type StaffAction = components["schemas"]["PendingActions"]["items"][number] & { businessType?: BusinessType; businessId?: string };

export const team = {
  list: async () => unwrap(await api().GET("/me/team")),
  add: async (body: { businessType: BusinessType; businessId: string; phone: string; permissions: string[] }) => unwrap(await api().POST("/me/team", { body })),
  update: async (id: string, permissions: string[]) => unwrap(await api().PATCH("/me/team/{id}", { params: { path: { id } }, body: { permissions } })),
  remove: async (id: string) => unwrap(await api().POST("/me/team/{id}/remove", { params: { path: { id } } })),
  workplaces: async () => unwrap(await api().GET("/me/workplaces")),
  staffActions: async () => {
    const r = unwrap(await api().GET("/me/dashboard/actions", { params: { query: { role: "business_staff" } } }));
    return { ...r, items: r.items as StaffAction[] };
  },
};

// ---------------- permission checkboxes (pure, tested)

/** The permissions a business type turns on by default (sorted). */
export function defaultPermissions(catalogue: readonly CatalogueEntry[]): string[] {
  return catalogue
    .filter((p) => p.default)
    .map((p) => p.key)
    .sort();
}

/** A choice made valid: unknown keys dropped, every permission's requirement added (sorted, unique). */
export function withRequirements(catalogue: readonly CatalogueEntry[], selected: readonly string[]): string[] {
  const byKey = new Map(catalogue.map((p) => [p.key, p] as const));
  const out = new Set<string>();
  const add = (k: string) => {
    const p = byKey.get(k);
    if (!p || out.has(k)) return;
    out.add(k);
    if (p.needs) add(p.needs);
  };
  selected.forEach(add);
  return [...out].sort();
}

/** The checked permissions another checked permission needs: they stay on (disabled) until it goes off. */
export function lockedPermissions(catalogue: readonly CatalogueEntry[], selected: readonly string[]): Set<string> {
  const on = new Set(selected);
  return new Set(catalogue.filter((p) => on.has(p.key) && p.needs && on.has(p.needs)).map((p) => p.needs as string));
}

/**
 * Ticking a box: on adds the permission and what it needs (every venue action needs bookings.view);
 * off removes it and anything that needs it, so the choice is always one the API accepts.
 */
export function togglePermission(catalogue: readonly CatalogueEntry[], selected: readonly string[], key: string, on: boolean): string[] {
  if (on) return withRequirements(catalogue, [...selected, key]);
  const drop = new Set([key]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of catalogue) {
      if (p.needs && drop.has(p.needs) && !drop.has(p.key)) {
        drop.add(p.key);
        grew = true;
      }
    }
  }
  return withRequirements(catalogue, selected.filter((k) => !drop.has(k)));
}

/** Two permission lists hold the same keys. */
export function samePermissions(a: readonly string[], b: readonly string[]): boolean {
  const sa = [...new Set(a)].sort();
  const sb = [...new Set(b)].sort();
  return sa.length === sb.length && sa.every((k, i) => k === sb[i]);
}

// ---------------- the add form (pure, tested)

/** A Bangladesh mobile number as +8801XXXXXXXXX, or null (the same rule as sign-in and the API). */
export const teamPhone = (input: string): string | null => normalizePhone(input.trim());

/** Active members per business ("venue:<id>" → count), for the "3 of 10" cap. */
export function membersPerBusiness(items: readonly Pick<TeamMember, "businessType" | "businessId" | "status">[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of items) {
    if (m.status !== "active") continue;
    const k = businessKey(m.businessType, m.businessId);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}
export const businessKey = (type: string, id: string) => `${type}:${id}`;

/** The businesses a staff member can be added to: not removed, and not at the cap. */
export function addableBusinesses(businesses: readonly TeamBusiness[], counts: Map<string, number>, max: number): TeamBusiness[] {
  return businesses.filter((b) => b.status !== "removed" && (counts.get(businessKey(b.businessType, b.id)) ?? 0) < max);
}

// ---------------- errors (pure, tested)

/** The codes the team page and the staff desks explain in their own words. */
export const STAFF_ERRORS = [
  "MEMBER_NOT_FOUND",
  "MEMBER_IS_OWNER",
  "MEMBER_IS_STAFF",
  "PHONE_NOT_VERIFIED",
  "TEAM_FULL",
  "ALREADY_MEMBER",
  "PERMISSIONS_INVALID",
  "PERMISSION_REQUIRED",
  "BUSINESS_REQUIRED",
  "PHONE_REQUIRED",
  "ROLE_SUSPENDED",
  "ROLE_REQUIRED",
  "NOT_FOUND",
  "VALIDATION_FAILED",
  "RATE_LIMITED",
] as const;
export type StaffErrorCode = (typeof STAFF_ERRORS)[number];

/** The message key (team.errors.*) for a problem code; "failed" for anything else. */
export function staffErrorKey(code: string | null | undefined): StaffErrorCode | "failed" {
  return code && (STAFF_ERRORS as readonly string[]).includes(code) ? (code as StaffErrorCode) : "failed";
}

// ---------------- workplaces (pure, tested)

export type DeskChoice = { value: string; label: string; staff: boolean; owner: string | null };

/**
 * The business switcher of a desk: the owner's own businesses first (staff: false), then each
 * workplace of that type where the person holds the permission (with its owner's name). Duplicates
 * (a business both owned and worked at) show once, as owned.
 */
export function deskChoices(type: BusinessType, permission: string, own: readonly { id: string; name: string }[], workplaces: readonly Pick<Workplace, "businessType" | "businessId" | "business" | "owner" | "permissions">[] | undefined): DeskChoice[] {
  const out: DeskChoice[] = own.map((b) => ({ value: b.id, label: b.name, staff: false, owner: null }));
  const seen = new Set(out.map((c) => c.value));
  for (const w of workplaces ?? []) {
    if (w.businessType !== type || !w.permissions.includes(permission) || seen.has(w.businessId)) continue;
    seen.add(w.businessId);
    out.push({ value: w.businessId, label: w.business.name ?? "–", staff: true, owner: w.owner.displayName ?? null });
  }
  return out;
}

/**
 * The desks one workplace opens, by its permissions (the vendor home's buttons): venue and shop desks on
 * vendor.kriraghor.com, a gym's front desk and passes on gym.kriraghor.com/manage (through /go/gym).
 */
export function workplaceDesks(w: WorkplaceRef): { key: "bookings" | "reviews" | "frontDesk" | "passes" | "orders" | "inventory"; href: string }[] {
  const has = (p: string) => w.permissions.includes(p);
  const id = w.businessId;
  if (w.businessType === "venue")
    return [
      ...(has("bookings.view") ? [{ key: "bookings" as const, href: `/vendor/bookings?groundId=${id}` }] : []),
      ...(has("reviews.reply") ? [{ key: "reviews" as const, href: `/vendor/reviews?type=ground&place=${id}` }] : []),
    ];
  if (w.businessType === "gym")
    return [
      ...(has("desk.admit") || has("desk.admissions") || has("attendance.mark") ? [{ key: "frontDesk" as const, href: gymHref(`/manage/${id}/desk`) }] : []),
      ...(has("passes.view") ? [{ key: "passes" as const, href: gymHref(`/manage/${id}/passes`) }] : []),
    ];
  return [
    ...(has("orders.view") ? [{ key: "orders" as const, href: `/vendor/orders?shopId=${id}` }] : []),
    ...(has("stock.view") ? [{ key: "inventory" as const, href: `/vendor/inventory?shopId=${id}` }] : []),
  ];
}

/** The booking actions a venue desk offers, narrowed to the staff member's permissions (owners: all). */
const BOOKING_PERMISSION = { check_in: "bookings.check_in", no_show: "bookings.no_show", extend: "bookings.extend", collect: "bookings.collect_balance", cancel: "bookings.cancel", move: "bookings.move" } as const;
export function allowedBookingActions<A extends keyof typeof BOOKING_PERMISSION>(actions: readonly A[], permissions: readonly string[] | null): A[] {
  return actions.filter((a) => deskCan(permissions, BOOKING_PERMISSION[a]));
}

/** The order actions a shop desk offers for a status, narrowed to the staff member's permissions. */
export function allowedOrderActions(status: string, permissions: readonly string[] | null): ("accept" | "reject" | "ship" | "deliver")[] {
  const byStatus: Record<string, ("accept" | "reject" | "ship" | "deliver")[]> = { placed: ["accept", "reject"], accepted: ["ship"], shipped: ["deliver"] };
  return (byStatus[status] ?? []).filter((a) => deskCan(permissions, `orders.${a}`));
}
