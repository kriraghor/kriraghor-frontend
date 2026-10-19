import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "./finance";

/**
 * The document panel on the Moderation desk (M02, kind `document`): legal name, DOB, the masked
 * number with the audited reveal, and the audited file viewer. The queue and the decision are M05
 * (lib/admin/moderation). Files are fetched only when a reviewer asks to see one, so each audited
 * view is a real look.
 */
export type Review = components["schemas"]["KycReview"];
export type Reveal = components["schemas"]["KycNidReveal"];

const doc = (id: string) => ({ path: { id } });

export const kyc = {
  get: async (id: string) => unwrap(await api("admin").GET("/admin/kyc/documents/{id}", { params: doc(id) })),
  /** One file as a Blob (audited on the server). */
  file: async (id: string, fileId: string) => {
    const res = await api("admin").GET("/admin/kyc/documents/{id}/files/{fileId}", { params: { path: { id, fileId } }, parseAs: "blob" });
    return unwrap(res) as unknown as Blob;
  },
  reveal: async (id: string, reason: string) => unwrap(await api("admin").POST("/admin/kyc/documents/{id}/reveal-nid", { params: doc(id), body: { reason } })),
};
