import { api, problemOf } from "@kriraghor/api-client";
import type { components, paths } from "@kriraghor/api-client/schema";
import { unwrap } from "./manage";

/**
 * M24 prompt 1 · Desk MVP: running a gym at the counter (gym.kriraghor.com/manage). The owner and the
 * gym's staff (Round B3 permissions, M24 §3.3) work members, memberships, dues, counter payments,
 * receipts, check-ins and imports; members see their gyms, receipts and check-in QR under /me.
 * Money is poisha, dates are Dhaka calendar days (YYYY-MM-DD). Every POST that creates money records
 * or a membership carries an Idempotency-Key held per form (a retry replays). The API enforces every
 * rule (404 for an unrelated gym, 403 PERMISSION_REQUIRED, 403 GYM_TIER_REQUIRED); these helpers only
 * shape the screens. Money keys are absent for staff who may not see them, so they are optional here.
 */
type S = components["schemas"];
export type ManageGyms = S["GymManageGyms"];
export type ManageGym = ManageGyms["items"][number];
export type Tier = ManageGym["tier"];
export type Features = ManageGym["features"];
export type Feature = keyof Features;
export type Overview = S["GymOverview"];
export type GymSettings = S["GymManageSettings"];
export type DeskSearch = S["GymDeskSearch"];
export type DeskCard = S["GymDeskCard"];
export type DeskPass = NonNullable<DeskSearch["pass"]>;
export type CheckinDay = S["GymCheckinDay"];
export type MemberList = S["GymMemberList"];
export type MemberRow = S["GymMemberListItem"];
export type MemberSummary = S["GymMemberSummary"];
export type Profile = S["GymMemberProfile"];
export type Membership = NonNullable<S["GymMembership"]>;
export type Due = NonNullable<S["GymDue"]>;
export type FeePayment = S["GymFeePayment"];
export type LinkRequest = S["GymLinkRequest"];
export type Note = S["GymMemberNote"];
export type Calendar = S["GymCheckinCalendar"];
export type MembershipResult = S["GymMembershipResult"];
export type DueList = S["GymDueList"];
export type DueRow = DueList["items"][number];
export type Receipt = S["GymReceipt"];
export type CashClosing = S["GymCashClosing"];
export type GymImport = S["GymImport"];
export type ImportRow = S["GymImportReportRow"];
export type Billing = S["GymBilling"];
export type Pricing = S["GymPricing"];
export type PricingTier = Pricing["tiers"][number];
export type CheckinToken = S["GymCheckinToken"];
export type MyRequests = S["MyGymRequests"];
export type MyRequest = MyRequests["items"][number];
export type MyMemberships = S["MyGymMemberships"];
export type MyMembershipCard = Omit<MyMemberships["items"][number], "plans">;
export type MyMembership = S["MyGymMembership"];
export type MyReceipt = S["MyGymReceipts"]["items"][number];
// M24 prompt 3: plans, join requests, trainers, the entrance QR
export type PlanKind = S["GymPlan"]["kind"];
export type Plan = S["GymPlan"];
export type PlanDetail = S["GymPlanDetail"];
export type PlanContent = S["GymPlanContent"];
export type WorkoutContent = S["GymWorkoutContent"];
export type DietContent = S["GymDietContent"];
export type PlanAssignment = S["GymPlanAssignment"];
export type PlanLog = S["GymPlanLog"];
export type MemberPlans = S["GymMemberPlans"];
export type Trainers = S["GymTrainers"];
export type Trainer = Trainers["items"][number];
export type EntranceToken = S["GymEntranceToken"];
export type EntranceCheckin = S["MyGymEntranceCheckin"];
export type JoinAcceptResult = S["GymJoinAcceptResult"];
export type MyPlans = S["MyGymPlans"];
export type MyPlanItem = MyPlans["items"][number];
export type MyPlan = S["MyGymPlan"];
export type PlanInput = { kind: PlanKind; title: string; isTemplate?: boolean; content: PlanContent };
export type PlanPatch = { title?: string; isTemplate?: boolean; content?: PlanContent; applyToAssigned?: boolean };
export type JoinAccept = { packageId?: string; startsOn?: string; admissionFee?: boolean; discountPoisha?: number; discountReason?: string; payment?: Payment };
/** What a gym can sell: old day packages stay in the history only (M24-FR-24, 2 Nov 2026). */
export type PackageKind = Exclude<S["GymOwnerPackage"]["kind"], "day">;
export type OwnerPackage = S["GymOwnerPackage"];
export type Channel = OwnerPackage["channel"];
export type PayMethod = "cash" | "owner_bkash" | "owner_nagad" | "card_counter" | "other";
export type LeftReason = "price" | "moved" | "injury" | "other_gym" | "schedule" | "unknown" | "other";
export type Payment = { amountPoisha: number; method: PayMethod; paidOn?: string; note?: string };
export type MemberInput = {
  displayName: string;
  phone: string;
  gender?: "male" | "female" | "other";
  birthDate?: string;
  email?: string | null;
  emergencyContact?: { name: string; phone: string } | null;
  notes?: string;
  membership?: { packageId: string; startsOn: string; admissionFee?: boolean; discountPoisha?: number; discountReason?: string };
  payment?: Payment;
};
export type MemberPatch = { version: number; displayName?: string; phone?: string; gender?: "male" | "female" | "other" | null; birthDate?: string | null; email?: string | null; emergencyContact?: { name: string; phone: string } | null; bloodGroup?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | null; heightCm?: number | null; weightKg?: number | null; medical?: string | null };
export type SettingsPatch = Partial<Pick<GymSettings, "shortCode" | "tin" | "bin" | "receiptFooter" | "entryPolicy" | "absentAlertDays" | "joinRequestsOpen" | "vatEnabled" | "vatBps">> & { remindersOff?: NonNullable<NonNullable<paths["/manage/gyms/{gymId}/settings"]["patch"]["requestBody"]>["content"]["application/json"]["remindersOff"]> };
export type MembersQuery = { status?: MemberSummary["status"]; due?: "true" | "false"; overdue?: "true" | "false"; expiring?: "true" | "false"; frozen?: "true" | "false"; notSeen?: number; packageId?: string; trainerId?: string; linked?: "true" | "false"; q?: string; cursor?: string; limit?: number };
export type DuesQuery = { status?: Due["status"]; overdue?: "true" | "false"; dueOn?: string; memberId?: string; cursor?: string; limit?: number };

