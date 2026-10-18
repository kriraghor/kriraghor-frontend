import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { unwrap } from "@/lib/esports";

/**
 * Client for M23 big events: the event list, the cacheable event page bundle, the feed, and the
 * viewer's own follow and votes (kept out of the bundle so it stays cacheable).
 */
export type EventCard = components["schemas"]["EsportsEventCard"];
export type EventBundle = components["schemas"]["EsportsEventBundle"];
export type EventStream = components["schemas"]["EsportsEventStream"];
export type EventPoll = components["schemas"]["EsportsEventPoll"];
export type FeedItem = components["schemas"]["EsportsEventFeedItem"];
export type EventStage = EventBundle["stages"][number];
export type Qualification = EventBundle["qualifications"][number];

export const events = {
  list: async (query: { featured?: "true" | "false"; tournamentId?: string; limit?: number } = {}) => unwrap(await api().GET("/esports/events", { params: { query } })),
  // Revalidate every time (ETag → 304): a room ping must not be answered from the browser cache.
  get: async (slug: string) => unwrap(await api().GET("/esports/events/{slug}", { params: { path: { slug } }, cache: "no-cache" })),
  feed: async (id: string, before?: string) => unwrap(await api().GET("/esports/events/{id}/feed", { params: { path: { id }, query: before ? { before } : {} } })),
  me: async (id: string) => unwrap(await api().GET("/esports/events/{id}/me", { params: { path: { id } } })),
  follow: async (id: string) => unwrap(await api().POST("/esports/events/{id}/follow", { params: { path: { id } } })),
  unfollow: async (id: string) => unwrap(await api().POST("/esports/events/{id}/unfollow", { params: { path: { id } } })),
  vote: async (id: string, pollId: string, optionId: string) => unwrap(await api().POST("/esports/events/{id}/polls/{pollId}/vote", { params: { path: { id, pollId } }, body: { optionId } })),
  mine: async () => unwrap(await api().GET("/me/esports/events")),
};

/** The stream the player opens with: the first live one that embeds, else the first that embeds. */
export function firstStream(streams: EventStream[]): EventStream | null {
  return streams.find((s) => s.isLive && s.embedUrl) ?? streams.find((s) => s.embedUrl) ?? null;
}

/** Facebook's player loads Facebook tracking, so it waits for a click; YouTube (no-cookie) plays inline. */
export const clickToPlay = (s: Pick<EventStream, "platform">) => s.platform === "facebook";

/** A short random delay before re-fetching after a room ping, so a crowd does not hit the API at once. */
export const jitter = (max = 1500, rnd: () => number = Math.random) => Math.floor(rnd() * max);

/** Group qualifications under the final they lead to, best rank first, invites last. */
export function byFinal(items: Qualification[]): Map<string, Qualification[]> {
  const out = new Map<string, Qualification[]>();
  for (const q of [...items].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))) {
    if (!out.has(q.finalTournamentId)) out.set(q.finalTournamentId, []);
    out.get(q.finalTournamentId)!.push(q);
  }
  return out;
}
