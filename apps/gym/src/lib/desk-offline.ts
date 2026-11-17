import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "./manage";
import { dhakaToday } from "./gym-manage";

/**
 * M24 §22 the desk through a lost connection (ADR-010 amendment). While it is online the desk keeps a copy of
 * the gym's members (and, with fees.collect, the open dues) in memory, for that day only. Without a
 * connection it finds members in the copy, checks in those the copy lets in, and takes cash for a due in it;
 * each item waits on the device (IndexedDB, lib/desk-db) and is sent one by one when the connection is back.
 * The server applies, flags or parks each one; nothing well formed is refused. These helpers are pure; the
 * screens are in components/manage/offline.
 */
type S = components["schemas"];
export type DeskCopy = S["GymDeskSnapshot"];
export type CopyMember = DeskCopy["members"][number];
export type CopyDue = NonNullable<DeskCopy["dues"]>[number];
export type ServerOfflineItem = S["GymOfflineItem"];
export type OfflineItems = S["GymOfflineItems"];

const G = (gymId: string) => ({ params: { path: { gymId } } });

export const deskOffline = {
  snapshot: async (gymId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/desk/snapshot", G(gymId))),
  send: async (gymId: string, body: SendBody) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/desk/offline-items", { params: { path: { gymId }, header: { "idempotency-key": body.clientId } }, body })),
  list: async (gymId: string, state: "review" | "all" = "review", cursor?: string) =>
    unwrap(await api().GET("/manage/gyms/{gymId}/desk/offline-items", { params: { path: { gymId }, query: { state, ...(cursor ? { cursor } : {}) } } })),
  resolve: async (gymId: string, itemId: string, body: { action: "checked" | "apply" | "returned"; dueId?: string; note?: string }) =>
    unwrap(await api().POST("/manage/gyms/{gymId}/desk/offline-items/{itemId}/resolve", { params: { path: { gymId, itemId } }, body })),
};

/** A copy as the device holds it: the server's copy and the device clock reading when it arrived. */
export type HeldCopy = DeskCopy & { receivedAt: number };

/** How long ago (ms, the device's steady clock) the copy arrived. */
export const elapsedSince = (copy: HeldCopy, nowPerf: number) => Math.max(0, Math.round(nowPerf - copy.receivedAt));

/** The server's time now, as the copy and the device clock tell it. */
export const serverNow = (copy: HeldCopy, nowPerf: number) => new Date(Date.parse(copy.serverTime) + elapsedSince(copy, nowPerf));

/** The copy is good for the Dhaka day it was made only (M24-FR-144). */
export const copyUsable = (copy: HeldCopy | null, nowPerf: number): copy is HeldCopy => Boolean(copy) && dhakaToday(serverNow(copy as HeldCopy, nowPerf)) === (copy as HeldCopy).date;

/** Should the copy be fetched again (gym_manage.desk_snapshot_refresh_minutes)? */
export const copyStale = (copy: HeldCopy | null, nowPerf: number) => !copy || elapsedSince(copy, nowPerf) >= copy.refreshMinutes * 60000;

const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const MEMBER_TOKEN = /^v1\.gm\.([0-9a-f-]{36})\.\d{1,12}\.[0-9a-f]{32}$/i;

/**
 * Find members in the copy (M24-FR-145): a member QR (read without the server, so not checked), the member
 * code, the last four digits of the phone, or part of the name. At most `limit`, codes and QR first.
 */
export function searchCopy(copy: DeskCopy, q: string, limit = 10): CopyMember[] {
  const text = q.trim();
  if (!text) return [];
  const qr = MEMBER_TOKEN.exec(text);
  if (qr) return copy.members.filter((m) => m.id === qr[1].toLowerCase());
  const code = text.toUpperCase();
  const exact = copy.members.filter((m) => m.memberCode === code);
  if (exact.length) return exact;
  const digits = text.replace(/\D/g, "");
  if (digits.length >= 4 && digits.length === text.replace(/[\s-]/g, "").length) {
    return copy.members.filter((m) => m.phoneLast4 && m.phoneLast4 === digits.slice(-4)).slice(0, limit);
  }
  const needle = fold(text);
  return copy.members.filter((m) => fold(m.displayName).includes(needle) || m.memberCode.startsWith(code)).slice(0, limit);
}

/** Is `token` a member QR, and whose? (read offline, so the signature is not checked). */
export const memberOfToken = (token: string) => MEMBER_TOKEN.exec(token.trim())?.[1].toLowerCase() ?? null;

/** What the desk may do offline for a member: check in (allow or warn), or not (block waits for the connection). */
export const offlineEntry = (m: CopyMember): "checkIn" | "checkInWarn" | "blocked" => (m.decision === "block" ? "blocked" : m.decision === "warn" ? "checkInWarn" : "checkIn");

/** A temporary slip number for cash taken offline (M24-FR-148): T- and six letters or digits, easy to read aloud. */
export function newSlipNo(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return `T-${[...random(6)].map((b) => ALPHABET[b % ALPHABET.length]).join("")}`;
}

/** The item as it waits on the device; `body` is exactly what will be sent. */
export type SendBody = {
  clientId: string;
  kind: "checkin" | "cash_fee";
  memberId: string;
  method?: "desk" | "member_qr";
  dueId?: string;
  amountPoisha?: number;
  slipNo?: string;
  stamp: string;
  elapsedMs: number;
  takenBy: string;
  unlockId?: string | null;
  pinOnDevice?: boolean;
};
export type WaitingItem = {
  gymId: string;
  body: SendBody;
  /** For the screens: whose, and when the device took it. */
  member: { displayName: string; memberCode: string };
  dueTitle?: string | null;
  takenByName: string | null;
  takenAtIso: string;
  /** Set when the server refused it as malformed (it stays until someone removes it). */
  problem?: string | null;
};

/** Who is taking an item: the person at the desk, and how the device knows them. */
export type Taker = { userId: string; displayName: string | null; unlockId?: string | null; pinOnDevice?: boolean };

/** A new item taken now under the copy. */
export function newItem(input: {
  copy: HeldCopy;
  nowPerf: number;
  kind: "checkin" | "cash_fee";
  member: CopyMember;
  taker: Taker;
  method?: "desk" | "member_qr";
  due?: CopyDue;
  amountPoisha?: number;
  slipNo?: string;
  clientId?: string;
}): WaitingItem {
  const { copy, nowPerf, kind, member, taker } = input;
  const body: SendBody = {
    clientId: input.clientId ?? crypto.randomUUID(),
    kind,
    memberId: member.id,
    stamp: copy.stamp,
    elapsedMs: elapsedSince(copy, nowPerf),
    takenBy: taker.userId,
    unlockId: taker.unlockId ?? null,
    pinOnDevice: Boolean(taker.pinOnDevice),
    ...(kind === "checkin" ? { method: input.method ?? "desk" } : { dueId: input.due?.id, amountPoisha: input.amountPoisha, slipNo: input.slipNo }),
  };
  return {
    gymId: copy.gymId,
    body,
    member: { displayName: member.displayName, memberCode: member.memberCode },
    dueTitle: input.due?.title ?? null,
    takenByName: taker.displayName,
    takenAtIso: serverNow(copy, nowPerf).toISOString(),
  };
}

/** What is still owed on a due in the copy, after the cash already waiting on this device for it. */
export const dueLeft = (due: CopyDue, waiting: readonly WaitingItem[]) =>
  Math.max(0, due.outstandingPoisha - waiting.filter((w) => w.body.kind === "cash_fee" && w.body.dueId === due.id).reduce((s, w) => s + (w.body.amountPoisha ?? 0), 0));

/** Counts for the banner: check-ins and payments waiting (not the ones the server refused). */
export function waitingCounts(items: readonly WaitingItem[]) {
  const live = items.filter((i) => !i.problem);
  return { checkins: live.filter((i) => i.body.kind === "checkin").length, payments: live.filter((i) => i.body.kind === "cash_fee").length, problems: items.length - live.length };
}

/** What a send attempt answered, for the queue: sent (remove it), wait (try later), refused (keep it, with why). */
export type SendVerdict = "sent" | "wait" | "refused";
export function sendVerdict(error: unknown): SendVerdict {
  if (!error) return "sent";
  if (isNetworkError(error)) return "wait";
  const status = (error as { status?: number }).status ?? 0;
  // Locked desk, signed out, not this person's permission, busy or server trouble: try again later.
  if (status === 0 || status === 401 || status === 403 || status === 409 || status === 423 || status === 429 || status >= 500) return "wait";
  return "refused";
}

/** A request that never reached the server (no connection). */
export const isNetworkError = (e: unknown) => e instanceof TypeError || (e as { name?: string } | null)?.name === "TypeError";

/** May the person send this item (the permission it needs)? null perms = the owner. */
export const maySend = (item: WaitingItem, perms: readonly string[] | null) => perms === null || perms.includes(item.body.kind === "checkin" ? "attendance.mark" : "fees.collect");
