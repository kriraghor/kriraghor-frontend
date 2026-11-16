import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";

/**
 * Hire on kriraghor.com (M11 step 1):
 * - The directory (/hiring) with filters, and a profile page with rates, the verified credential and
 *   a 14-day busy strip.
 * - A request with a live server quote (/hire/requests).
 * - The manager's requests (/me/hire): pay, the message thread, confirm, cancel with a fee preview,
 *   and a no-show or problem as an M17 dispute.
 * - The pro desk (/pro): profiles and rate cards, requests with their checks, match day.
 * Phones stay masked until the request is paid (v3).
 */
export type Taxonomy = components["schemas"]["HireTaxonomy"];
export type Category = Taxonomy["items"][number];
export type Role = Category["roles"][number];
export type Card = components["schemas"]["HireCard"];
export type ProfileList = components["schemas"]["HireProfileList"];
export type ProfilePage = components["schemas"]["HireProfilePage"];
export type RateCard = components["schemas"]["HireRateCard"];
export type Quote = components["schemas"]["HireQuote"];
export type RequestResult = components["schemas"]["HireRequestResult"];
export type HireRequest = RequestResult["request"];
export type Job = components["schemas"]["HireJob"];
export type CancelPlan = components["schemas"]["HireCancelPlan"];
export type Messages = components["schemas"]["HireMessages"];
export type OwnerProfile = components["schemas"]["HireOwnerProfile"];
export type Unit = "hourly" | "match";
export type Format = "T10" | "T20" | "OD" | "TAPE";
export type Level = "amateur" | "semi_pro" | "pro" | "national";
export type Sort = "rating" | "rate" | "jobs" | "experience";
export type Filters = { category?: string; role?: string; exp?: Level[]; unit?: Unit; areaId?: string; q?: string; sort?: Sort; cursor?: string };
export type Engagement = { start: string; format?: Format; hours?: number; venueText: string; venueAreaId: string; u16?: boolean };
export type ProfileBody = { roleKey: string; headline: string; specialisation?: string; sportKeys: string[]; experienceLevel: Level; years: number; baseAreaId: string; bio?: string; worksWithU16: boolean };
export type RateCardBody = { items: { unit: Unit; format?: Format; rate: number }[]; nightPct: number; shortNoticePct: number; shortNoticeHours?: number; travel: { north: number; south: number; outside: number }; maxJobsPerDay: number };

export const LEVELS: Level[] = ["amateur", "semi_pro", "pro", "national"];
export const SORTS: Sort[] = ["rating", "rate", "jobs", "experience"];
export const DECLINE_REASONS = ["not_available", "outside_area", "fee_too_low", "credential_not_covering", "other"] as const;
export const WITHDRAW_REASONS = ["not_available", "injury", "emergency", "other"] as const;

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}
const key = (k: string) => ({ "idempotency-key": k });