export const PAY_METHODS: PayMethod[] = ["cash", "owner_bkash", "owner_nagad", "card_counter", "other"];
export const LEFT_REASONS: LeftReason[] = ["price", "moved", "injury", "other_gym", "schedule", "unknown", "other"];
export const TIERS: Tier[] = ["free", "basic", "standard", "pro"];
export const FEATURES: Feature[] = ["attendance", "reminders", "online_fees", "expenses", "lockers", "reports", "pos", "pnl", "trainers", "plans", "multi_gym"];
export const KINDS: PackageKind[] = ["month", "quarter", "half_year", "year", "custom"];

const ik = (key: string) => ({ "idempotency-key": key });
const G = (gymId: string) => ({ path: { gymId } });
const GM = (gymId: string, memberId: string) => ({ path: { gymId, memberId } });
const GMS = (gymId: string, membershipId: string) => ({ path: { gymId, membershipId } });

/** One file sent raw (the API reads the bytes; CSV or XLSX for imports, an image for photos). */
const raw = (file: Blob) => ({ body: file as unknown as string, bodySerializer: (b: unknown) => b as BodyInit, headers: { "Content-Type": file.type || "application/octet-stream" } });

export const gymManage = {
  gyms: async () => unwrap(await api().GET("/manage/gyms")),
  overview: async (gymId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/overview", { params: G(gymId) })),
  /** Active packages sold at the desk (members.view): staff can add members and memberships (M24-FR-25). */
  packages: async (gymId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/packages", { params: G(gymId) })),
  settings: async (gymId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/settings", { params: G(gymId) })),
  saveSettings: async (gymId: string, body: SettingsPatch) => unwrap(await api().PATCH("/manage/gyms/{gymId}/settings", { params: G(gymId), body: body as never })),
  // Desk and check-ins (attendance.mark)
  search: async (gymId: string, q: string) => unwrap(await api().GET("/manage/gyms/{gymId}/desk/search", { params: { ...G(gymId), query: { q } } })),
  checkIn: async (gymId: string, body: { memberId: string } | { token: string }, override?: { reason: string }) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/checkins", { params: G(gymId), body: { ...body, ...(override ? { override: true, reason: override.reason } : {}) } })) as DeskCard,
  checkins: async (gymId: string, date?: string) => unwrap(await api().GET("/manage/gyms/{gymId}/checkins", { params: { ...G(gymId), query: date ? { date } : {} } })),
  // Members
  members: async (gymId: string, query: MembersQuery) => unwrap(await api().GET("/manage/gyms/{gymId}/members", { params: { ...G(gymId), query: query as never } })),
  addMember: async (gymId: string, body: MemberInput, key: string) => unwrap(await api().POST("/manage/gyms/{gymId}/members", { params: { ...G(gymId), header: ik(key) }, body: body as never })),
  member: async (gymId: string, memberId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/members/{memberId}", { params: GM(gymId, memberId) })),
  updateMember: async (gymId: string, memberId: string, body: MemberPatch) => unwrap(await api().PATCH("/manage/gyms/{gymId}/members/{memberId}", { params: GM(gymId, memberId), body: body as never })),
  revealPhone: async (gymId: string, memberId: string) => unwrap(await api().POST("/manage/gyms/{gymId}/members/{memberId}/reveal-phone", { params: GM(gymId, memberId) })),
  invite: async (gymId: string, memberId: string, body: { phone?: string; username?: string }) => unwrap(await api().POST("/manage/gyms/{gymId}/members/{memberId}/invite", { params: GM(gymId, memberId), body })),
  unlink: async (gymId: string, memberId: string) => unwrap(await api().POST("/manage/gyms/{gymId}/members/{memberId}/unlink", { params: GM(gymId, memberId) })),
  leave: async (gymId: string, memberId: string, body: { reason: LeftReason; leftOn?: string; note?: string }) => unwrap(await api().POST("/manage/gyms/{gymId}/members/{memberId}/leave", { params: GM(gymId, memberId), body })),
  rejoin: async (gymId: string, memberId: string) => unwrap(await api().POST("/manage/gyms/{gymId}/members/{memberId}/rejoin", { params: GM(gymId, memberId) })),
  remove: async (gymId: string, memberId: string, reason: string) => unwrap(await api().POST("/manage/gyms/{gymId}/members/{memberId}/remove", { params: GM(gymId, memberId), body: { reason } })),
  notes: async (gymId: string, memberId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/members/{memberId}/notes", { params: GM(gymId, memberId) })),
  addNote: async (gymId: string, memberId: string, body: string) => unwrap(await api().POST("/manage/gyms/{gymId}/members/{memberId}/notes", { params: GM(gymId, memberId), body: { body } })),
  attendance: async (gymId: string, memberId: string, month?: string) => unwrap(await api().GET("/manage/gyms/{gymId}/members/{memberId}/attendance", { params: { ...GM(gymId, memberId), query: month ? { month } : {} } })),
  setPhoto: async (gymId: string, memberId: string, file: File) => unwrap(await api().PUT("/manage/gyms/{gymId}/members/{memberId}/photo", { params: GM(gymId, memberId), ...raw(file) } as never)),
  assign: async (gymId: string, memberId: string, body: NonNullable<MemberInput["membership"]> & { payment?: Payment }, key: string) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/members/{memberId}/memberships", { params: { ...GM(gymId, memberId), header: ik(key) }, body: body as never })),
  // Requests (gym invites)
  requests: async (gymId: string, query: { status?: LinkRequest["status"]; direction?: LinkRequest["direction"] } = {}) => unwrap(await api().GET("/manage/gyms/{gymId}/requests", { params: { ...G(gymId), query } })),
  cancelRequest: async (gymId: string, requestId: string) => unwrap(await api().POST("/manage/gyms/{gymId}/requests/{requestId}/cancel", { params: { path: { gymId, requestId } } })),
  /** M24-FR-16, FR-17: a join request becomes a member (or links the unlinked member with the same phone), optionally with a package and a first payment. */
  acceptJoin: async (gymId: string, requestId: string, body: JoinAccept, key: string) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/requests/{requestId}/accept", { params: { path: { gymId, requestId }, header: ik(key) }, body: body as never })),
  declineJoin: async (gymId: string, requestId: string, reason?: string) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/requests/{requestId}/decline", { params: { path: { gymId, requestId } }, body: reason ? { reason } : {} })),
  // Trainers (M24-FR-21, FR-23; feature trainers)
  trainers: async (gymId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/trainers", { params: G(gymId) })),
  setTrainer: async (gymId: string, memberId: string, businessMemberId: string | null) =>
    unwrap(await api().PUT("/manage/gyms/{gymId}/members/{memberId}/trainer", { params: GM(gymId, memberId), body: { businessMemberId } })),
  // Workout plans and diet charts (plans.manage; feature plans; M24-FR-62 to FR-69)
  plans: async (gymId: string, query: { kind?: PlanKind; status?: Plan["status"]; template?: "true" | "false" } = {}) => unwrap(await api().GET("/manage/gyms/{gymId}/plans", { params: { ...G(gymId), query: query as never } })),
  plan: async (gymId: string, planId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/plans/{planId}", { params: { path: { gymId, planId } } })),
  createPlan: async (gymId: string, body: PlanInput) => unwrap(await api().POST("/manage/gyms/{gymId}/plans", { params: G(gymId), body: { ...body, source: "gym" } as never })),
  updatePlan: async (gymId: string, planId: string, body: PlanPatch) => unwrap(await api().PATCH("/manage/gyms/{gymId}/plans/{planId}", { params: { path: { gymId, planId } }, body: body as never })),
  retirePlan: async (gymId: string, planId: string) => unwrap(await api().POST("/manage/gyms/{gymId}/plans/{planId}/retire", { params: { path: { gymId, planId } } })),
  assignPlan: async (gymId: string, planId: string, body: { memberIds: string[]; startsOn: string; endsOn?: string | null }) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/plans/{planId}/assign", { params: { path: { gymId, planId } }, body })),
  endAssignment: async (gymId: string, assignmentId: string) => unwrap(await api().POST("/manage/gyms/{gymId}/plan-assignments/{assignmentId}/end", { params: { path: { gymId, assignmentId } } })),
  memberPlans: async (gymId: string, memberId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/members/{memberId}/plans", { params: GM(gymId, memberId) })),
  // The entrance tablet (attendance.mark; M24-FR-51)
  entranceToken: async (gymId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/entrance-token", { params: G(gymId) })),
  // Memberships (members.edit)
  renew: async (gymId: string, membershipId: string, body: { packageId?: string; startsOn?: string; payment?: Payment }, key: string) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/memberships/{membershipId}/renew", { params: { ...GMS(gymId, membershipId), header: ik(key) }, body: body as never })),
  freeze: async (gymId: string, membershipId: string, body: { fromOn: string; toOn: string; reason: string }) => unwrap(await api().POST("/manage/gyms/{gymId}/memberships/{membershipId}/freeze", { params: GMS(gymId, membershipId), body })),
  unfreeze: async (gymId: string, membershipId: string) => unwrap(await api().POST("/manage/gyms/{gymId}/memberships/{membershipId}/unfreeze", { params: GMS(gymId, membershipId) })),
  change: async (gymId: string, membershipId: string, body: { packageId: string; onDate?: string; dueAmountPoisha?: number | null }, key: string) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/memberships/{membershipId}/change", { params: { ...GMS(gymId, membershipId), header: ik(key) }, body })),
  cancelMembership: async (gymId: string, membershipId: string, reason: string) => unwrap(await api().POST("/manage/gyms/{gymId}/memberships/{membershipId}/cancel", { params: GMS(gymId, membershipId), body: { reason } })),
  // Dues and counter payments (fees.collect; waive and reverse fees.adjust)
  dues: async (gymId: string, query: DuesQuery) => unwrap(await api().GET("/manage/gyms/{gymId}/dues", { params: { ...G(gymId), query: query as never } })),
  pay: async (gymId: string, dueId: string, body: Payment, key: string) => unwrap(await api().POST("/manage/gyms/{gymId}/dues/{dueId}/payments", { params: { path: { gymId, dueId }, header: ik(key) }, body })),
  waive: async (gymId: string, dueId: string, body: { amountPoisha: number; reason: string }) => unwrap(await api().POST("/manage/gyms/{gymId}/dues/{dueId}/waive", { params: { path: { gymId, dueId } }, body })),
  reverse: async (gymId: string, feePaymentId: string, reason: string, key: string) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/fee-payments/{feePaymentId}/reverse", { params: { path: { gymId, feePaymentId }, header: ik(key) }, body: { reason } })),
  receipt: async (gymId: string, feePaymentId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/fee-payments/{feePaymentId}/receipt", { params: { path: { gymId, feePaymentId } } })),
  closing: async (gymId: string, date?: string) => unwrap(await api().GET("/manage/gyms/{gymId}/cash-closing", { params: { ...G(gymId), query: date ? { date } : {} } })),
  // Imports (owner)
  imports: async (gymId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/imports", { params: G(gymId) })),
  upload: async (gymId: string, file: File) => unwrap(await api().POST("/manage/gyms/{gymId}/imports", { params: { ...G(gymId), query: { fileName: file.name } }, ...raw(file) } as never)) as GymImport,
  import: async (gymId: string, importId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/imports/{importId}", { params: { path: { gymId, importId } } })),
  applyImport: async (gymId: string, importId: string, key: string) => unwrap(await api().POST("/manage/gyms/{gymId}/imports/{importId}/apply", { params: { path: { gymId, importId }, header: ik(key) } })),
  undoImport: async (gymId: string, importId: string) => unwrap(await api().POST("/manage/gyms/{gymId}/imports/{importId}/undo", { params: { path: { gymId, importId } } })),
  discardImport: async (gymId: string, importId: string) => unwrap(await api().POST("/manage/gyms/{gymId}/imports/{importId}/discard", { params: { path: { gymId, importId } } })),
  sendInvites: async (gymId: string, importId: string) => unwrap(await api().POST("/manage/gyms/{gymId}/imports/{importId}/send-invites", { params: { path: { gymId, importId } } })),
  consent: async (gymId: string, grant: boolean) => unwrap(await api().PUT("/manage/gyms/{gymId}/import-consent", { params: G(gymId), body: { grant } })),
  // The owner's plan
  billing: async () => unwrap(await api().GET("/manage/billing")),
  setTier: async (tier: Tier) => unwrap(await api().PUT("/manage/billing/tier", { body: { tier } })),
  // Public
  pricing: async () => unwrap(await api().GET("/gym-manage/pricing")),
  publicReceipt: async (token: string) => unwrap(await api().GET("/gym-receipts/{token}", { params: { path: { token } } })),
};

/** The member side (/me): invites, my gyms, receipts, the rotating check-in QR. */
export const gymMe = {
  requests: async () => unwrap(await api().GET("/me/gym-requests")),
  accept: async (requestId: string) => unwrap(await api().POST("/me/gym-requests/{requestId}/accept", { params: { path: { requestId } } })),
  decline: async (requestId: string) => unwrap(await api().POST("/me/gym-requests/{requestId}/decline", { params: { path: { requestId } } })),
  memberships: async () => unwrap(await api().GET("/me/gym-memberships")),
  membership: async (memberId: string) => unwrap(await api().GET("/me/gym-memberships/{memberId}", { params: { path: { memberId } } })),
  attendance: async (memberId: string, month?: string) => unwrap(await api().GET("/me/gym-memberships/{memberId}/attendance", { params: { path: { memberId }, query: month ? { month } : {} } })),
  checkinToken: async (memberId: string) => unwrap(await api().GET("/me/gym-memberships/{memberId}/checkin-token", { params: { path: { memberId } } })),
  healthNote: async (memberId: string, text: string | null) => unwrap(await api().PUT("/me/gym-memberships/{memberId}/health-note", { params: { path: { memberId } }, body: { text } })),
  /** M27-FR-30: my blood group, height, weight and conditions (the API answers with the BMI). */
  health: async (memberId: string, body: { bloodGroup?: string | null; heightCm?: number | null; weightKg?: number | null; medical?: string | null }) =>
    unwrap(await api().PUT("/me/gym-memberships/{memberId}/health", { params: { path: { memberId } }, body: body as never })),
  unlink: async (memberId: string) => unwrap(await api().POST("/me/gym-memberships/{memberId}/unlink", { params: { path: { memberId } } })),
  receipts: async () => unwrap(await api().GET("/me/gym-receipts")),
  // M24 prompt 3
  /** "Join this gym" (gate join_gym: a verified phone; M24-FR-16). */
  joinRequest: async (body: { gymId: string; packageId?: string; note?: string }) => unwrap(await api().POST("/me/gym-join-requests", { body })),
  cancelRequest: async (requestId: string) => unwrap(await api().POST("/me/gym-requests/{requestId}/cancel", { params: { path: { requestId } } })),
  plans: async () => unwrap(await api().GET("/me/gym-plans")),
  plan: async (assignmentId: string) => unwrap(await api().GET("/me/gym-plans/{assignmentId}", { params: { path: { assignmentId } } })),
  logPlan: async (assignmentId: string, body: { localDate: string; itemRef: string; done: boolean; note?: string | null }) =>
    unwrap(await api().POST("/me/gym-plans/{assignmentId}/logs", { params: { path: { assignmentId } }, body })),
  /** The entrance QR scanned at the door (M24-FR-51). */
  entranceCheckin: async (token: string) => unwrap(await api().POST("/me/gym-checkins", { body: { token } })),
};

// ---------------------------------------------------------------- pure helpers (tested)

/** Taka typed by a person ("1,500", "250.50") → poisha, or null when it is not a positive amount with at most 2 decimals. */
export function takaToPoisha(text: string, { allowZero = false } = {}): number | null {
  const m = /^\s*(\d{1,9})(?:\.(\d{1,2}))?\s*$/.exec(text.replace(/,/g, ""));
  if (!m) return null;
  const poisha = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  if (poisha === 0 && !allowZero) return null;
  return poisha;
}

/** Poisha → the plain taka a form shows ("1500", "250.5"); empty for null. */
export const poishaToTakaText = (poisha: number | null | undefined) => (poisha == null ? "" : String(poisha / 100));

/** What the desk does with one scanned or typed value: a member QR checks in, a pass QR admits, anything else searches. */
export type DeskInput = { kind: "member"; token: string } | { kind: "pass"; token: string } | { kind: "search"; q: string } | { kind: "empty" };
export function deskInput(text: string): DeskInput {
  const v = text.trim();
  if (!v) return { kind: "empty" };
  if (/^v1\.gm\.[^.]+\.[^.]+\.[^.]+$/.test(v)) return { kind: "member", token: v };
  if (/^v1\.[^.]+\.[^.]+\.[^.]+$/.test(v)) return { kind: "pass", token: v };
  return { kind: "search", q: v };
}

/** The entry decision as a desk colour: allow green, warn amber, block red (the card always says it in words too). */
export const DECISION_TONE: Record<DeskCard["decision"], "ok" | "warn" | "bad"> = { allow: "ok", warn: "warn", block: "bad" };

/** Can this card be checked in now, and how: straight in, in with warnings, an owner override with a reason, or not at all. */
export function deskAction(card: Pick<DeskCard, "decision" | "canOverride">): "checkIn" | "checkInWarn" | "override" | "refused" {
  if (card.decision === "allow") return "checkIn";
  if (card.decision === "warn") return "checkInWarn";
  return card.canOverride ? "override" : "refused";
}

/** The members list views (one chip each) → the API filters. Unknown views read as everyone. */
export const MEMBER_VIEWS = ["", "active", "due", "overdue", "expiring", "frozen", "expired", "left", "notSeen", "unlinked"] as const;
export type MemberView = (typeof MEMBER_VIEWS)[number];
/** The notSeen view waits for the gym's own absent days (the overview's tiles.notSeenDays, M24-FR-23, FR-53); the other views need nothing. */
export const membersListReady = (view: string | undefined, notSeenDays: number | undefined) => view !== "notSeen" || Boolean(notSeenDays && notSeenDays > 0);
export function membersQuery(f: { view?: string; q?: string; packageId?: string; trainerId?: string; notSeenDays?: number; cursor?: string; limit?: number }): MembersQuery {
  const out: MembersQuery = {};
  switch (f.view as MemberView) {
    case "active":
    case "frozen":
    case "expired":
    case "left":
      out.status = f.view as MembersQuery["status"];
      break;
    case "due":
      out.due = "true";
      break;
    case "overdue":
      out.overdue = "true";
      break;
    case "expiring":
      out.expiring = "true";
      break;
    case "notSeen":
      if (membersListReady("notSeen", f.notSeenDays)) out.notSeen = f.notSeenDays;
      break;
    case "unlinked":
      out.linked = "false";
      break;
  }
  if (f.q?.trim()) out.q = f.q.trim().slice(0, 80);
  if (f.packageId) out.packageId = f.packageId;
  if (f.trainerId) out.trainerId = f.trainerId;
  if (f.cursor) out.cursor = f.cursor;
  if (f.limit) out.limit = f.limit;
  return out;
}

/** The fee views on /fees → the dues filters (the default list is unpaid and partial). */
export const DUE_VIEWS = ["", "overdue", "today", "partial", "paid", "waived"] as const;
export function duesQuery(view: string, today: string, cursor?: string): DuesQuery {
  const base: DuesQuery = cursor ? { cursor } : {};
  switch (view) {
    case "overdue":
      return { ...base, overdue: "true" };
    case "today":
      return { ...base, dueOn: today };
    case "partial":
    case "paid":
    case "waived":
      return { ...base, status: view };
    default:
      return base;
  }
}

/** What the profile offers on one membership, by its state and the caller's permissions. */
export function membershipActions(ms: Pick<Membership, "status" | "freezes">, can: { edit: boolean }, latest: boolean): ("renew" | "freeze" | "unfreeze" | "change" | "cancel")[] {
  if (!can.edit) return [];
  const out: ("renew" | "freeze" | "unfreeze" | "change" | "cancel")[] = [];
  const running = ms.status === "active" || ms.status === "frozen";
  const scheduledFreeze = ms.freezes.some((f) => f.status === "scheduled" || f.status === "active");
  if (latest && (running || ms.status === "expired")) out.push("renew");
  if (ms.status === "active" && !scheduledFreeze) out.push("freeze");
  if (scheduledFreeze && running) out.push("unfreeze");
  if (running) out.push("change");
  if (running || ms.status === "upcoming") out.push("cancel");
  return out;
}

/** What the profile offers on one due: collect (fees.collect) and waive (fees.adjust) while something is outstanding. */
export function dueActions(due: Pick<Due, "status" | "outstandingPoisha">, can: { collect: boolean; adjust: boolean }): ("collect" | "waive")[] {
  const open = (due.status === "unpaid" || due.status === "partial") && (due.outstandingPoisha ?? 1) > 0;
  if (!open) return [];
  return [...(can.collect ? (["collect"] as const) : []), ...(can.adjust ? (["waive"] as const) : [])];
}

/** A counter payment can be reversed once, by fees.adjust; online and opening rows and reversals cannot. */
export const reversible = (p: Pick<FeePayment, "amountPoisha" | "method" | "reversedById" | "reversesId">, canAdjust: boolean) =>
  canAdjust && p.amountPoisha > 0 && !p.reversedById && !p.reversesId && p.method !== "online" && p.method !== "opening";

// ---------------- dates (Dhaka)

const DHAKA_MS = 6 * 3600000;
export const dhakaToday = (now = new Date()) => new Date(now.getTime() + DHAKA_MS).toISOString().slice(0, 10);
export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const monthOf = (date: string) => date.slice(0, 7);
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** A month as weeks for the check-in calendar, Saturday first (the Bangladesh week); null pads the first and last week. */
export function monthGrid(month: string, came: readonly string[]): ({ date: string; day: number; came: boolean } | null)[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const seen = new Set(came);
  const lead = (first.getUTCDay() + 1) % 7; // Saturday → 0
  const cells: ({ date: string; day: number; came: boolean } | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d += 1) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    cells.push({ date, day: d, came: seen.has(date) });
  }
  while (cells.length % 7) cells.push(null);
  const weeks: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Milliseconds until the member QR should be fetched again: a few seconds before it expires, never sooner than 1 s. */
export const qrRefreshIn = (expiresAt: string, now = Date.now(), margin = 5000) => Math.max(1000, Date.parse(expiresAt) - now - margin);

/** Seconds left of an import's undo window (0 when closed or unknown). */
export const secondsLeft = (until: string | null | undefined, now = Date.now()) => (until ? Math.max(0, Math.floor((Date.parse(until) - now) / 1000)) : 0);

/** "23:59:05" for a countdown (hours may pass 24). */
export function countdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ---------------- tiers

/** Is a feature off on this plan (the panel shows an upsell instead of the page)? */
export const featureLocked = (features: Partial<Features> | undefined, feature: Feature) => !features?.[feature];

/** The lowest tier that includes a feature, from the pricing table (null when none does). */
export function minTierFor(tiers: readonly Pick<PricingTier, "key" | "features">[], feature: Feature): Tier | null {
  const sorted = [...tiers].sort((a, b) => TIERS.indexOf(a.key) - TIERS.indexOf(b.key));
  return sorted.find((t) => t.features.includes(feature))?.key ?? null;
}

/** The pricing tiers in plan order (free → pro), for the landing page and billing. */
export const tiersInOrder = <T extends { key: Tier }>(tiers: readonly T[]) => [...tiers].sort((a, b) => TIERS.indexOf(a.key) - TIERS.indexOf(b.key));

// ---------------- short code and packages (onboarding, /packages)

/** A short code suggestion from the gym's name: the first letters of up to 4 words, else the first 3 letters (A–Z only). */
export function suggestShortCode(name: string): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["GYM", "THE", "AND", "FITNESS", "CLUB"].includes(w));
  const initials = words.slice(0, 4).map((w) => w[0]).join("");
  const code = initials.length >= 2 ? initials : (words[0] ?? "").slice(0, 3);
  return code.length >= 2 ? code.slice(0, 6) : "GYM";
}
export const SHORT_CODE = /^[A-Z]{2,6}$/;

/** One editable package row (taka as typed). */
export type PackageRow = { kind: PackageKind; title: string; taka: string; days: string; admissionTaka: string; channel: Channel; visitLimit: string; on: boolean };
export type PackageBody = { kind: PackageKind; title: string; price: number; days?: number; admissionFee?: number; channel: Channel; visitLimit?: number | null; sort: number };
export type PackageProblem = "none" | "bad_title" | "bad_price" | "bad_days" | "bad_admission" | "bad_visits" | "duplicate_kind" | "too_many_custom";

/** The rows that are on → the PUT /me/gyms/:id/packages body (poisha), or the first problem with its row index. */
/** The package to sell online when all are at the desk: the monthly one if there is one, else the first. */
export const packageToSellOnline = (rows: readonly PackageRow[]) => rows.find((r) => r.on && r.kind === "month") ?? rows.find((r) => r.on) ?? null;

export function packagesPayload(rows: readonly PackageRow[], maxCustom: number): { ok: true; packages: PackageBody[] } | { ok: false; problem: PackageProblem; row: number } {
  const on = rows.map((r, i) => ({ r, i })).filter((x) => x.r.on);
  if (!on.length) return { ok: false, problem: "none", row: -1 };
  const seen = new Set<PackageKind>();
  let custom = 0;
  const packages: PackageBody[] = [];
  for (const [sort, { r, i }] of on.entries()) {
    if (r.kind === "custom") {
      custom += 1;
      if (custom > maxCustom) return { ok: false, problem: "too_many_custom", row: i };
    } else if (seen.has(r.kind)) return { ok: false, problem: "duplicate_kind", row: i };
    seen.add(r.kind);
    const title = r.title.trim();
    if (title.length < 2 || title.length > 80) return { ok: false, problem: "bad_title", row: i };
    const price = takaToPoisha(r.taka);
    if (price === null) return { ok: false, problem: "bad_price", row: i };
    const body: PackageBody = { kind: r.kind, title, price, channel: r.channel, sort };
    if (r.kind === "custom") {
      const days = /^\s*\d{1,3}\s*$/.test(r.days) ? Number(r.days) : NaN;
      if (!(days >= 1 && days <= 366)) return { ok: false, problem: "bad_days", row: i };
      body.days = days;
    }
    if (r.admissionTaka.trim()) {
      const fee = takaToPoisha(r.admissionTaka, { allowZero: true });
      if (fee === null) return { ok: false, problem: "bad_admission", row: i };
      body.admissionFee = fee;
    }
    if (r.visitLimit.trim()) {
      const v = /^\s*\d{1,4}\s*$/.test(r.visitLimit) ? Number(r.visitLimit) : NaN;
      if (!(v >= 1)) return { ok: false, problem: "bad_visits", row: i };
      body.visitLimit = v;
    } else body.visitLimit = null;
    packages.push(body);
  }
  return { ok: true, packages };
}

/** The saved packages → editable rows. */
export const packageRowsOf = (packages: readonly OwnerPackage[]): PackageRow[] =>
  [...packages]
    .filter((p): p is OwnerPackage & { kind: PackageKind } => p.kind !== "day")
    .sort((a, b) => a.sort - b.sort)
    .map((p) => ({ kind: p.kind, title: p.title, taka: poishaToTakaText(p.price), days: String(p.days), admissionTaka: p.admissionFee ? poishaToTakaText(p.admissionFee) : "", channel: p.channel, visitLimit: p.visitLimit ? String(p.visitLimit) : "", on: true }));

/** A private gym's first packages on /start: month, 3, 6 and 12 months, sold at the desk. */
export const starterRows = (titles: Record<"month" | "quarter" | "half_year" | "year", string>): PackageRow[] =>
  (["month", "quarter", "half_year", "year"] as const).map((kind) => ({ kind, title: titles[kind], taka: "", days: "", admissionTaka: "", channel: "desk", visitLimit: "", on: kind === "month" }));

// ---------------- /start: the private gym path

export type PrivateStep = "signIn" | "phone" | "gym" | "code" | "packages" | "next";
/** Where the private gym path stands: signed in, phone verified, then the gym, its short code, its packages and what next (?gym=&step= in the URL). */
export function privateStep(input: { signedIn: boolean; phoneVerified: boolean; gymId: string | null; step: string | null; setupDone?: boolean }): PrivateStep {
  if (!input.signedIn) return "signIn";
  if (!input.phoneVerified) return "phone";
  if (!input.gymId) return "gym";
  if (input.step === "code" || input.step === "packages" || input.step === "next") return input.step;
  return input.setupDone ? "packages" : "code";
}

// ---------------- import

/** The import template's columns, in order (M24-FR-75). */
export const IMPORT_HEADERS = ["Name", "Phone", "Gender", "Date of birth", "Package", "Start", "End", "Last payment date", "Last payment amount", "Amount due", "Member code"] as const;

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** The template CSV (header and one example row), built in the browser; a UTF-8 BOM so Excel reads Bangla names. */
export function importTemplateCsv(example: readonly string[]): string {
  return `﻿${[IMPORT_HEADERS.join(","), example.map(csvCell).join(",")].join("\r\n")}\r\n`;
}

/** The preview's numbers and the rows to show first (errors first, then by row number). */
export function importPreview(rows: readonly ImportRow[]): { ok: number; failed: number; rows: ImportRow[]; fieldsWithErrors: string[] } {
  const sorted = [...rows].sort((a, b) => (a.status === b.status ? a.n - b.n : a.status === "error" ? -1 : 1));
  const fields = [...new Set(rows.flatMap((r) => r.errors.map((e) => e.field)))].sort();
  return { ok: rows.filter((r) => r.status === "ok").length, failed: rows.filter((r) => r.status === "error").length, rows: sorted, fieldsWithErrors: fields };
}

// ---------------- receipts

/** The receipt link as a path on this site (/r/<token>): the API builds it on its GYM_APP_URL, the page opens it here. */
export function receiptPath(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const path = new URL(url, "https://gym.kriraghor.com").pathname;
    return /^\/r\/[^/]+$/.test(path) ? path : null;
  } catch {
    return null;
  }
}

/** The receipt's lines in print order; the TIN and BIN lines only when the owner entered one (M24-FR-37). */
export function receiptLines(r: Pick<Receipt, "gym" | "reversed">): { tin: string | null; bin: string | null; reversedOn: string | null } {
  return { tin: r.gym.tin?.trim() || null, bin: r.gym.bin?.trim() || null, reversedOn: r.reversed?.on ?? null };
}

/** What the receipt page shows for a token's answer: loading, not found (a bad or foreign token), an error, or the receipt. */
export function receiptState(q: { isPending: boolean; error: unknown; data?: Receipt }): "loading" | "notFound" | "error" | "ready" {
  if (q.isPending) return "loading";
  if (q.error) {
    const p = problemOf(q.error);
    return p?.status === 404 || p?.code === "NOT_FOUND" ? "notFound" : "error";
  }
  return q.data ? "ready" : "error";
}

// ---------------- settings

/** The settings form as typed (text), from the saved settings. */
export type SettingsDraft = { shortCode: string; tin: string; bin: string; receiptFooter: string; entryPolicy: GymSettings["entryPolicy"]; absentAlertDays: string; joinRequestsOpen: boolean; vatEnabled: boolean; vatPct: string };
export const draftOf = (s: GymSettings): SettingsDraft => ({ shortCode: s.shortCode ?? "", tin: s.tin ?? "", bin: s.bin ?? "", receiptFooter: s.receiptFooter ?? "", entryPolicy: s.entryPolicy, absentAlertDays: s.absentAlertDays == null ? "" : String(s.absentAlertDays), joinRequestsOpen: s.joinRequestsOpen, vatEnabled: s.vatEnabled, vatPct: s.vatBps == null ? "" : String(s.vatBps / 100) });

/** VAT typed as a percent ("15", "7.5") → basis points, or null when it is not 0–100 with at most 2 decimals (M27-FR-28). */
export function vatBpsOf(text: string): number | null {
  const m = /^\s*(\d{1,3})(?:\.(\d{1,2}))?\s*$/.exec(text);
  if (!m) return null;
  const bps = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return bps <= 10000 ? bps : null;
}

/** Only what changed, as the PATCH body (blank text → null; the short code in capitals). */
export function settingsPatch(s: GymSettings, d: SettingsDraft): SettingsPatch {
  const out: SettingsPatch = {};
  const text = (v: string) => (v.trim() ? v.trim() : null);
  if (d.shortCode.trim().toUpperCase() !== (s.shortCode ?? "")) out.shortCode = d.shortCode.trim().toUpperCase();
  if (text(d.tin) !== s.tin) out.tin = text(d.tin);
  if (text(d.bin) !== s.bin) out.bin = text(d.bin);
  if (text(d.receiptFooter) !== s.receiptFooter) out.receiptFooter = text(d.receiptFooter);
  if (d.entryPolicy !== s.entryPolicy) out.entryPolicy = d.entryPolicy;
  const days = d.absentAlertDays.trim() ? Number(d.absentAlertDays) : null;
  if (days !== s.absentAlertDays) out.absentAlertDays = days;
  if (d.joinRequestsOpen !== s.joinRequestsOpen) out.joinRequestsOpen = d.joinRequestsOpen;
  if (d.vatEnabled !== s.vatEnabled) out.vatEnabled = d.vatEnabled;
  const bps = d.vatPct.trim() ? vatBpsOf(d.vatPct) : null;
  if (bps !== s.vatBps && (bps !== null || !d.vatPct.trim())) out.vatBps = bps;
  return out;
}
