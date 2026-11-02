import { useEffect } from "react";
import { api, problemOf, type Problem } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { realtimeSocket } from "@kriraghor/api-client/notifications";

/**
 * Client for M21 (esports.kriraghor.com): tournaments, registration, check-in, the room, results,
 * disputes, winnings, leaderboards; plus live updates over the shared socket (public tournament and
 * match rooms; the user's own room carries the credentials).
 */
export type TournamentCard = components["schemas"]["EsportsTournamentList"]["items"][number];
export type Tournament = components["schemas"]["EsportsTournament"];
export type Registration = components["schemas"]["EsportsRegistration"];
export type Profile = components["schemas"]["EsportsGameProfile"];
export type Squad = components["schemas"]["EsportsSquad"];
export type Room = components["schemas"]["EsportsRoom"];
export type Match = components["schemas"]["EsportsMatch"];
export type Standings = components["schemas"]["EsportsStandings"];
export type Leaderboard = components["schemas"]["EsportsLeaderboard"];
export type Winnings = components["schemas"]["EsportsWinnings"];
export type Organiser = components["schemas"]["PublicOrganiser"];
export type Money = { amount: number; currency: "BDT" };

/** Throw the API problem (RFC 7807) or return the data. */
export function unwrap<T>(res: { data?: T; error?: unknown; response: Response }): T {
  if (res.error !== undefined || res.data === undefined) {
    throw problemOf(res.error) ?? ({ code: "UNKNOWN", title: "Something went wrong", status: res.response.status } satisfies Problem);
  }
  return res.data;
}

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

// ---------------------------------------------------------------- formatting

/** ৳ amounts from poisha, Bangla digits in Bangla. */
export function taka(poisha: number, locale: string): string {
  const n = poisha / 100;
  const fmt = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-IN", { maximumFractionDigits: n % 1 ? 2 : 0 });
  return `৳${fmt.format(n)}`;
}
export const takaOf = (m: Money | undefined | null, locale: string) => (m ? taka(m.amount, locale) : "–");

export function dhakaTime(iso: string | Date | null | undefined, locale: string, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { ...opts, timeZone: "Asia/Dhaka" }).format(new Date(iso));
}

