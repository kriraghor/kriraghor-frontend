import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "../admin/finance";

/**
 * Ground owner desk client (M09, vendor.kriraghor.com): my grounds, courts and hours, photos,
 * review, pause, and the versioned pricing rules with the quote calculator and heatmap. The
 * customer session (audience "api"); the API gate list_ground needs an active ground_owner role.
 */
export type OwnerGround = components["schemas"]["OwnerGround"];
export type OwnerGroundCard = components["schemas"]["OwnerGroundList"]["items"][number];
export type Court = components["schemas"]["GroundCourt"];
export type PricingView = components["schemas"]["GroundPricing"];
export type Rules = NonNullable<components["schemas"]["PricingRules"]>;
export type Quote = components["schemas"]["GroundQuote"];
export type Heatmap = components["schemas"]["PricingHeatmap"];
export type HoursRow = { dow: number; isClosed: boolean; openTime: string | null; closeTime: string | null };
export type GroundInput = {
  name: string;
  areaId: string;
  addressLine: string;
  lat: number;
  lng: number;
  isIndoor?: boolean;
  description?: string | null;
  rulesText?: string | null;
  facilityIds?: string[];
  bookingCutoffMin?: 0 | 15 | 30 | 60;
};
export type CourtInput = { name: string; sportIds: string[]; surfaceId: string; sizeText?: string | null; capacityText?: string | null; combinableGroup?: string | null };
export type RuleInput = Partial<Omit<Rules, "id" | "version" | "status" | "effectiveFrom" | "effectiveTo" | "summary" | "changedKeys" | "updatedAt">>;

const g = (id: string) => ({ path: { id } });

export const vendor = {
  mine: async () => unwrap(await api().GET("/me/grounds")),
  get: async (id: string) => unwrap(await api().GET("/me/grounds/{id}", { params: g(id) })),
  create: async (body: GroundInput & { basePricePoisha: number }) => unwrap(await api().POST("/me/grounds", { body })),
  update: async (id: string, body: Partial<GroundInput>) => unwrap(await api().PATCH("/me/grounds/{id}", { params: g(id), body })),
  submit: async (id: string) => unwrap(await api().POST("/me/grounds/{id}/submit", { params: g(id) })),
  withdraw: async (id: string) => unwrap(await api().POST("/me/grounds/{id}/withdraw", { params: g(id) })),
  pause: async (id: string) => unwrap(await api().POST("/me/grounds/{id}/pause", { params: g(id) })),
  resume: async (id: string) => unwrap(await api().POST("/me/grounds/{id}/resume", { params: g(id) })),
  addCourt: async (id: string, body: CourtInput) => unwrap(await api().POST("/me/grounds/{id}/courts", { params: g(id), body })),
  updateCourt: async (courtId: string, body: Partial<CourtInput>) => unwrap(await api().PATCH("/me/courts/{id}", { params: g(courtId), body })),
  retireCourt: async (courtId: string) => unwrap(await api().POST("/me/courts/{id}/retire", { params: g(courtId) })),
  setHours: async (courtId: string, hours: HoursRow[]) => unwrap(await api().PUT("/me/courts/{id}/hours", { params: g(courtId), body: { hours } })),
  /** One photo, sent raw; the API checks its first bytes. */
  uploadPhoto: async (id: string, file: File) =>
    unwrap(
      await api().POST("/me/grounds/{id}/photos", {
        params: g(id),
        body: file as unknown as string,
        bodySerializer: (b: unknown) => b as BodyInit,
        headers: { "Content-Type": file.type },
      })
    ),
  orderPhotos: async (id: string, ids: string[]) => unwrap(await api().PUT("/me/grounds/{id}/photos/order", { params: g(id), body: { ids } })),
  removePhoto: async (id: string, photoId: string) => unwrap(await api().POST("/me/grounds/{id}/photos/{photoId}/remove", { params: { path: { id, photoId } } })),
  pricing: async (id: string) => unwrap(await api().GET("/me/grounds/{id}/pricing", { params: g(id) })),
  saveDraft: async (id: string, body: RuleInput) => unwrap(await api().PUT("/me/grounds/{id}/pricing/draft", { params: g(id), body })),
  discard: async (id: string) => unwrap(await api().POST("/me/grounds/{id}/pricing/draft/discard", { params: g(id) })),
  publish: async (id: string, applyToAll: boolean) => unwrap(await api().POST("/me/grounds/{id}/pricing/publish", { params: g(id), body: { applyToAll } })),
  history: async (id: string) => unwrap(await api().GET("/me/grounds/{id}/pricing/history", { params: g(id) })),
  heatmap: async (id: string, draft: boolean) => unwrap(await api().GET("/me/grounds/{id}/pricing/heatmap", { params: { ...g(id), query: { draft: String(draft) as unknown as boolean } } })),
  quote: async (id: string, body: { courtIds: string[]; start: string; minutes: number; draft?: RuleInput }) => unwrap(await api().POST("/me/grounds/{id}/pricing/quote", { params: g(id), body })),
  // M03 catalogue (public)
  areas: async () => unwrap(await api().GET("/catalog/areas", { params: { query: { service: "grounds" } } })),
  sports: async () => unwrap(await api().GET("/catalog/sports")),
  surfaces: async () => unwrap(await api().GET("/catalog/surfaces")),
  facilities: async () => unwrap(await api().GET("/catalog/facilities")),
  verification: async () => unwrap(await api().GET("/me/verification", { params: { query: { role: "ground_owner", locale: "en" } } })),
  me: async () => unwrap(await api().GET("/me")),
};

// ---------------- pure helpers (tested)

/** Taka text → poisha (whole or 2 decimals); null when not a number. */
export function toPoisha(text: string): number | null {
  const m = /^\s*(\d+)(?:\.(\d{1,2}))?\s*$/.exec(text);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

/** Every weekday open for the bookable day: the form's starting point. */
export const fullWeek = (open = "06:00", close = "23:00"): HoursRow[] => Array.from({ length: 7 }, (_, dow) => ({ dow, isClosed: false, openTime: open, closeTime: close }));

/** Half-hour times from `from` to `to` inclusive ("06:00" … "23:00"). */
export function halfHours(from = "06:00", to = "23:00"): string[] {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const out: string[] = [];
  for (let x = m(from); x <= m(to); x += 30) out.push(`${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`);
  return out;
}

/** A Dhaka wall-clock date (YYYY-MM-DD) and time ("HH:MM") as an ISO instant. */
export const dhakaIso = (date: string, time: string) => new Date(`${date}T${time}:00+06:00`).toISOString();

/** The next `n` Dhaka dates starting today. */
export function nextDays(n: number, now = new Date()): string[] {
  const base = new Date(now.getTime() + 6 * 3600 * 1000);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + i)).toISOString().slice(0, 10));
}

/** What the owner can do next with a ground, from its status and edit status. */
export function nextActions(status: OwnerGround["status"], editStatus: OwnerGround["editStatus"]): ("submit" | "submit_edit" | "withdraw" | "pause" | "resume" | "edit")[] {
  const published = status === "live" || status === "paused";
  const out: ("submit" | "submit_edit" | "withdraw" | "pause" | "resume" | "edit")[] = [];
  if (["draft", "changes_requested", "withdrawn"].includes(status)) out.push("edit", "submit");
  if (status === "pending_review" || editStatus === "pending_review") out.push("withdraw");
  if (published && editStatus !== "pending_review") out.push("edit");
  if (published && editStatus && ["draft", "changes_requested", "rejected"].includes(editStatus)) out.push("submit_edit");
  if (status === "live") out.push("pause");
  if (status === "paused") out.push("resume");
  return out;
}
