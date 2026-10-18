import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { unwrap } from "./finance";

/**
 * Admin esports desk client (M21): tournaments (draft, submit for M05 review, streams, cancel and
 * finalise with step-up esports.money), the check-in board, rooms (set, rotate, reveal, view log),
 * results (draft, post), disputes, disqualification and UID bans.
 */
export type TournamentCard = components["schemas"]["EsportsTournamentList"]["items"][number];
export type Tournament = components["schemas"]["EsportsTournament"];
export type Match = components["schemas"]["EsportsMatch"];
export type RoomPanel = components["schemas"]["EsportsRoomPanel"];
export type Board = components["schemas"]["EsportsCheckinBoard"];
export type Preview = components["schemas"]["EsportsFinalisePreview"];
/** The draft a staff member sends (POST /admin/esports/tournaments). Money in poisha. */
export type TournamentInput = {
  gameId: string;
  modeId: string;
  titleEn: string;
  titleBn: string;
  tier: "daily" | "weekly" | "monthly" | "major";
  format: "single_match" | "series";
  entryFee: number;
  maxSlots: number;
  minParticipants: number;
  prizes: { place: number; amount: number }[];
  killReward: number;
  /** M22: organisers with a per-kill reward cap the paid kills (the prize fund covers it). */
  maxPaidKills?: number;
  pointsPresetId?: string;
  registrationOpensAt: string;
  registrationClosesAt?: string;
  matches: { mapId: string; startsAt: string }[];
  rulesMd: string;
  featured: boolean;
};

export type ResultRow = { registrationId: string; placement: number | null; kills: { userId: string; kills: number }[] };

/** Taka text → poisha (whole or 2 decimals); null when not a number. */
export function toPoisha(text: string): number | null {
  const m = /^\s*(\d+)(?:\.(\d{1,2}))?\s*$/.exec(text);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

/** Validate a results table locally (the server re-checks): unique placements 1..N, kills ≥ 0. */
export function resultsProblem(rows: { placement: number | null; kills: number[] }[]): "placement" | "duplicate" | "kills" | null {
  const seen = new Set<number>();
  for (const r of rows) {
    if (r.placement !== null) {
      if (!Number.isInteger(r.placement) || r.placement < 1 || r.placement > rows.length) return "placement";
      if (seen.has(r.placement)) return "duplicate";
      seen.add(r.placement);
    }
    if (r.kills.some((k) => !Number.isInteger(k) || k < 0)) return "kills";
  }
  return null;
}

const id = (v: string) => ({ path: { id: v } });

export const esportsAdmin = {
  list: async (status?: string) => unwrap(await api("admin").GET("/admin/esports/tournaments", { params: { query: { ...(status ? { status } : {}), limit: 50 } } })),
  get: async (tid: string) => unwrap(await api("admin").GET("/admin/esports/tournaments/{id}", { params: id(tid) })),
  create: async (body: TournamentInput) => unwrap(await api("admin").POST("/admin/esports/tournaments", { body })),
  patch: async (tid: string, body: Record<string, unknown>) => unwrap(await api("admin").PATCH("/admin/esports/tournaments/{id}", { params: id(tid), body: body as never })),
  submit: async (tid: string) => unwrap(await api("admin").POST("/admin/esports/tournaments/{id}/submit", { params: id(tid) })),
  cancel: async (tid: string, reason: string, stepUpToken: string) =>
    unwrap(await api("admin").POST("/admin/esports/tournaments/{id}/cancel", { params: { ...id(tid), header: { "x-step-up": stepUpToken } }, body: { reason } })),
  streams: async (tid: string, streams: { platform: "youtube" | "facebook" | "tiktok" | "other"; url: string; title: string; isLive: boolean }[]) =>
    unwrap(await api("admin").PUT("/admin/esports/tournaments/{id}/streams", { params: id(tid), body: { streams } })),
  board: async (tid: string) => unwrap(await api("admin").GET("/admin/esports/tournaments/{id}/checkins", { params: id(tid) })),
  preview: async (tid: string) => unwrap(await api("admin").GET("/admin/esports/tournaments/{id}/finalise-preview", { params: id(tid) })),
  finalise: async (tid: string, stepUpToken: string) => unwrap(await api("admin").POST("/admin/esports/tournaments/{id}/finalise", { params: { ...id(tid), header: { "x-step-up": stepUpToken } } })),
  staffCheckIn: async (regId: string, userId: string) => unwrap(await api("admin").POST("/admin/esports/registrations/{id}/check-in", { params: id(regId), body: { userId } })),
  disqualify: async (regId: string, body: { reasonCode: "cheating" | "uid_mismatch" | "account_sharing" | "no_show_abuse" | "abuse" | "other"; note: string; userId?: string; banUid?: boolean }) =>
    unwrap(await api("admin").POST("/admin/esports/registrations/{id}/disqualify", { params: id(regId), body: { removeFromStandings: true, banUid: false, ...body } })),
  match: async (mid: string) => unwrap(await api("admin").GET("/admin/esports/matches/{id}", { params: id(mid) })),
  room: async (mid: string) => unwrap(await api("admin").GET("/admin/esports/matches/{id}/room", { params: id(mid) })),
  setRoom: async (mid: string, body: { roomId: string; password: string }) => unwrap(await api("admin").PUT("/admin/esports/matches/{id}/room", { params: id(mid), body })),
  rotate: async (mid: string, body: { roomId: string; password: string; reason?: string }) => unwrap(await api("admin").POST("/admin/esports/matches/{id}/room/rotate", { params: id(mid), body })),
  revealNow: async (mid: string) => unwrap(await api("admin").POST("/admin/esports/matches/{id}/room/reveal-now", { params: id(mid) })),
  views: async (mid: string) => unwrap(await api("admin").GET("/admin/esports/matches/{id}/room/views", { params: id(mid) })),
  enter: async (mid: string, rows: ResultRow[]) => unwrap(await api("admin").PUT("/admin/esports/matches/{id}/results", { params: id(mid), body: { rows } })),
  post: async (mid: string) => unwrap(await api("admin").POST("/admin/esports/matches/{id}/results/post", { params: id(mid) })),
  cancelMatch: async (mid: string, reason: string) => unwrap(await api("admin").POST("/admin/esports/matches/{id}/cancel", { params: id(mid), body: { reason } })),
  disputes: async () => unwrap(await api("admin").GET("/admin/esports/disputes", { params: { query: { status: "open" } } })),
  resolve: async (did: string, body: { outcome: "rejected" | "corrected"; note: string; rows?: ResultRow[] }) => unwrap(await api("admin").POST("/admin/esports/disputes/{id}/resolve", { params: id(did), body: { rows: [], ...body } })),
  bans: async () => unwrap(await api("admin").GET("/admin/esports/uid-bans", { params: { query: { active: "true" } } })),
  ban: async (body: { gameId: string; uid: string; reasonCode: "cheating" | "hacking" | "account_sharing" | "abuse" | "other"; note: string }) => unwrap(await api("admin").POST("/admin/esports/uid-bans", { body })),
  lift: async (bid: string, reason: string) => unwrap(await api("admin").POST("/admin/esports/uid-bans/{id}/lift", { params: id(bid), body: { reason } })),
  /** A UID screenshot as a Blob, for the Moderation desk (audited on the server). */
  screenshot: async (pid: string) => unwrap(await api("admin").GET("/admin/esports/profiles/{id}/screenshot", { params: id(pid), parseAs: "blob" })) as unknown as Blob,
  catalog: async () => unwrap(await api("admin").GET("/esports/games")),
};

