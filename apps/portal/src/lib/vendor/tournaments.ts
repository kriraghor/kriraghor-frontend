import { api } from "@kriraghor/api-client";

/**
 * The staff Sports events desk on admin.kriraghor.com: how open tournaments get cancelled and refunded
 * before the old backend goes (ADR-008, Phase 3). Nobody organises tournaments on Kriraghor any more.
 */
async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}

export const tournamentsAdmin = {
  list: async (q: { status?: string; q?: string }) => ok(await api("admin").GET("/admin/tournaments", { params: { query: { ...(q.status ? { status: q.status } : {}), ...(q.q ? { q: q.q } : {}) } } })),
  get: async (id: string) => ok(await api("admin").GET("/admin/tournaments/{id}", { params: { path: { id } } })),
  cancel: async (id: string, reason: string, stepUpToken: string) => ok(await api("admin").POST("/admin/tournaments/{id}/cancel", { params: { path: { id }, header: { "x-step-up": stepUpToken } as never }, body: { reason } })),
};
