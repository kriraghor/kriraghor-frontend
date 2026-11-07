import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "./manage";

/**
 * M27 round 3 · Staff and equipment (gym.kriraghor.com/manage/[gymId]): weekly shifts and clocking in and
 * out (the staff member scans the gym's entrance QR, or shifts.manage clocks them at the desk), the day's board
 * and the month's report; pay terms and the monthly payroll (the owner only; each staff member sees their own
 * payslips); the equipment register with services and repairs. Payroll is the gym's own record: Kriraghor
 * never pays staff. Money is poisha, rates basis points (100 = 1%), dates Dhaka calendar days.
 */
type S = components["schemas"];
export type StaffShift = S["GymStaffShift"];
export type StaffTime = S["GymStaffTime"];
export type StaffShifts = S["GymStaffShifts"];
export type Board = S["GymStaffBoard"];
export type StaffReport = S["GymStaffReport"];
export type MyClock = S["GymMyClock"];
export type Clocked = S["GymStaffClocked"];
export type PayTerms = S["GymPayTerms"];
export type PayrollRun = S["GymPayrollRun"];
export type PayrollRunSummary = S["GymPayrollRunSummary"];
export type PayrollLine = S["GymPayrollLine"];
export type Payslip = S["GymPayslip"];
export type MyPayslips = S["GymMyPayslips"];
export type Asset = S["GymAsset"];
export type Assets = S["GymAssets"];
export type AssetLogs = S["GymAssetLogs"];
export type AssetCategory = Asset["category"];
export type AssetStatus = Asset["status"];
export type PayMethod = PayrollLine["paidMethod"] & string;
export type ShiftInput = { dow: number; startTime: string; endTime: string };
export type AssetInput = {
  name: string;
  category: AssetCategory;
  brand?: string | null;
  serial?: string | null;
  location?: string | null;
  boughtOn?: string | null;
  costPoisha?: number | null;
  serviceEveryDays?: number | null;
  lastServiceOn?: string | null;
  note?: string | null;
};

export const ASSET_CATEGORIES: AssetCategory[] = ["cardio", "strength", "free_weight", "bench_rack", "accessory", "electrical", "furniture", "other"];
export const ASSET_STATUSES: AssetStatus[] = ["working", "needs_service", "out_of_order", "retired"];
export const PAY_METHODS: PayMethod[] = ["cash", "owner_bkash", "owner_nagad", "card_counter", "bank", "other"];

const G = (gymId: string) => ({ path: { gymId } });
const ik = (key: string) => ({ "idempotency-key": key });

