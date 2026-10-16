import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { unwrap } from "./finance";

/**
 * Admin grounds (M09): the list and a ground's working copy for reviewers (approve_listings) and ops
 * (manage_users); suspend (manage_users), restore and remove (masters). Listing decisions are made on
 * the Moderation desk (kind `ground`).
 */
export type StaffGround = components["schemas"]["StaffGround"];
export type StaffGroundRow = components["schemas"]["StaffGroundList"]["items"][number];
type Status = NonNullable<StaffGround["status"]>;
type Action = "suspend" | "restore" | "remove";

export const groundsAdmin = {
  list: async (query: { status?: Status; q?: string }) => unwrap(await api("admin").GET("/admin/grounds", { params: { query: { ...query, limit: 50 } } })),
  get: async (id: string) => unwrap(await api("admin").GET("/admin/grounds/{id}", { params: { path: { id } } })),
  act: async (id: string, action: Action, reason: string) => {
    const path = { suspend: "/admin/grounds/{id}/suspend", restore: "/admin/grounds/{id}/restore", remove: "/admin/grounds/{id}/remove" } as const;
    return unwrap(await api("admin").POST(path[action], { params: { path: { id } }, body: { reason } }));
  },
};

/** The reviewer's diff (submission payload) in plain lines: changed fields, courts and photos. */
export type ReviewDiff = {
  first: boolean;
  fields: { field: string; from: unknown; to: unknown }[];
  courts: { id: string; name: string; change: "added" | "changed" | "retired"; fields?: string[] }[];
  photos: { added: number; removed: number };
};
export function diffLines(d: ReviewDiff | undefined, label: (key: string, vars?: Record<string, string | number>) => string): string[] {
  if (!d) return [];
  if (d.first) return [label("diff.first", { photos: d.photos.added })];
  const show = (v: unknown) => (v === null || v === undefined || v === "" ? "–" : typeof v === "object" ? JSON.stringify(v) : String(v));
  return [
    ...d.fields.map((f) => label("diff.field", { field: f.field, from: show(f.from), to: show(f.to) })),
    ...d.courts.map((c) => label(`diff.court_${c.change}`, { name: c.name, fields: (c.fields ?? []).join(", ") })),
    ...(d.photos.added ? [label("diff.photosAdded", { n: d.photos.added })] : []),
    ...(d.photos.removed ? [label("diff.photosRemoved", { n: d.photos.removed })] : []),
  ];
}
