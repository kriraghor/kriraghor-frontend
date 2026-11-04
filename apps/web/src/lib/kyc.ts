import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";

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

/** The consent sent with a document (M02-FR-05, 25 Oct 2026): the version of the text the member ticked. */
export const consentBody = (version: number) => ({ accepted: true as const, version });

export const submitNid = async (fields: { legalName: string; number: string; dob: string }, files: Record<Slot, string>, consentVersion: number) =>
  ok(await api().POST("/me/documents", { body: { docType: "nid", fields, files, consent: consentBody(consentVersion) } }));

/**
 * The NID form's gate: all three files uploaded, a legal name, a valid number, a date of birth not
 * after the latest allowed one (18+), and the consent ticked with a version from the API. The
 * server re-checks everything.
 */
export function canSubmitNid(s: { files: Partial<Record<Slot, string | null>>; legalName: string; number: string; dob: string; maxDob: string; consented: boolean; consentVersion: number | null | undefined }): boolean {
  return (
    SLOTS.every((slot) => Boolean(s.files[slot])) &&
    s.legalName.trim().length >= 3 &&
    nidLooksValid(s.number) &&
    /^\d{4}-\d{2}-\d{2}$/.test(s.dob) &&
    s.dob <= s.maxDob &&
    consentReady(s.consented, s.consentVersion)
  );
}

/** The consent gate shared by the NID and business forms: ticked, and a version from the API to send. */
export const consentReady = (consented: boolean, version: number | null | undefined): version is number => consented && typeof version === "number" && Number.isInteger(version) && version > 0;

/** Mirrors the server: digits only (spaces and dashes ignored), 10, 13 or 17 long. */
export function nidLooksValid(input: string): boolean {
  const digits = input.replace(/[\s-]/g, "");
  return /^\d+$/.test(digits) && [10, 13, 17].includes(digits.length);
}

/**
 * Problem codes of POST /me/documents (M02-FR-05, the 18+ age check §6.3 and the versioned consent
 * of 25 Oct 2026) that have their own text, as keys under the "kyc" namespace ("error.<CODE>").
 * Anything else shows the server's own title.
 */
const KYC_ERRORS = [
  "UNDER_MIN_AGE",
  "CONSENT_REQUIRED",
  "CONSENT_VERSION_STALE",
  "DOB_IN_FUTURE",
  "DOB_INVALID",
  "NID_FORMAT_INVALID",
  "FILES_INCOMPLETE",
  "PHONE_REQUIRED",
  "DOC_ALREADY_APPROVED",
  "MEMBER_NOT_ACTIVE",
] as const;
export type KycErrorCode = (typeof KYC_ERRORS)[number];

/** "error.UNDER_MIN_AGE" for a known code (translate with useTranslations("kyc")), otherwise null. */
export const kycErrorKey = (code: string | undefined | null): `error.${KycErrorCode}` | null =>
  code && (KYC_ERRORS as readonly string[]).includes(code) ? (`error.${code}` as `error.${KycErrorCode}`) : null;

/**
 * The text of a submit problem: our own message for a known code (UNDER_MIN_AGE carries the
 * server's minimum age, `minAge`, falling back to `minAge` from the page), else the server's title.
 */
export function kycErrorText(
  problem: { code?: string | null; title?: string | null; minAge?: unknown },
  t: (key: `error.${KycErrorCode}`, values?: Record<string, string | number>) => string,
  opts: { minAge?: number; fallback?: string } = {},
): string {
  const key = kycErrorKey(problem.code);
  if (key) {
    const age = typeof problem.minAge === "number" ? problem.minAge : (opts.minAge ?? 18);
    return t(key, { age });
  }
  return problem.title || opts.fallback || "";
}

/** Client-side size and type check before uploading (the server re-checks). */
export function fileProblem(file: File, maxBytes: number): "type" | "size" | null {
  if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) return "type";
  if (file.size > maxBytes) return "size";
  return null;
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// ---------------- business roles (ground owners M09, shop owners M12, players and pros M11, gym owners M20, sports-event organisers M14; documents are kept per role)

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

export const submitBusiness = async (docType: BusinessDocType, fields: Record<string, string | null>, fileId: string, role: BusinessRole, consentVersion: number) =>
  ok(await api().POST("/me/documents", { body: { docType, fields, files: { document: fileId }, consent: consentBody(consentVersion), role } as never }));

/** Fields the server needs that are still empty (the server checks the rest). */
export function missingFields(fields: { key: string; required: boolean }[], values: Record<string, string>): string[] {
  return fields.filter((f) => f.required && !values[f.key]?.trim()).map((f) => f.key);
}
