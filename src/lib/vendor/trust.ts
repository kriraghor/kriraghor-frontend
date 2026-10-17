import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { unwrap } from "../admin/finance";

/**
 * M17 for ground owners (vendor.kriraghor.com): disputes about their bookings (give their side, add
 * files) and the reviews of their grounds (reply). Customer sessions, like the rest of /vendor.
 */
export type PartyCase = components["schemas"]["PartyDispute"];
export type Review = components["schemas"]["Review"];

export const ownerTrust = {
  cases: async () => unwrap(await api().GET("/me/disputes", { params: { query: { role: "respondent" } } })),
  get: async (code: string) => unwrap(await api().GET("/me/disputes/{code}", { params: { path: { code } } })),
  respond: async (code: string, text: string) => unwrap(await api().POST("/me/disputes/{code}/respond", { params: { path: { code } }, body: { text } })),
  statement: async (code: string, text: string) => unwrap(await api().POST("/me/disputes/{code}/statement", { params: { path: { code } }, body: { text } })),
  upload: async (code: string, file: File) =>
    unwrap(
      await api().POST("/me/disputes/{code}/evidence", {
        params: { path: { code } },
        body: file as unknown as string,
        bodySerializer: (b: unknown) => b as BodyInit,
        headers: { "Content-Type": file.type },
      }),
    ),
  openFile: async (code: string, eid: string) => {
    const res = await api().GET("/me/disputes/{code}/evidence/{eid}/file", { params: { path: { code, eid } }, parseAs: "blob" });
    if (res.error || !res.data) throw res.error;
    window.open(URL.createObjectURL(res.data as Blob), "_blank", "noopener");
  },
  reviews: async () => unwrap(await api().GET("/me/ground-reviews", { params: { query: {} } })),
  /** M18: my reliability (shown or not yet) and a booker's (only once shown). */
  myTrust: async () => unwrap(await api().GET("/me/trust")),
  trustOf: async (userId: string) => unwrap(await api().GET("/trust/{userId}", { params: { path: { userId } } })),
  reply: async (id: string, text: string) => unwrap(await api().POST("/me/ground-reviews/{id}/reply", { params: { path: { id } }, body: { text } })),
};

/** The file types the API takes (it re-checks the bytes and the size). */
export const EVIDENCE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
