import { api } from "@kriraghor/api-client";
import { unwrap } from "./manage";

/**
 * WhatsApp for gyms, step 1 (M24-FR-157 to FR-159, 21 Nov 2026): chat numbers and member consent, no
 * Meta. The owner's number is used by every branch without its own; each branch may hide the button on
 * its page. Members (or the desk, with the member's word) choose receipts and reminders, and news and
 * offers. Sending from the panel is step 2 and stays off (`apiEnabled`). The API enforces every rule.
 */
const G = (gymId: string) => ({ path: { gymId } });
const GM = (gymId: string, memberId: string) => ({ path: { gymId, memberId } });

export type Consent = { number: string | null; service: boolean; news: boolean };

export const gymWhatsapp = {
  owner: async () => unwrap(await api().GET("/manage/whatsapp")),
  setOwnerNumber: async (number: string | null) => unwrap(await api().PUT("/manage/whatsapp/number", { body: { number } })),
  gym: async (gymId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/whatsapp", { params: G(gymId) })),
  setGym: async (gymId: string, body: { number?: string | null; showOnPage?: boolean }) => unwrap(await api().PATCH("/manage/gyms/{gymId}/whatsapp", { params: G(gymId), body })),
  member: async (gymId: string, memberId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/members/{memberId}/whatsapp", { params: GM(gymId, memberId) })),
  setMember: async (gymId: string, memberId: string, body: Consent) => unwrap(await api().PUT("/manage/gyms/{gymId}/members/{memberId}/whatsapp", { params: GM(gymId, memberId), body })),
  mine: async (memberId: string) => unwrap(await api().GET("/me/gym-whatsapp/{memberId}", { params: { path: { memberId } } })),
  setMine: async (memberId: string, body: Consent) => unwrap(await api().PUT("/me/gym-whatsapp/{memberId}", { params: { path: { memberId } }, body })),
};

export type GymWhatsapp = Awaited<ReturnType<typeof gymWhatsapp.gym>>;
export type MemberWhatsapp = Awaited<ReturnType<typeof gymWhatsapp.member>>;
export type MyWhatsapp = Awaited<ReturnType<typeof gymWhatsapp.mine>>;
