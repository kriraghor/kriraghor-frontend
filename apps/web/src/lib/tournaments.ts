import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";

/**
 * Tournaments on kriraghor.com (M14 step 1, with M15 lite results):
 * - /tournaments: discover by sport and status;
 * - /tournaments/[slug]: the hub (facts, rules, fixtures, standings, the knockout bracket, teams);
 * - /tournaments/[slug]/register: a captain or vice-captain enters a team with a squad, pays the entry
 *   fee into escrow, or joins the reserve list;
 * - /me/tournaments: my teams' registrations (pay, take an offered place, withdraw).
 * Public pages never show DOB, gender or phone: players appear with a name and an NID-verified tick.
 */
export type Hub = components["schemas"]["TournamentHub"];
export type Card = components["schemas"]["TournamentCard"];
export type Match = components["schemas"]["Match"];
export type Table = components["schemas"]["StandingsTable"];
export type MyRegistration = components["schemas"]["MyRegistration"];
export type Ref = { type: string; teamId?: string; matchNo?: number; group?: string; pos?: number; rank?: number };
export type Status = "open" | "live" | "completed";

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}

export const tournaments = {
  list: async (q: { sport?: string; status?: Status; q?: string }) =>
    ok(await api().GET("/tournaments", { params: { query: { ...(q.sport ? { sport: q.sport } : {}), ...(q.status ? { status: q.status } : {}), ...(q.q ? { q: q.q } : {}), limit: 24 } } })),
  hub: async (slug: string) => ok(await api().GET("/tournaments/{slug}", { params: { path: { slug } } })),
  register: async (id: string, body: { teamId: string; rosterUserIds: string[] }, key: string) =>
    ok(await api().POST("/tournaments/{id}/registrations", { params: { path: { id }, header: { "idempotency-key": key } }, body: { ...body, acceptRules: true } })),
  mine: async () => ok(await api().GET("/me/registrations")),
  acceptOffer: async (id: string, key: string) => ok(await api().POST("/me/registrations/{id}/accept-offer", { params: { path: { id }, header: { "idempotency-key": key } } })),
  withdraw: async (id: string) => ok(await api().POST("/me/registrations/{id}/withdraw", { params: { path: { id } } })),
  setRoster: async (id: string, rosterUserIds: string[]) => ok(await api().PUT("/me/registrations/{id}/roster", { params: { path: { id } }, body: { rosterUserIds } })),
};

/** The words for a placeholder side, as a message key and values (the hub translates them). */
export function refLabel(ref: Ref): { key: string; values: Record<string, string | number> } {
  if (ref.type === "winner") return { key: "ref.winner", values: { no: ref.matchNo ?? 0 } };
  if (ref.type === "loser") return { key: "ref.loser", values: { no: ref.matchNo ?? 0 } };
  if (ref.type === "group_pos") return { key: "ref.group", values: { pos: ref.pos ?? 0, group: ref.group ?? "" } };
  if (ref.type === "league_pos") return { key: "ref.league", values: { pos: ref.pos ?? 0 } };
  if (ref.type === "ranked") return { key: "ref.ranked", values: { rank: ref.rank ?? 0, pos: ref.pos ?? 0 } };
  return { key: "ref.tbd", values: {} };
}

/** Knockout rounds in order (round_of_16 … final; third place before the final), with their matches. */
export function bracket(matches: Match[]): { name: string; matches: Match[] }[] {
  const ko = matches.filter((m) => !m.groupId && m.roundName);
  // Teams entering each round, most first; the third-place match (3) sits between the semis and the final.
  const entrants = (name: string) => ({ final: 2, third_place: 3, semi_final: 4, quarter_final: 8 })[name] ?? Number(name.replace("round_of_", ""));
  const names = [...new Set(ko.map((m) => m.roundName as string))].sort((a, b) => entrants(b) - entrants(a));
  return names.map((name) => ({ name, matches: ko.filter((m) => m.roundName === name).sort((a, b) => a.matchNo - b.matchNo) }));
}

/** League and group matches by Dhaka calendar day (unscheduled last). */
export function byDay(matches: Match[]): { day: string | null; matches: Match[] }[] {
  const dayOf = (iso: string | null) => (iso ? new Date(Date.parse(iso) + 6 * 3600000).toISOString().slice(0, 10) : null);
  const days = new Map<string | null, Match[]>();
  for (const m of [...matches].sort((a, b) => (a.scheduledStart ?? "9999").localeCompare(b.scheduledStart ?? "9999") || a.matchNo - b.matchNo)) {
    const d = dayOf(m.scheduledStart);
    days.set(d, [...(days.get(d) ?? []), m]);
  }
  return [...days.entries()].map(([day, list]) => ({ day, matches: list }));
}

/** A short score line from a result's stored score (sets, goals or runs). */
export function scoreLine(m: Match): string | null {
  const r = m.result;
  if (!r) return null;
  if (r.outcome === "walkover") return "W/O";
  if (r.outcome === "no_result") return "NR";
  const s = r.score as { sets?: [number, number][]; a?: { score?: number; runs?: number; wickets?: number }; b?: { score?: number; runs?: number; wickets?: number }; pens?: { a: number; b: number } };
  if (s.sets) return s.sets.map(([x, y]) => `${x}-${y}`).join(", ");
  if (s.a?.runs !== undefined && s.b?.runs !== undefined) return `${s.a.runs}/${s.a.wickets ?? 0} – ${s.b.runs}/${s.b.wickets ?? 0}`;
  if (s.a?.score !== undefined && s.b?.score !== undefined) return `${s.a.score}–${s.b.score}${s.pens ? ` (${s.pens.a}–${s.pens.b} p)` : ""}`;
  return null;
}

export type Tone = "ok" | "warn" | "muted" | "error";
/** Registration and tournament statuses to a chip tone. */
export function statusTone(status: string): Tone {
  if (["approved", "registration_open", "live", "completed"].includes(status)) return status === "completed" ? "muted" : "ok";
  if (["pending_payment", "pending_approval", "offered", "reserve", "registration_closed"].includes(status)) return "warn";
  if (["rejected", "removed", "cancelled"].includes(status)) return "error";
  return "muted";
}
export const TONE: Record<Tone, string> = { ok: "border-brand text-brand", warn: "border-warning text-ink", muted: "border-line text-muted", error: "border-danger text-danger" };

/** Squad choice is valid within the tournament's limits. */
export const squadOk = (count: number, min: number, max: number) => count >= min && count <= max;
