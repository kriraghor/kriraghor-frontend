import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "./finance";

/**
 * The Tournament posts desk (M26-FR-09, approve_listings): the feed of tournaments people post. Posts
 * go live at once, so staff look after them here: remove one with a reason (its author is told) and
 * restore it as it was. Reports on posts and comments reach the Reports desk.
 */
export type PostPage = components["schemas"]["TournamentPostPage"];
export const POST_STATUSES = ["open", "closed", "expired", "removed"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

const post = (id: string) => ({ params: { path: { id } } });

export const tournamentPostsAdmin = {
  list: async (f: { status?: PostStatus; q?: string; cursor?: string }) =>
    unwrap(await api("admin").GET("/admin/tournament-posts", { params: { query: { ...(f.status ? { status: f.status } : {}), ...(f.q ? { q: f.q } : {}), ...(f.cursor ? { cursor: f.cursor } : {}) } } })),
  get: async (id: string) => unwrap(await api("admin").GET("/admin/tournament-posts/{id}", post(id))),
  remove: async (id: string, reason: string) => unwrap(await api("admin").POST("/admin/tournament-posts/{id}/remove", { ...post(id), body: { reason } })),
  restore: async (id: string, reason: string) => unwrap(await api("admin").POST("/admin/tournament-posts/{id}/restore", { ...post(id), body: { reason } })),
};

/** What staff can do with a post: remove anything not already removed, restore what is. */
export const postActions = (status: string): ("remove" | "restore")[] => (status === "removed" ? ["restore"] : ["remove"]);
