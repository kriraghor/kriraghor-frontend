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
  /**
   * Current NID documents whose holder is under kyc.min_age_years today in Dhaka (M02 §6.3, 25 Oct
   * 2026; approve_documents). Ages only. Every view is audited, so it is fetched only when the
   * Users desk's "Under 18 with NID" view is open.
   */
  underMinAge: async () => unwrap(await api("admin").GET("/admin/kyc/under-min-age")),
};

export type UnderMinAge = components["schemas"]["KycUnderMinAge"];
export type UnderMinAgeItem = UnderMinAge["items"][number];

/** "v1, 25 Oct 2026, 14:03" for a recorded consent, null for documents sent before 25 Oct 2026. */
export const consentLine = (consent: Review["consent"], format: (iso: string) => string) => (consent ? `v${consent.version}, ${format(consent.at)}` : null);