export const hire = {
  taxonomy: async () => ok(await api().GET("/hire/taxonomy")),
  /** Areas for a venue or a base: every active area (the travel zone comes from it). */
  areas: async () => ok(await api().GET("/catalog/areas", { params: { query: { service: "delivery" } } })),
  list: async (f: Filters) =>
    ok(
      await api().GET("/hire/profiles", {
        params: {
          query: {
            ...(f.category ? { category: f.category } : {}),
            ...(f.role ? { role: f.role } : {}),
            ...(f.exp?.length ? { exp: f.exp.join(",") } : {}),
            ...(f.unit ? { unit: f.unit } : {}),
            ...(f.areaId ? { areaId: f.areaId } : {}),
            ...(f.q ? { q: f.q } : {}),
            sort: f.sort ?? "rating",
            ...(f.cursor ? { cursor: f.cursor } : {}),
            limit: 24,
          } as never,
        },
      }),
    ),
  page: async (slug: string) => ok(await api().GET("/hire/profiles/{slug}", { params: { path: { slug } } })),
  quote: async (id: string, unit: Unit, engagements: Engagement[]) => ok(await api().POST("/hire/profiles/{id}/quote", { params: { path: { id } }, body: { unit, engagements } })),
  shortlist: async () => ok(await api().GET("/me/shortlist")),
  setShortlisted: async (profileId: string, on: boolean) =>
    on ? ok(await api().PUT("/me/shortlist/{profileId}", { params: { path: { profileId } } })) : ok(await api().DELETE("/me/shortlist/{profileId}", { params: { path: { profileId } } })),
  send: async (profileId: string, unit: Unit, engagements: Engagement[], note: string, k: string) =>
    ok(await api().POST("/hire/requests", { params: { header: key(k) }, body: { profileId, unit, engagements, ...(note.trim() ? { note: note.trim() } : {}) } })),

  // the manager
  mine: async () => ok(await api().GET("/me/hire-requests")),
  one: async (idOrCode: string) => ok(await api().GET("/me/hire-requests/{id}", { params: { path: { id: idOrCode } } })),
  pay: async (id: string) => ok(await api().POST("/me/hire-requests/{id}/pay", { params: { path: { id } } })),
  withdrawRequest: async (id: string) => ok(await api().POST("/me/hire-requests/{id}/withdraw", { params: { path: { id } } })),
  messages: async (id: string) => ok(await api().GET("/me/hire-requests/{id}/messages", { params: { path: { id } } })),
  post: async (id: string, body: string) => ok(await api().POST("/me/hire-requests/{id}/messages", { params: { path: { id } }, body: { body } })),
  cancelPreview: async (id: string) => ok(await api().GET("/me/hire-jobs/{id}/cancel-preview", { params: { path: { id } } })),
  cancel: async (id: string) => ok(await api().POST("/me/hire-jobs/{id}/cancel", { params: { path: { id } } })),
  confirm: async (id: string) => ok(await api().POST("/me/hire-jobs/{id}/confirm", { params: { path: { id } } })),
  dispute: async (id: string, kind: "no-show" | "problem", statement: string, k: string) =>
    ok(await api().POST(kind === "no-show" ? "/me/hire-jobs/{id}/no-show" : "/me/hire-jobs/{id}/problem", { params: { path: { id }, header: key(k) }, body: { statement } })) as { dispute?: { code?: string } },

  // the pro desk
  myProfiles: async () => ok(await api().GET("/pro/profiles")),
  myProfile: async (id: string) => ok(await api().GET("/pro/profiles/{id}", { params: { path: { id } } })),
  createProfile: async (body: ProfileBody) => ok(await api().POST("/pro/profiles", { body })),
  updateProfile: async (id: string, body: Partial<Omit<ProfileBody, "roleKey">>) => ok(await api().PATCH("/pro/profiles/{id}", { params: { path: { id } }, body })),
  saveRateCard: async (id: string, body: RateCardBody) => ok(await api().PUT("/pro/profiles/{id}/rate-card", { params: { path: { id } }, body })),
  submit: async (id: string) => ok(await api().POST("/pro/profiles/{id}/submit", { params: { path: { id } } })),
  setPaused: async (id: string, paused: boolean) =>
    paused ? ok(await api().POST("/pro/profiles/{id}/pause", { params: { path: { id } } })) : ok(await api().POST("/pro/profiles/{id}/resume", { params: { path: { id } } })),
  requests: async (status?: string) => ok(await api().GET("/pro/requests", { params: { query: status ? { status: status as never } : {} } })),
  accept: async (id: string) => ok(await api().POST("/pro/requests/{id}/accept", { params: { path: { id } } })),
  decline: async (id: string, reason: (typeof DECLINE_REASONS)[number]) => ok(await api().POST("/pro/requests/{id}/decline", { params: { path: { id } }, body: { reason } })),
  jobs: async () => ok(await api().GET("/pro/jobs", { params: { query: {} } })),
  checkIn: async (id: string) => ok(await api().POST("/pro/jobs/{id}/check-in", { params: { path: { id } } })),
  start: async (id: string) => ok(await api().POST("/pro/jobs/{id}/start", { params: { path: { id } } })),
  complete: async (id: string, result: string, note: string) =>
    ok(await api().POST("/pro/jobs/{id}/complete", { params: { path: { id } }, body: { ...(result.trim() ? { result: result.trim() } : {}), ...(note.trim() ? { note: note.trim() } : {}) } })),
  withdrawJob: async (id: string, reason: (typeof WITHDRAW_REASONS)[number]) => ok(await api().POST("/pro/jobs/{id}/withdraw", { params: { path: { id } }, body: { reason } })),
};

// ---------------- filters in the URL (/hiring?category=officials&exp=pro,national&unit=match&sort=rate)

