import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "./finance";

/**
 * Admin big events client (M23, manage_esports): events, banner, stages (qualifiers feeding an
 * invite-only final), places (invite, revoke), streams, sponsors, polls and announcements.
 */
export type BigEventCard = components["schemas"]["EsportsEventCard"];
export type BigEvent = components["schemas"]["EsportsEventAdmin"];
export type EventInput = {
  titleEn: string;
  titleBn: string;
  taglineEn?: string | null;
  taglineBn?: string | null;
  aboutMdEn?: string;
  aboutMdBn?: string;
  accentHex?: string;
  startsAt: string;
  endsAt: string;
  featured?: boolean;
};
export type StageInput = { tournamentId: string; role: "qualifier" | "final"; labelEn: string; labelBn: string; qualifyCount?: number; finalTournamentId?: string };
export type StreamInput = { platform: "youtube" | "facebook" | "tiktok"; url: string; title: string; isLive: boolean };

const raw = (file: File) => ({ body: file as never, bodySerializer: (b: unknown) => b as BodyInit, headers: { "Content-Type": file.type } });
const p = (id: string) => ({ params: { path: { id } } });

export const bigEvents = {
  list: async () => unwrap(await api().GET("/admin/esports/events")),
  get: async (id: string) => unwrap(await api().GET("/admin/esports/events/{id}", p(id))),
  create: async (body: EventInput) => unwrap(await api().POST("/admin/esports/events", { body: { aboutMdEn: "", aboutMdBn: "", accentHex: "#f2a33a", featured: false, ...body } })),
  update: async (id: string, body: Partial<EventInput>) => unwrap(await api().PATCH("/admin/esports/events/{id}", { ...p(id), body })),
  banner: async (id: string, file: File) => unwrap(await api().POST("/admin/esports/events/{id}/banner", { ...p(id), ...raw(file) })),
  stages: async (id: string, stages: StageInput[]) => unwrap(await api().PUT("/admin/esports/events/{id}/stages", { ...p(id), body: { stages } })),
  publish: async (id: string) => unwrap(await api().POST("/admin/esports/events/{id}/publish", p(id))),
  cancel: async (id: string, reason: string) => unwrap(await api().POST("/admin/esports/events/{id}/cancel", { ...p(id), body: { reason } })),
  places: async (id: string) => unwrap(await api().GET("/admin/esports/events/{id}/qualifications", p(id))),
  invite: async (id: string, body: { finalTournamentId: string; squadId?: string; userId?: string; reason: string }) => unwrap(await api().POST("/admin/esports/events/{id}/qualifications", { ...p(id), body })),
  revoke: async (id: string, qualificationId: string, reason: string) =>
    unwrap(await api().POST("/admin/esports/events/{id}/qualifications/{qualificationId}/revoke", { params: { path: { id, qualificationId } }, body: { reason } })),
  streams: async (id: string, streams: StreamInput[]) => unwrap(await api().PUT("/admin/esports/events/{id}/streams", { ...p(id), body: { streams } })),
  addSponsor: async (id: string, body: { name: string; tier: "title" | "gold" | "partner"; url?: string | null }) => unwrap(await api().POST("/admin/esports/events/{id}/sponsors", { ...p(id), body })),
  sponsorLogo: async (id: string, sponsorId: string, file: File) => unwrap(await api().POST("/admin/esports/events/{id}/sponsors/{sponsorId}/logo", { params: { path: { id, sponsorId } }, ...raw(file) })),
  removeSponsor: async (id: string, sponsorId: string) => unwrap(await api().POST("/admin/esports/events/{id}/sponsors/{sponsorId}/remove", { params: { path: { id, sponsorId } } })),
  createPoll: async (id: string, body: { questionEn: string; questionBn: string; options: { labelEn: string; labelBn: string }[]; closesAt?: string }) => unwrap(await api().POST("/admin/esports/events/{id}/polls", { ...p(id), body })),
  openPoll: async (id: string, pollId: string) => unwrap(await api().POST("/admin/esports/events/{id}/polls/{pollId}/open", { params: { path: { id, pollId } } })),
  closePoll: async (id: string, pollId: string) => unwrap(await api().POST("/admin/esports/events/{id}/polls/{pollId}/close", { params: { path: { id, pollId } } })),
  announce: async (id: string, body: { textEn: string; textBn: string }) => unwrap(await api().POST("/admin/esports/events/{id}/feed", { ...p(id), body })),
};

/** A Dhaka wall-clock value from the DateTimePicker ("YYYY-MM-DDTHH:MM") as an ISO instant, and back. */
export const dhakaIso = (v: string) => new Date(`${v}:00+06:00`).toISOString();
export const dhakaLocal = (iso: string) => new Date(new Date(iso).getTime() + 6 * 3600000).toISOString().slice(0, 16);

/** Stage rows for the API: qualifiers keep their count and final; finals drop them. Null when a row is unfinished. */
export function stageBody(rows: { tournamentId: string; role: "qualifier" | "final"; labelEn: string; labelBn: string; qualifyCount: string; finalTournamentId: string }[]): StageInput[] | null {
  const out: StageInput[] = [];
  for (const r of rows) {
    if (!r.tournamentId || r.labelEn.trim().length < 2 || r.labelBn.trim().length < 2) return null;
    if (r.role === "final") out.push({ tournamentId: r.tournamentId, role: "final", labelEn: r.labelEn.trim(), labelBn: r.labelBn.trim() });
    else {
      const n = Number(r.qualifyCount);
      if (!Number.isInteger(n) || n < 1 || !r.finalTournamentId) return null;
      out.push({ tournamentId: r.tournamentId, role: "qualifier", labelEn: r.labelEn.trim(), labelBn: r.labelBn.trim(), qualifyCount: n, finalTournamentId: r.finalTournamentId });
    }
  }
  return out;
}
