import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "../admin/finance";

/**
 * M17 for business owners (vendor.kriraghor.com): disputes about their bookings (give their side, add
 * files) and the reviews of what they own: venues, shops and gyms (reply; FR-34, Round B1). Customer
 * sessions, like the rest of /vendor.
 */
export type PartyCase = components["schemas"]["PartyDispute"];
export type Review = components["schemas"]["Review"];

export const ownerTrust = {
  cases: async (cursor?: string) => unwrap(await api().GET("/me/disputes", { params: { query: { role: "respondent", ...(cursor ? { cursor } : {}) } } })),
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
  /** Published reviews of what I own, newest first (GET /me/reviews?role=owner), optionally one kind or one place. */
  reviews: async (f: { subjectType?: ReviewSubject; subjectId?: string; cursor?: string } = {}) =>
    unwrap(
      await api().GET("/me/reviews", {
        params: { query: { role: "owner", ...(f.subjectType ? { subjectType: f.subjectType } : {}), ...(f.subjectId ? { subjectId: f.subjectId } : {}), ...(f.cursor ? { cursor: f.cursor } : {}) } },
      }),
    ),
  /** M18: my reliability (shown or not yet) and a booker's (only once shown). */
  myTrust: async () => unwrap(await api().GET("/me/trust")),
  trustOf: async (userId: string) => unwrap(await api().GET("/trust/{userId}", { params: { path: { userId } } })),
  reply: async (id: string, text: string) => unwrap(await api().POST("/me/reviews/{id}/reply", { params: { path: { id } }, body: { text } })),
};

/** The file types the API takes (it re-checks the bytes and the size). */
export const EVIDENCE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** The reviewable things a business answers here: venues and shops (pros reply on kriraghor.com/pro, gyms on gym.kriraghor.com/manage). */
export type ReviewSubject = "ground" | "shop" | "gym" | "hire_profile";
export type BusinessSubject = Exclude<ReviewSubject, "hire_profile" | "gym">;
const SUBJECT_OF_ROLE: Record<string, BusinessSubject> = { ground_owner: "ground", shop_owner: "shop" };

/** The review subjects for the business roles held, in sidebar order (an organiser has none). */
export const reviewSubjectsFor = (roles: readonly string[]): BusinessSubject[] => (["ground", "shop"] as const).filter((s) => roles.some((r) => SUBJECT_OF_ROLE[r] === s));

/** Whether the owner has replied: drives the badge and the "Waiting for a reply" filter. */
export const replyState = (r: { reply: { text: string } | null }): "replied" | "awaiting_reply" => (r.reply ? "replied" : "awaiting_reply");

/** A reply is 2 to 1,000 characters after trimming (the API's rule). */
export const replyOk = (text: string) => text.trim().length >= 2 && text.trim().length <= 1000;

/** Reply errors with their own message; anything else reads "failed". */
const REPLY_ERRORS = ["REPLY_HAS_CONTACT", "NOT_OWNER", "REVIEW_STATE", "VALIDATION_FAILED"] as const;
export type ReplyError = (typeof REPLY_ERRORS)[number] | "failed";
export const replyErrorKey = (code: string | null | undefined): ReplyError => ((REPLY_ERRORS as readonly string[]).includes(code ?? "") ? (code as ReplyError) : "failed");

/** The subject's name: the API's subjectName when it sends one, else the owner's own list, else null. */
export function subjectName(r: { subjectId: string; subjectName?: unknown }, names: ReadonlyMap<string, string>): string | null {
  if (typeof r.subjectName === "string" && r.subjectName.trim()) return r.subjectName;
  return names.get(r.subjectId) ?? null;
}
