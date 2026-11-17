import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";

/**
 * Teams and players on kriraghor.com (M16 step 1):
 * - /me/teams: my teams, invites waiting for me, create a team (a verified phone is needed);
 * - /me/teams/[id]: members with the NID ✓ only, invite by phone with a share link (no SMS goes to a
 *   number without an account), roles, hand-over, logo, archive, leave;
 * - /teams/join/[token]: the share link page;
 * - /me/player and the public /players/[handle] (never gender, DOB or phone);
 * - /me/eligibility: readiness, gender (once, private), add a phone.
 */
export type Team = components["schemas"]["Team"];
export type TeamCard = components["schemas"]["TeamCard"];
export type TeamMember = components["schemas"]["TeamMember"];
export type TeamInvite = components["schemas"]["TeamInvite"];
export type MyInvite = components["schemas"]["MyTeamInvite"];
export type InviteLink = components["schemas"]["TeamInviteLink"];
export type PlayerProfile = components["schemas"]["PlayerProfile"];
export type PublicPlayer = components["schemas"]["PublicPlayer"];
export type Eligibility = components["schemas"]["MyEligibility"];
export type Check = Eligibility["readiness"][number];
export type Role = TeamMember["role"];
export type Gender = "male" | "female" | "third";
export type Sport = { id: string; key: string; nameEn: string; nameBn: string; positions?: { key: string; en: string; bn: string }[] };

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}
const path = (id: string) => ({ params: { path: { id } } });

export const teams = {
  sports: async () => (await ok(await api().GET("/catalog/sports"))).items as Sport[],
  mine: async () => ok(await api().GET("/me/teams")),
  create: async (body: { sportKey: string; name: string; shortCode?: string }) => ok(await api().POST("/teams", { body })),
  get: async (id: string) => ok(await api().GET("/teams/{id}", path(id))),
  update: async (id: string, body: { name?: string; shortCode?: string | null }) => ok(await api().PATCH("/teams/{id}", { ...path(id), body })),
  /** Sends the image itself as the request body (the API checks its first bytes). */
  uploadLogo: async (id: string, file: File) =>
    ok(await api().POST("/teams/{id}/logo", { ...path(id), body: file as unknown as string, bodySerializer: (b: unknown) => b as BodyInit, headers: { "Content-Type": file.type } })),
  archive: async (id: string) => ok(await api().POST("/teams/{id}/archive", path(id))),
  leave: async (id: string) => ok(await api().POST("/teams/{id}/leave", path(id))),
  handOver: async (id: string, userId: string) => ok(await api().POST("/teams/{id}/captain", { ...path(id), body: { userId } })),
  remove: async (id: string, userId: string) => ok(await api().POST("/teams/{id}/members/{userId}/remove", { params: { path: { id, userId } } })),
  setMember: async (id: string, userId: string, body: { role?: "vice_captain" | "player"; jerseyNo?: number | null }) =>
    ok(await api().PUT("/teams/{id}/members/{userId}", { params: { path: { id, userId } }, body })),
  invite: async (id: string, phone: string) => ok(await api().POST("/teams/{id}/invites", { ...path(id), body: { phone, role: "player" } })),
  cancelInvite: async (id: string, inviteId: string) => ok(await api().POST("/teams/{id}/invites/{inviteId}/cancel", { params: { path: { id, inviteId } } })),
  resendInvite: async (id: string, inviteId: string) => ok(await api().POST("/teams/{id}/invites/{inviteId}/resend", { params: { path: { id, inviteId } } })),
  myInvites: async () => ok(await api().GET("/me/team-invites")),
  accept: async (id: string) => ok(await api().POST("/me/team-invites/{id}/accept", path(id))),
  decline: async (id: string) => ok(await api().POST("/me/team-invites/{id}/decline", path(id))),
  link: async (token: string) => ok(await api().GET("/team-invites/{token}", { params: { path: { token } } })),
  profile: async () => ok(await api().GET("/me/player-profile")),
  saveProfile: async (body: { sports: { sportKey: string; positions: string[] }[]; bio?: string | null; visibility: "public" | "members" }) => ok(await api().PUT("/me/player-profile", { body })),
  player: async (handle: string) => ok(await api().GET("/players/{handle}", { params: { path: { handle } } })),
  eligibility: async () => ok(await api().GET("/me/eligibility", { params: { query: {} } })),
  setGender: async (gender: Gender) => ok(await api().PUT("/me/gender", { body: { gender } })),
  startPhone: async (phone: string) => ok(await api().POST("/me/phone", { body: { phone } })),
  verifyPhone: async (phone: string, code: string) => ok(await api().POST("/me/phone/verify", { body: { phone, code } })),
};

/** A WhatsApp share of the invite link (the captain sends it; Kriraghor sends no SMS to unknown numbers). The kit's share helper. */
export { whatsappUrl } from "@kriraghor/ui/share/links";

/** Where each readiness fix is done. */
export function fixHref(fix: string | null): string | null {
  if (fix === "add_phone") return "/me/eligibility#phone";
  if (fix === "set_gender") return "/me/eligibility#gender";
  if (fix === "verify_nid") return "/account/verification";
  return null;
}

/** Captain first, then vice-captain, then players by jersey number (no number last), then name. */
export function sortMembers(members: TeamMember[]): TeamMember[] {
  const rank: Record<Role, number> = { captain: 0, vice_captain: 1, player: 2 };
  return [...members].sort((a, b) => rank[a.role] - rank[b.role] || (a.jerseyNo ?? 1000) - (b.jerseyNo ?? 1000) || a.displayName.localeCompare(b.displayName));
}

/** Only sports with a positions list take teams (cricket, football, futsal, basketball, …). */
export function teamSports(sports: Sport[]): Sport[] {
  return sports.filter((s) => (s.positions ?? []).length > 0);
}

/** Adds or removes a position for a sport in the profile being edited (a sport with no positions left stays listed). */
export function togglePosition(sports: { sportKey: string; positions: string[] }[], sportKey: string, position: string) {
  return sports.map((s) => (s.sportKey !== sportKey ? s : { ...s, positions: s.positions.includes(position) ? s.positions.filter((p) => p !== position) : [...s.positions, position] }));
}

export type Tone = "ok" | "warn" | "muted" | "error";
export function checkTone(status: Check["status"]): Tone {
  if (status === "pass") return "ok";
  if (status === "pending") return "warn";
  if (status === "fail") return "error";
  if (status === "missing") return "warn";
  return "muted";
}
export const TONE: Record<Tone, string> = { ok: "border-brand text-brand", warn: "border-warning text-ink", muted: "border-line text-muted", error: "border-danger text-danger" };

export const setUsername = async (username: string) => ok(await api().PUT("/me/username", { body: { username } }));

/** A same-site path to return to after sign-in (never another host, so the link can't redirect away). */
export function safeNext(raw: string | string[] | undefined, fallback = "/me"): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : fallback;
}
