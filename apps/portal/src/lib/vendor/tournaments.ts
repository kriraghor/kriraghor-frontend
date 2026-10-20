import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";

/**
 * The sports tournament console on vendor.kriraghor.com (M14 step 1, with M15 lite results) and the
 * staff tournament desk on admin.kriraghor.com. Organisations of kind `sports` only; the API answers
 * 404 to anyone who is not a member.
 */
export type Tournament = components["schemas"]["Tournament"];
export type Card = components["schemas"]["TournamentCard"];
export type Overview = components["schemas"]["TournamentOverview"];
export type OrgRegistration = components["schemas"]["OrgRegistrations"]["items"][number];
export type Fixtures = components["schemas"]["Fixtures"];
export type Match = components["schemas"]["Match"];
export type SportRules = components["schemas"]["SportRules"];
export type RuleField = SportRules["fields"][number];
export type Generated = components["schemas"]["FixturesGenerated"];
export type AdminTournament = components["schemas"]["AdminTournament"];
export type Seeding = "registration_order" | "manual" | "random";
type RuleValue = number | string | boolean;

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}
const t = (orgId: string, id: string) => ({ params: { path: { orgId, id } } });
const m = (orgId: string, matchId: string) => ({ params: { path: { orgId, matchId } } });
const r = (orgId: string, regId: string) => ({ params: { path: { orgId, regId } } });

export const sportsConsole = {
  mine: async () => ok(await api().GET("/me/organisations")),
  sports: async () => ok(await api().GET("/catalog/sports")),
  rulesOf: async (sportKey: string) => ok(await api().GET("/catalog/sport-rules/{sportKey}", { params: { path: { sportKey } } })),
  areas: async () => ok(await api().GET("/catalog/areas", { params: { query: {} } })),
  list: async (orgId: string) => ok(await api().GET("/org/{orgId}/sports/tournaments", { params: { path: { orgId }, query: {} } })),
  create: async (orgId: string, body: Record<string, unknown>) => ok(await api().POST("/org/{orgId}/sports/tournaments", { params: { path: { orgId } }, body: body as never })),
  get: async (orgId: string, id: string) => ok(await api().GET("/org/{orgId}/sports/tournaments/{id}", t(orgId, id))),
  update: async (orgId: string, id: string, body: Record<string, unknown>) => ok(await api().PATCH("/org/{orgId}/sports/tournaments/{id}", { ...t(orgId, id), body: body as never })),
  overview: async (orgId: string, id: string) => ok(await api().GET("/org/{orgId}/sports/tournaments/{id}/overview", t(orgId, id))),
  submit: async (orgId: string, id: string) => ok(await api().POST("/org/{orgId}/sports/tournaments/{id}/submit", t(orgId, id))),
  cancel: async (orgId: string, id: string, reason: string) => ok(await api().POST("/org/{orgId}/sports/tournaments/{id}/cancel", { ...t(orgId, id), body: { reason } })),
  close: async (orgId: string, id: string) => ok(await api().POST("/org/{orgId}/sports/tournaments/{id}/registration/close", t(orgId, id))),
  extend: async (orgId: string, id: string, closesAt: string) => ok(await api().POST("/org/{orgId}/sports/tournaments/{id}/registration/extend", { ...t(orgId, id), body: { closesAt } })),
  unlock: async (orgId: string, id: string, reason: string) => ok(await api().POST("/org/{orgId}/sports/tournaments/{id}/rules/unlock", { ...t(orgId, id), body: { reason } })),
  registrations: async (orgId: string, id: string) => ok(await api().GET("/org/{orgId}/sports/tournaments/{id}/registrations", { params: { path: { orgId, id }, query: {} } })),
  approve: async (orgId: string, regId: string) => ok(await api().POST("/org/{orgId}/sports/registrations/{regId}/approve", r(orgId, regId))),
  reject: async (orgId: string, regId: string, reason: string) => ok(await api().POST("/org/{orgId}/sports/registrations/{regId}/reject", { ...r(orgId, regId), body: { reason } })),
  remove: async (orgId: string, regId: string, reason: string) => ok(await api().POST("/org/{orgId}/sports/registrations/{regId}/remove", { ...r(orgId, regId), body: { reason } })),
  waive: async (orgId: string, regId: string, reason: string) => ok(await api().POST("/org/{orgId}/sports/registrations/{regId}/waive", { ...r(orgId, regId), body: { reason } })),
  drawPreview: async (orgId: string, id: string, seeding: Seeding) => ok(await api().POST("/org/{orgId}/sports/tournaments/{id}/draw", { ...t(orgId, id), body: { seeding } })),
  drawConfirm: async (orgId: string, id: string, seeding: Seeding) => ok(await api().POST("/org/{orgId}/sports/tournaments/{id}/draw/confirm", { ...t(orgId, id), body: { seeding } })),
  fixtures: async (orgId: string, id: string) => ok(await api().GET("/org/{orgId}/sports/tournaments/{id}/fixtures", t(orgId, id))),
  generate: async (orgId: string, id: string, body: { dryRun: boolean; schedule: Record<string, unknown> | null }) => ok(await api().POST("/org/{orgId}/sports/tournaments/{id}/fixtures/generate", { ...t(orgId, id), body: body as never })),
  publish: async (orgId: string, id: string) => ok(await api().POST("/org/{orgId}/sports/tournaments/{id}/fixtures/publish", t(orgId, id))),
  lots: async (orgId: string, id: string, body: { stageId: string; group: string | null; order: string[] }) => ok(await api().POST("/org/{orgId}/sports/tournaments/{id}/lots", { ...t(orgId, id), body })),
  move: async (orgId: string, matchId: string, body: { scheduledStart?: string | null; venueId?: string | null; court?: string | null; version?: number }) => ok(await api().PATCH("/org/{orgId}/sports/matches/{matchId}", { ...m(orgId, matchId), body })),
  postpone: async (orgId: string, matchId: string, reason: string) => ok(await api().POST("/org/{orgId}/sports/matches/{matchId}/postpone", { ...m(orgId, matchId), body: { reason } })),
  walkover: async (orgId: string, matchId: string, winnerTeamId: string, reason: string) => ok(await api().POST("/org/{orgId}/sports/matches/{matchId}/walkover", { ...m(orgId, matchId), body: { winnerTeamId, reason } })),
  result: async (orgId: string, matchId: string, body: Record<string, unknown>) => ok(await api().PUT("/org/{orgId}/sports/matches/{matchId}/result", { ...m(orgId, matchId), body: body as never })),
  amend: async (orgId: string, matchId: string, body: Record<string, unknown>) => ok(await api().POST("/org/{orgId}/sports/matches/{matchId}/result/amend", { ...m(orgId, matchId), body: body as never })),
};

