import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";

/** /me/player and the public /players/[handle] (never gender, DOB or phone), and adding a phone. */
export type PlayerProfile = components["schemas"]["PlayerProfile"];
export type PublicPlayer = components["schemas"]["PublicPlayer"];
export type Sport = { id: string; key: string; nameEn: string; nameBn: string; positions?: { key: string; en: string; bn: string }[] };

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}

export const players = {
  sports: async () => (await ok(await api().GET("/catalog/sports"))).items as Sport[],
  profile: async () => ok(await api().GET("/me/player-profile")),
  saveProfile: async (body: { sports: { sportKey: string; positions: string[] }[]; bio?: string | null; visibility: "public" | "members" }) => ok(await api().PUT("/me/player-profile", { body })),
  player: async (handle: string) => ok(await api().GET("/players/{handle}", { params: { path: { handle } } })),
  startPhone: async (phone: string) => ok(await api().POST("/me/phone", { body: { phone } })),
  verifyPhone: async (phone: string, code: string) => ok(await api().POST("/me/phone/verify", { body: { phone, code } })),
};

/** Only sports with a positions list can go on a player profile. */
export function sportsWithPositions(sports: Sport[]): Sport[] {
  return sports.filter((s) => (s.positions ?? []).length > 0);
}

/** Adds or removes a position for a sport in the profile being edited (a sport with no positions left stays listed). */
export function togglePosition(sports: { sportKey: string; positions: string[] }[], sportKey: string, position: string) {
  return sports.map((s) => (s.sportKey !== sportKey ? s : { ...s, positions: s.positions.includes(position) ? s.positions.filter((p) => p !== position) : [...s.positions, position] }));
}

export const setUsername = async (username: string) => ok(await api().PUT("/me/username", { body: { username } }));