/** Countdown parts until a time (never negative). */
export function countdown(to: string | Date, now: number): { total: number; d: number; h: number; m: number; s: number } {
  const total = Math.max(0, Math.floor((new Date(to).getTime() - now) / 1000));
  return { total, d: Math.floor(total / 86400), h: Math.floor((total % 86400) / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}
export const pad = (n: number) => String(n).padStart(2, "0");

/** What the main button on a tournament says, from its state and the viewer's entry. */
export function ctaFor(t: Pick<TournamentCard, "status" | "slotsTaken" | "maxSlots">, mine: Registration | null): "register" | "waitlist" | "pay" | "view_entry" | "results" | "closed" | "soon" {
  if (mine && ["pending_payment"].includes(mine.status)) return "pay";
  if (mine && ["confirmed", "checked_in", "waitlisted", "offered"].includes(mine.status)) return "view_entry";
  if (["finalised", "paid_out", "results_pending", "live"].includes(t.status)) return "results";
  if (t.status === "scheduled") return "soon";
  if (t.status !== "registration_open") return "closed";
  return t.slotsTaken >= t.maxSlots ? "waitlist" : "register";
}

/** Share of slots taken, 0–100. */
export const fill = (taken: number, max: number) => (max > 0 ? Math.min(100, Math.round((taken / max) * 100)) : 0);

// ---------------------------------------------------------------- API

export const esports = {
  games: async () => unwrap(await api().GET("/esports/games")),
  list: async (query: { q?: string; game?: string; status?: string; featured?: "true" | "false"; cursor?: string; limit?: number }) => unwrap(await api().GET("/esports/tournaments", { params: { query } })),
  get: async (slug: string) => unwrap(await api().GET("/esports/tournaments/{id}", { params: { path: { id: slug } } })),
  standings: async (id: string) => unwrap(await api().GET("/esports/tournaments/{id}/standings", { params: { path: { id } } })),
  match: async (id: string) => unwrap(await api().GET("/esports/matches/{id}", { params: { path: { id } } })),
  leaderboard: async (query: { game: string; scope?: "rolling" | "season"; season?: string }) => unwrap(await api().GET("/esports/leaderboards", { params: { query } })),
  topPlayers: async () => unwrap(await api().GET("/esports/top-players")),
  player: async (handle: string) => unwrap(await api().GET("/esports/players/{handle}", { params: { path: { handle } } })),
  // M22: an organiser's branded page (its branding and public tournaments).
  organiser: async (subdomain: string) => unwrap(await api().GET("/esports/organisers/{subdomain}", { params: { path: { subdomain } } })),

  register: async (id: string, body: { squadId?: string; players: string[]; substitutes?: string[] }) =>
    unwrap(await api().POST("/esports/tournaments/{id}/registrations", { params: { path: { id }, header: { "idempotency-key": newKey() } }, body: { substitutes: [], ...body } })),
  mine: async () => unwrap(await api().GET("/me/esports/registrations")),
  acceptOffer: async (id: string) => unwrap(await api().POST("/me/esports/registrations/{id}/accept-offer", { params: { path: { id }, header: { "idempotency-key": newKey() } } })),
  withdraw: async (id: string) => unwrap(await api().POST("/me/esports/registrations/{id}/withdraw", { params: { path: { id } } })),
  checkIn: async (id: string) => unwrap(await api().POST("/me/esports/registrations/{id}/check-in", { params: { path: { id } } })),
  split: async (id: string, split: { userId: string; pct: number }[]) => unwrap(await api().PUT("/me/esports/registrations/{id}/prize-split", { params: { path: { id } }, body: { split } })),
  room: async (matchId: string) => unwrap(await api().GET("/me/esports/matches/{id}/room", { params: { path: { id: matchId } } })),
  evidence: async (matchId: string, body: { kind: "screenshot" | "video_link"; key?: string; url?: string; note?: string }) =>
    unwrap(await api().POST("/me/esports/matches/{id}/evidence", { params: { path: { id: matchId } }, body })),
  dispute: async (matchId: string, body: { reason: string; evidenceIds?: string[] }) => unwrap(await api().POST("/me/esports/matches/{id}/disputes", { params: { path: { id: matchId } }, body: { evidenceIds: [], ...body } })),

  /** A raw image upload (screenshot); returns the private key to reference. */
  upload: async (file: File) => {
    const res = await api().POST("/me/esports/uploads", { body: file as never, bodySerializer: (b: unknown) => b as BodyInit, headers: { "Content-Type": file.type } });
    return unwrap(res);
  },
  profiles: async () => unwrap(await api().GET("/me/esports/profiles")),
  addProfile: async (body: { gameId: string; uid: string; ign: string; screenshotKey: string }) => unwrap(await api().POST("/me/esports/profiles", { body })),
  unlink: async (id: string) => unwrap(await api().POST("/me/esports/profiles/{id}/unlink", { params: { path: { id } } })),
  squads: async () => unwrap(await api().GET("/me/esports/squads")),
  createSquad: async (body: { gameId: string; name: string; tag: string }) => unwrap(await api().POST("/me/esports/squads", { body })),
  joinSquad: async (code: string) => unwrap(await api().POST("/me/esports/squads/join", { body: { code } })),
  invite: async (id: string, username: string) => unwrap(await api().POST("/me/esports/squads/{id}/invites", { params: { path: { id } }, body: { username } })),
  leave: async (id: string) => unwrap(await api().POST("/me/esports/squads/{id}/leave", { params: { path: { id } } })),
  respond: async (memberId: string, accept: boolean) =>
    accept
      ? unwrap(await api().POST("/me/esports/squad-invites/{id}/accept", { params: { path: { id: memberId } } }))
      : unwrap(await api().POST("/me/esports/squad-invites/{id}/decline", { params: { path: { id: memberId } } })),
  winnings: async () => unwrap(await api().GET("/me/esports/winnings")),
  withdrawWinnings: async () => unwrap(await api().POST("/me/withdrawals", { params: { header: { "idempotency-key": newKey() } } })),
  withdrawals: async () => unwrap(await api().GET("/me/withdrawals")),
};

// ---------------------------------------------------------------- realtime

/**
 * Join a public room (esports_tournament:{id} or esports_match:{id}) while mounted and call `onEvent`
 * for each named event. The socket is shared with the bell; guests connect without a token.
 */
export function useRoom(room: string | null, events: Record<string, (data: unknown) => void>) {
  useEffect(() => {
    if (!room) return undefined;
    const socket = realtimeSocket("api");
    const join = () => socket.emit("subscribe", room);
    if (socket.connected) join();
    socket.on("connect", join);
    const entries = Object.entries(events);
    for (const [name, fn] of entries) socket.on(name, fn);
    return () => {
      socket.emit("unsubscribe", room);
      socket.off("connect", join);
      for (const [name, fn] of entries) socket.off(name, fn);
    };
    // The handlers are stable per room (callers pass inline closures that read refs or setState).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);
}

/** Listen for events on the user's own room (credentials arrive here only). */
export function useUserEvents(events: Record<string, (data: unknown) => void>, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const socket = realtimeSocket("api");
    const entries = Object.entries(events);
    for (const [name, fn] of entries) socket.on(name, fn);
    return () => {
      for (const [name, fn] of entries) socket.off(name, fn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}

/** Back to where the player was going after sign-in: a relative path on this site only. */
export const safeNext = (v: string | null) => (v && v.startsWith("/") && !v.startsWith("//") ? v : "/me");