export const tournamentsAdmin = {
  list: async (q: { status?: string; q?: string }) => ok(await api("admin").GET("/admin/tournaments", { params: { query: { ...(q.status ? { status: q.status } : {}), ...(q.q ? { q: q.q } : {}) } } })),
  get: async (id: string) => ok(await api("admin").GET("/admin/tournaments/{id}", { params: { path: { id } } })),
  cancel: async (id: string, reason: string, stepUpToken: string) => ok(await api("admin").POST("/admin/tournaments/{id}/cancel", { params: { path: { id }, header: { "x-step-up": stepUpToken } as never }, body: { reason } })),
};

/** Initial rule values: the field defaults with a preset on top (the server validates again). */
export function presetValues(rules: SportRules, presetKey: string | null): Record<string, RuleValue> {
  const base: Record<string, RuleValue> = Object.fromEntries(rules.fields.map((f) => [f.key, f.default]));
  const p = presetKey ? rules.presets.find((x) => x.key === presetKey) : null;
  return { ...base, ...(p?.values ?? {}) };
}

/** The score a result form sends, per engine (cricket runs/wickets/balls, clock scores, rally sets). */
export function resultBody(engine: string, f: { a: string; b: string; aw: string; bw: string; ab: string; bb: string; pa: string; pb: string; sets: string; decider: string }): Record<string, unknown> {
  const n = (v: string) => (v.trim() === "" ? undefined : Number(v));
  if (engine === "rally") {
    const sets = f.sets
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.split(/[-:]/).map((x) => Number(x.trim())) as [number, number]);
    return { sets };
  }
  if (engine === "ball_by_ball") {
    return { a: { runs: n(f.a), wickets: n(f.aw), balls: n(f.ab) }, b: { runs: n(f.b), wickets: n(f.bw), balls: n(f.bb) }, ...(f.decider ? { decider: f.decider } : {}) };
  }
  const pens = n(f.pa) !== undefined && n(f.pb) !== undefined ? { pens: { a: n(f.pa), b: n(f.pb) } } : {};
  return { a: { score: n(f.a) }, b: { score: n(f.b) }, ...pens };
}

/** Overs written as "18.3" → balls (18 × 6 + 3). */
export function oversToBalls(overs: string): string {
  if (!overs.trim()) return "";
  const [o, b = "0"] = overs.split(".");
  return String(Number(o) * 6 + Number(b));
}

/** datetime-local value (Dhaka) ↔ ISO. */
export const toLocalInput = (iso: string | null) => (iso ? new Date(Date.parse(iso) + 6 * 3600000).toISOString().slice(0, 16) : "");
export const fromLocalInput = (v: string) => (v ? new Date(Date.parse(`${v}:00+06:00`)).toISOString() : null);
