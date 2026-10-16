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