export const gymStaff = {
  // attendance
  shifts: async (gymId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/staff-shifts", { params: G(gymId) })),
  setShifts: async (gymId: string, staffId: string, shifts: ShiftInput[]) => unwrap(await api().PUT("/manage/gyms/{gymId}/staff/{staffId}/shifts", { params: { path: { gymId, staffId } }, body: { shifts } })),
  board: async (gymId: string, date?: string) => unwrap(await api().GET("/manage/gyms/{gymId}/staff-attendance", { params: { ...G(gymId), query: date ? { date } : {} } })),
  report: async (gymId: string, period?: string) => unwrap(await api().GET("/manage/gyms/{gymId}/staff-report", { params: { ...G(gymId), query: period ? { period } : {} } })),
  clockAtDesk: async (gymId: string, staffId: string, kind: "in" | "out", note?: string) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/staff-times", { params: G(gymId), body: { staffId, kind, ...(note ? { note } : {}) } })),
  myClock: async (gymId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/staff-clock/me", { params: G(gymId) })),
  clockByScan: async (token: string) => unwrap(await api().POST("/me/gym-staff-clock", { body: { token } })),
  // payroll
  payTerms: async (gymId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/staff-pay", { params: G(gymId) })),
  setPayTerms: async (gymId: string, staffId: string, body: { basePoisha: number; ptCommissionBps: number; salesCommissionBps: number; note?: string | null }) =>
    unwrap(await api().PUT("/manage/gyms/{gymId}/staff/{staffId}/pay", { params: { path: { gymId, staffId } }, body })),
  runs: async (gymId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/payroll", { params: G(gymId) })),
  run: async (gymId: string, runId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/payroll/{runId}", { params: { path: { gymId, runId } } })),
  draft: async (gymId: string, period: string) => unwrap(await api().POST("/manage/gyms/{gymId}/payroll", { params: G(gymId), body: { period } })),
  recalculate: async (gymId: string, runId: string) => unwrap(await api().POST("/manage/gyms/{gymId}/payroll/{runId}/recalculate", { params: { path: { gymId, runId } } })),
  approve: async (gymId: string, runId: string) => unwrap(await api().POST("/manage/gyms/{gymId}/payroll/{runId}/approve", { params: { path: { gymId, runId } } })),
  voidRun: async (gymId: string, runId: string, reason: string) => unwrap(await api().POST("/manage/gyms/{gymId}/payroll/{runId}/void", { params: { path: { gymId, runId } }, body: { reason } })),
  updateLine: async (gymId: string, runId: string, lineId: string, body: { bonusPoisha?: number; deductionPoisha?: number; note?: string | null }) =>
    unwrap(await api().PATCH("/manage/gyms/{gymId}/payroll/{runId}/lines/{lineId}", { params: { path: { gymId, runId, lineId } }, body })),
  payLine: async (gymId: string, runId: string, lineId: string, body: { method: PayMethod; paidOn?: string; fromDrawer?: boolean }, key: string) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/payroll/{runId}/lines/{lineId}/pay", { params: { path: { gymId, runId, lineId }, header: ik(key) }, body })),
  payslip: async (gymId: string, runId: string, lineId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/payroll/{runId}/lines/{lineId}/payslip", { params: { path: { gymId, runId, lineId } } })),
  myPayslips: async (gymId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/my-payslips", { params: G(gymId) })),
  // equipment
  assets: async (gymId: string, status?: AssetStatus) => unwrap(await api().GET("/manage/gyms/{gymId}/assets", { params: { ...G(gymId), query: status ? { status } : {} } })),
  addAsset: async (gymId: string, body: AssetInput) => unwrap(await api().POST("/manage/gyms/{gymId}/assets", { params: G(gymId), body: body as never })),
  editAsset: async (gymId: string, assetId: string, body: Partial<Omit<AssetInput, "lastServiceOn">> & { status?: AssetStatus; statusNote?: string | null }) =>
    unwrap(await api().PATCH("/manage/gyms/{gymId}/assets/{assetId}", { params: { path: { gymId, assetId } }, body: body as never })),
  assetLogs: async (gymId: string, assetId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/assets/{assetId}/logs", { params: { path: { gymId, assetId } } })),
  addAssetLog: async (
    gymId: string,
    assetId: string,
    body: { kind: "service" | "repair" | "note"; doneOn?: string; costPoisha?: number | null; statusAfter?: Exclude<AssetStatus, "retired">; note?: string | null; expense?: { method: PayMethod; fromDrawer?: boolean } },
    key: string,
  ) => unwrap(await api().POST("/manage/gyms/{gymId}/assets/{assetId}/logs", { params: { path: { gymId, assetId }, header: ik(key) }, body })),
};

/** "1 h 05 min" from minutes; plain minutes under an hour. */
export function hoursText(minutes: number, t: (key: string, values?: Record<string, string | number>) => string): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? t("hm", { h, m: String(m).padStart(2, "0") }) : t("m", { m });
}

/** The current Dhaka month, "YYYY-MM". */
export const thisMonth = (today: string) => today.slice(0, 7);

/** The month before or after a "YYYY-MM". */
export function shiftMonth(period: string, by: -1 | 1): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Basis points ↔ a percent string for inputs ("12.5" ↔ 1250). */
export const bpsToPct = (bps: number) => String(bps / 100);
export function pctToBps(text: string): number | null {
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text.trim())) return null;
  const bps = Math.round(Number(text) * 100);
  return bps <= 10000 ? bps : null;
}
