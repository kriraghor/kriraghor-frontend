import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { unwrap } from "../admin/finance";

/**
 * Gym owner desk client (M20, vendor.kriraghor.com): my gyms (working copy, photos, weekly hours with
 * women-only windows, the day / month / quarter packages, review, pause), the front desk (admit a
 * pass by its QR token or 6-character code, today's admissions) and the passes sold. The customer
 * session; the API gate list_gym needs an active gym_owner role.
 */
export type OwnerGym = components["schemas"]["OwnerGym"];
export type Hours = OwnerGym["hours"];
export type HoursWindow = Hours[number];
export type PackageKind = "day" | "month" | "quarter";
export type PackageInput = { kind: PackageKind; title: string; price: number };
export type Admission = components["schemas"]["GymAdmission"];
export type AdmissionList = components["schemas"]["GymAdmissionList"];
export type Sold = components["schemas"]["GymSoldList"]["items"][number];
export type GymInput = { name: string; areaId: string; addressLine: string; lat?: number | null; lng?: number | null; about?: string | null; facilityIds?: string[]; dailyCapacity?: number | null };

const g = (id: string) => ({ path: { id } });

export const gymDesk = {
  mine: async () => unwrap(await api().GET("/me/gyms")),
  get: async (id: string) => unwrap(await api().GET("/me/gyms/{id}", { params: g(id) })),
  create: async (body: GymInput) => unwrap(await api().POST("/me/gyms", { body })),
  update: async (id: string, body: Partial<GymInput>) => unwrap(await api().PATCH("/me/gyms/{id}", { params: g(id), body })),
  setHours: async (id: string, hours: { dow: number; openTime: string; closeTime: string; womenOnly: boolean }[]) => unwrap(await api().PUT("/me/gyms/{id}/hours", { params: g(id), body: { hours } })),
  setPackages: async (id: string, packages: PackageInput[]) => unwrap(await api().PUT("/me/gyms/{id}/packages", { params: g(id), body: { packages } })),
  /** One photo, sent raw; the API checks its first bytes. */
  uploadPhoto: async (id: string, file: File) =>
    unwrap(
      await api().POST("/me/gyms/{id}/photos", {
        params: g(id),
        body: file as unknown as string,
        bodySerializer: (b: unknown) => b as BodyInit,
        headers: { "Content-Type": file.type },
      })
    ),
  orderPhotos: async (id: string, ids: string[]) => unwrap(await api().PUT("/me/gyms/{id}/photos/order", { params: g(id), body: { ids } })),
  removePhoto: async (id: string, photoId: string) => unwrap(await api().POST("/me/gyms/{id}/photos/{photoId}/remove", { params: { path: { id, photoId } } })),
  submit: async (id: string) => unwrap(await api().POST("/me/gyms/{id}/submit", { params: g(id) })),
  pause: async (id: string) => unwrap(await api().POST("/me/gyms/{id}/pause", { params: g(id) })),
  resume: async (id: string) => unwrap(await api().POST("/me/gyms/{id}/resume", { params: g(id) })),
  redeem: async (id: string, input: { token: string } | { code: string }) => unwrap(await api().POST("/me/gyms/{id}/redemptions", { params: g(id), body: input })),
  admissions: async (id: string, date?: string) => unwrap(await api().GET("/me/gyms/{id}/redemptions", { params: { ...g(id), query: date ? { date } : {} } })),
  sold: async (id: string, status?: Sold["status"]) => unwrap(await api().GET("/me/gyms/{id}/passes", { params: { ...g(id), query: status ? { status } : {} } })),
  // M03 catalogue (public)
  areas: async () => unwrap(await api().GET("/catalog/areas", { params: { query: { service: "delivery" } } })),
  facilities: async () => unwrap(await api().GET("/catalog/facilities")),
};

// ---------------- pure helpers (tested)

const KIND_ORDER: PackageKind[] = ["day", "month", "quarter"];

/** What the owner can do in each state (mirrors gyms.service: no edits while in review, rejected, suspended or removed). */
export function gymActions(status: OwnerGym["status"], editStatus: OwnerGym["editStatus"]): ("edit" | "submit" | "submit_edit" | "pause" | "resume")[] {
  const inReview = status === "pending_review" || editStatus === "pending_review";
  const published = status === "live" || status === "paused";
  const out: ("edit" | "submit" | "submit_edit" | "pause" | "resume")[] = [];
  if (!inReview && !["rejected", "suspended", "removed"].includes(status)) out.push("edit");
  if (!inReview && ["draft", "changes_requested", "withdrawn"].includes(status)) out.push("submit");
  if (published && editStatus && ["draft", "changes_requested", "rejected"].includes(editStatus)) out.push("submit_edit");
  if (status === "live") out.push("pause");
  if (status === "paused") out.push("resume");
  return out;
}

/** Windows of one weekday, sorted by opening time. */
export const windowsOf = (hours: Hours, dow: number) => hours.filter((h) => h.dow === dow).sort((a, b) => a.openTime.localeCompare(b.openTime));

/** Copy one weekday's windows to every other day. */
export function copyDayToAll(hours: Hours, dow: number): Hours {
  const src = windowsOf(hours, dow);
  return [0, 1, 2, 3, 4, 5, 6].flatMap((d) => src.map((w) => ({ ...w, dow: d })));
}

/** Problems with the week before it is sent: times in order, no overlaps in a day. Keys are "dow:index". */
export function hoursProblems(hours: Hours): string[] {
  const out: string[] = [];
  for (let d = 0; d < 7; d += 1) {
    const ws = windowsOf(hours, d);
    ws.forEach((w, i) => {
      if (w.closeTime <= w.openTime) out.push(`${d}:${i}:order`);
      else if (i > 0 && w.openTime < ws[i - 1].closeTime) out.push(`${d}:${i}:overlap`);
    });
  }
  return out;
}

/** The packages in kind order with prices in taka text → the API body (poisha), or the first problem. */
export function packagesBody(rows: { kind: PackageKind; title: string; taka: string; on: boolean }[]): { ok: true; packages: PackageInput[] } | { ok: false; problem: "day_required" | "bad_price" | "bad_title" } {
  const on = rows.filter((r) => r.on).sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  if (!on.some((r) => r.kind === "day")) return { ok: false, problem: "day_required" };
  const packages: PackageInput[] = [];
  for (const r of on) {
    const m = /^\s*(\d+)\s*$/.exec(r.taka);
    if (!m || Number(m[1]) <= 0) return { ok: false, problem: "bad_price" };
    if (r.title.trim().length < 2) return { ok: false, problem: "bad_title" };
    packages.push({ kind: r.kind, title: r.title.trim(), price: Number(m[1]) * 100 });
  }
  return { ok: true, packages };
}

/** A typed backup code: upper case, no spaces or dashes (the API also accepts the dashed form). */
export const cleanCode = (text: string) => text.toUpperCase().replace(/[^0-9A-Z]/g, "");

/** A scanned value: a pass token (v1.<id>.<nonce>.<sig>) or else a backup code. */
export const scanInput = (text: string): { token: string } | { code: string } => (/^v1\.[^.]+\.[^.]+\.[^.]+$/.test(text.trim()) ? { token: text.trim() } : { code: cleanCode(text) });
