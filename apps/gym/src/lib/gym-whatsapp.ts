import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "./manage";

/**
 * WhatsApp for gyms (21 Nov 2026).
 * Step 1 (M24-FR-157 to FR-159): chat numbers and member consent, no Meta. The owner's number is used by
 * every branch without its own; each branch may hide the button on its page. Members (or the desk, with
 * the member's word) choose receipts and reminders, and news and offers.
 * Step 2 (M24-FR-160 to FR-170): the owner connects WhatsApp Business numbers (Meta embedded sign-up),
 * each branch picks the number it sends from and its automatic messages, units are bought on Billing, and
 * the owner or staff with whatsapp.send send notices, greetings, one-member updates and receipts. All of
 * it stays "coming soon" while the platform switch (`apiEnabled`) is off. The API enforces every rule.
 */
type S = components["schemas"];
const G = (gymId: string) => ({ path: { gymId } });
const GM = (gymId: string, memberId: string) => ({ path: { gymId, memberId } });
const ik = (key: string) => ({ "idempotency-key": key });

export type Consent = { number: string | null; service: boolean; news: boolean };
export type Sender = S["GymWhatsappSender"];
export type Units = S["GymWhatsappUnits"];
export type UnitEntries = S["GymWhatsappEntries"];
export type WaSegment = S["GymWhatsappSegment"];
export type AutoKind = "receipt" | "renewal_due" | "ends_today" | "overdue" | "pay_link";
export const AUTO_KINDS: readonly AutoKind[] = ["receipt", "renewal_due", "ends_today", "overdue", "pay_link"];
export type BulkKind = "notice" | "greeting";
export type SendBody = { kind: "notice"; segment: WaSegment; title: string; message: string } | { kind: "greeting"; segment: WaSegment; message: string } | { kind: "single"; memberId: string; message: string };

export const gymWhatsapp = {
  // step 1: numbers and consent
  owner: async () => unwrap(await api().GET("/manage/whatsapp")),
  setOwnerNumber: async (number: string | null) => unwrap(await api().PUT("/manage/whatsapp/number", { body: { number } })),
  gym: async (gymId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/whatsapp", { params: G(gymId) })),
  setGym: async (gymId: string, body: { number?: string | null; showOnPage?: boolean; senderId?: string | null; autoKinds?: AutoKind[] }) => unwrap(await api().PATCH("/manage/gyms/{gymId}/whatsapp", { params: G(gymId), body })),
  member: async (gymId: string, memberId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/members/{memberId}/whatsapp", { params: GM(gymId, memberId) })),
  setMember: async (gymId: string, memberId: string, body: Consent) => unwrap(await api().PUT("/manage/gyms/{gymId}/members/{memberId}/whatsapp", { params: GM(gymId, memberId), body })),
  mine: async (memberId: string) => unwrap(await api().GET("/me/gym-whatsapp/{memberId}", { params: { path: { memberId } } })),
  setMine: async (memberId: string, body: Consent) => unwrap(await api().PUT("/me/gym-whatsapp/{memberId}", { params: { path: { memberId } }, body })),
  // step 2: senders (owner)
  connect: async (body: { code: string; wabaId: string; phoneNumberId: string }, key: string) => unwrap(await api().POST("/manage/whatsapp/senders", { params: { header: ik(key) }, body })),
  disconnect: async (senderId: string) => unwrap(await api().POST("/manage/whatsapp/senders/{senderId}/disconnect", { params: { path: { senderId } } })),
  // step 2: units on Billing (owner)
  units: async () => unwrap(await api().GET("/manage/billing/whatsapp")),
  setAddon: async (enabled: boolean) => unwrap(await api().PUT("/manage/billing/whatsapp-addon", { body: { enabled } })),
  buyBundles: async (bundles: number, key: string) => unwrap(await api().POST("/manage/billing/whatsapp-bundles", { params: { header: ik(key) }, body: { bundles } })),
  entries: async () => unwrap(await api().GET("/manage/billing/whatsapp-entries")),
  // step 2: sending (owner or whatsapp.send)
  estimate: async (gymId: string, kind: BulkKind, segment: WaSegment) => unwrap(await api().POST("/manage/gyms/{gymId}/whatsapp/estimate", { params: G(gymId), body: { kind, segment } })),
  send: async (gymId: string, body: SendBody, key: string) => unwrap(await api().POST("/manage/gyms/{gymId}/whatsapp/sends", { params: { ...G(gymId), header: ik(key) }, body })),
  sends: async (gymId: string, limit = 30) => unwrap(await api().GET("/manage/gyms/{gymId}/whatsapp/sends", { params: { ...G(gymId), query: { limit } } })),
  messages: async (gymId: string, memberId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/whatsapp/messages", { params: { ...G(gymId), query: { memberId } } })),
  sendReceipt: async (gymId: string, feePaymentId: string) => unwrap(await api().POST("/manage/gyms/{gymId}/fee-payments/{feePaymentId}/whatsapp", { params: { path: { gymId, feePaymentId } } })),
};

export type GymWhatsapp = Awaited<ReturnType<typeof gymWhatsapp.gym>>;
export type OwnerWhatsapp = Awaited<ReturnType<typeof gymWhatsapp.owner>>;
export type MemberWhatsapp = Awaited<ReturnType<typeof gymWhatsapp.member>>;
export type MyWhatsapp = Awaited<ReturnType<typeof gymWhatsapp.mine>>;
export type Estimate = Awaited<ReturnType<typeof gymWhatsapp.estimate>>;
export type Send = Awaited<ReturnType<typeof gymWhatsapp.send>>;
export type WaMessage = Awaited<ReturnType<typeof gymWhatsapp.messages>>["items"][number];
/** The API types `sender` as an intersection with null; it is a sender or null. */
export const senderOf = (w: { sender: unknown }) => (w.sender ?? null) as Sender | null;