export function filtersFromParams(p: URLSearchParams): Filters {
  const exp = (p.get("exp") ?? "").split(",").filter((x): x is Level => LEVELS.includes(x as Level));
  const unit = p.get("unit");
  const sort = p.get("sort");
  return {
    ...(p.get("category") ? { category: p.get("category")! } : {}),
    ...(p.get("role") ? { role: p.get("role")! } : {}),
    ...(exp.length ? { exp } : {}),
    ...(unit === "hourly" || unit === "match" ? { unit } : {}),
    ...(p.get("areaId") ? { areaId: p.get("areaId")! } : {}),
    ...(p.get("q") ? { q: p.get("q")! } : {}),
    ...(sort && SORTS.includes(sort as Sort) && sort !== "rating" ? { sort: sort as Sort } : {}),
  };
}

export function paramsFromFilters(f: Filters): string {
  const p = new URLSearchParams();
  if (f.category) p.set("category", f.category);
  if (f.role) p.set("role", f.role);
  if (f.exp?.length) p.set("exp", f.exp.join(","));
  if (f.unit) p.set("unit", f.unit);
  if (f.areaId) p.set("areaId", f.areaId);
  if (f.q) p.set("q", f.q);
  if (f.sort && f.sort !== "rating") p.set("sort", f.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}

// ---------------- times on the Dhaka clock (UTC+6, no daylight saving)

const DHAKA_MS = 6 * 3600000;

/** "2026-10-22" and "19:30" on the Dhaka clock → an ISO instant. */
export function dhakaInstant(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - DHAKA_MS).toISOString();
}

/** The Dhaka calendar day of an instant (YYYY-MM-DD). */
export const dhakaDay = (iso: string | Date) => new Date(new Date(iso).getTime() + DHAKA_MS).toISOString().slice(0, 10);

/** The next `n` Dhaka days from `now`, for the availability strip. */
export function nextDays(n: number, now = new Date()): string[] {
  const first = new Date(`${dhakaDay(now)}T00:00:00Z`).getTime();
  return Array.from({ length: n }, (_, i) => new Date(first + i * 86400000).toISOString().slice(0, 10));
}

/** Busy windows per Dhaka day (a window across midnight counts on both days). */
export function busyByDay(busy: { start: string; end: string }[]): Map<string, { start: string; end: string }[]> {
  const out = new Map<string, { start: string; end: string }[]>();
  for (const b of busy) {
    for (const d of new Set([dhakaDay(b.start), dhakaDay(new Date(new Date(b.end).getTime() - 1))])) out.set(d, [...(out.get(d) ?? []), b]);
  }
  return out;
}

// ---------------- rates and statuses

/** The rate of a (unit, format) on a card, or null. */
export const rateOf = (card: RateCard | null | undefined, unit: Unit, format?: Format | null) => card?.items.find((i) => i.unit === unit && (i.format ?? null) === (format ?? null))?.rate ?? null;

/** Taka (as typed) → poisha; "" or bad input → null. */
export function takaToPoisha(text: string): number | null {
  const t = text.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export const poishaToTaka = (n: number | null | undefined) => (n === null || n === undefined ? "" : n % 100 ? (n / 100).toFixed(2) : String(n / 100));

/** The limit key the server reports for a (unit, format): "match:T20", "hourly:". */
export const limitKey = (unit: Unit, format?: Format | null) => `${unit}:${format ?? ""}`;

export type Tone = "ok" | "warn" | "muted" | "error";

export function requestTone(status: string): Tone {
  if (["confirmed", "completed"].includes(status)) return "ok";
  if (["pending", "accepted_unpaid"].includes(status)) return "warn";
  return "muted";
}

export function jobTone(status: string): Tone {
  if (status === "released") return "ok";
  if (["reserved", "scheduled", "checked_in", "live", "completed_marked"].includes(status)) return "warn";
  if (status === "disputed") return "error";
  return "muted";
}

export function profileTone(status: string): Tone {
  if (status === "live") return "ok";
  if (["draft", "pending_review", "paused"].includes(status)) return "warn";
  if (["changes_requested", "rejected", "suspended"].includes(status)) return "error";
  return "muted";
}

export const TONE: Record<Tone, string> = {
  ok: "border-brand text-brand",
  warn: "border-warning text-ink",
  muted: "border-line text-muted",
  error: "border-danger text-danger",
};

/** Minutes left until `iso` (0 when past), for the pay and reply countdowns. */
export const minutesLeft = (iso: string | null | undefined, now = Date.now()) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 60000)) : 0);
