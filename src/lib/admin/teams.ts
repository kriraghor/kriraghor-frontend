import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { unwrap } from "./finance";

/**
 * Teams desk client (M16 step 1, admin.kriraghor.com, manage_users):
 * - teams by name, status or sport; one team with its members (NID ✓ only) and masked invites;
 * - archive a team with a reason (an offensive name, a fake team);
 * - correct a member's self-declared gender with a reason (audited; the value is never shown to
 *   captains, organisers or on public pages).
 */
export type StaffTeam = components["schemas"]["AdminTeam"];
export type TeamCard = components["schemas"]["TeamCard"];
export type StaffUser = components["schemas"]["AdminUser"];
export type Gender = "male" | "female" | "third";

export const teamsAdmin = {
  list: async (q: { q?: string; status?: "active" | "archived"; sport?: string }) =>
    unwrap(await api("admin").GET("/admin/teams", { params: { query: { ...(q.q ? { q: q.q } : {}), ...(q.status ? { status: q.status } : {}), ...(q.sport ? { sport: q.sport } : {}) } } })),
  get: async (id: string) => unwrap(await api("admin").GET("/admin/teams/{id}", { params: { path: { id } } })),
  archive: async (id: string, reason: string) => unwrap(await api("admin").POST("/admin/teams/{id}/archive", { params: { path: { id } }, body: { reason } })),
  findUser: async (q: string) => unwrap(await api("admin").GET("/admin/users", { params: { query: { q, limit: 5 } } })),
  correctGender: async (id: string, gender: Gender, reason: string) => unwrap(await api("admin").PUT("/admin/users/{id}/gender", { params: { path: { id } }, body: { gender, reason } })),
};
