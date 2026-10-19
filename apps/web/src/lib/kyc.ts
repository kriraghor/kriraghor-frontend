import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

/**
 * Member identity verification (M02 lite): the NID front, back and a selfie holding it, uploaded
 * through the API one file at a time, then submitted with the number, date of birth and legal name.
 * The NID number is only ever shown masked ("•••• 0123").
 */
export type Verification = components["schemas"]["Verification"];
export type VerificationItem = Verification["items"][number];
export type Slot = "front" | "back" | "selfie";
export const SLOTS: Slot[] = ["front", "back", "selfie"];
export const ACCEPT = "image/jpeg,image/png,application/pdf";

async function ok<T>(res: { data?: T; error?: unknown }): Promise<T> {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
}

export const getVerification = async (locale: string) => ok(await api().GET("/me/verification", { params: { query: { locale: locale === "bn" ? "bn" : "en" } } }));

/** Sends the file itself as the request body (the API checks its first bytes). */
export async function uploadFile(slot: Slot, file: File) {
  return ok(
    await api().POST("/me/documents/files", {
      params: { query: { slot } },
      body: file as unknown as string,
      bodySerializer: (b: unknown) => b as BodyInit,
      headers: { "Content-Type": file.type },
    }),
  );
}

export const submitNid = async (fields: { legalName: string; number: string; dob: string }, files: Record<Slot, string>) =>
  ok(await api().POST("/me/documents", { body: { docType: "nid", fields, files, consent: true } }));

/** Mirrors the server: digits only (spaces and dashes ignored), 10, 13 or 17 long. */
export function nidLooksValid(input: string): boolean {
  const digits = input.replace(/[\s-]/g, "");
  return /^\d+$/.test(digits) && [10, 13, 17].includes(digits.length);
}

/** Client-side size and type check before uploading (the server re-checks). */
export function fileProblem(file: File, maxBytes: number): "type" | "size" | null {
  if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) return "type";
  if (file.size > maxBytes) return "size";
  return null;
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// ---------------- business roles (ground owners M09, shop owners M12, players and pros M11, gym owners M20, esports organisers M22; documents are kept per role)

export type BusinessDocType = "trade_license" | "deed_or_lease" | "tin" | "bin" | "credential" | "police_clearance" | "org_registration";
export type BusinessRole = "ground_owner" | "shop_owner" | "gym_owner" | "organiser" | "pro" | "player";
export const BUSINESS_ROLES: BusinessRole[] = ["ground_owner", "shop_owner", "gym_owner", "organiser", "pro", "player"];

/** ?as= on /account/business ↔ the role (ground owner is the default). */
const AS: Record<string, BusinessRole> = { shop: "shop_owner", gym: "gym_owner", organiser: "organiser", pro: "pro", player: "player" };
export const roleFromAs = (as: string | null): BusinessRole => AS[as ?? ""] ?? "ground_owner";
export const asOfRole = (role: BusinessRole) => Object.entries(AS).find(([, r]) => r === role)?.[0] ?? null;
/** Players and pros work from the pro desk on kriraghor.com; owners from vendor.kriraghor.com. */
export const isPerson = (role: BusinessRole) => role === "pro" || role === "player";

/** The checklist of a business role: its documents, their fields and status. */
export const getRoleVerification = async (locale: string, role: BusinessRole) =>
  ok(await api().GET("/me/verification", { params: { query: { locale: locale === "bn" ? "bn" : "en", role } } }));

/** Apply for a business role (then send its documents). */
export const applyForRole = async (role: BusinessRole) => ok(await api().POST("/me/roles", { body: { role } }));

/** One business document file (slot "document"). */
export async function uploadBusinessFile(docType: BusinessDocType, file: File) {
  return ok(
    await api().POST("/me/documents/files", {
      params: { query: { slot: "document", docType } },
      body: file as unknown as string,
      bodySerializer: (b: unknown) => b as BodyInit,
      headers: { "Content-Type": file.type },
    }),
  );
}

export const submitBusiness = async (docType: BusinessDocType, fields: Record<string, string | null>, fileId: string, role: BusinessRole) =>
  ok(await api().POST("/me/documents", { body: { docType, fields, files: { document: fileId }, consent: true, role } as never }));

/** Fields the server needs that are still empty (the server checks the rest). */
export function missingFields(fields: { key: string; required: boolean }[], values: Record<string, string>): string[] {
  return fields.filter((f) => f.required && !values[f.key]?.trim()).map((f) => f.key);
}
