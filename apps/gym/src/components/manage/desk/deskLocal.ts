"use client";

import type { DeskPerson, OpenDesk } from "@/lib/desk";

/**
 * M24 §22, desk mode without a connection (ADR-010 amendment). Kept in this page's memory only, never in
 * storage: it is gone when the page closes, and the server's rules apply again as soon as it answers.
 *  - Who is at the desk while offline: the person the server last had unlocked, kept awake by real input
 *    for gym_manage.desk_idle_minutes, or someone who unlocked with a PIN checked on this device.
 *  - A PIN can be checked here only for people who unlocked this desk online since this page opened: their
 *    PIN is kept as a PBKDF2 hash with a random salt, in memory. gym_manage.desk_pin_fail_limit wrong PINs
 *    and that person's hash is dropped: they wait for the connection. Items taken under such an unlock are
 *    marked "PIN checked on the device" and always reach the owner's list.
 */
type Verifier = { salt: Uint8Array; hash: string; fails: number };
type Person = { userId: string; displayName: string | null; role: "owner" | "staff"; unlockId: string | null; pinOnDevice: boolean };

const ITERATIONS = 210_000; // PBKDF2-SHA256 work factor for a 4-digit PIN held only in memory.
let deskId: string | null = null;
let verifiers = new Map<string, Verifier>();
let person: Person | null = null;
let until = 0;
let locked = false;
let version = 0;
const listeners = new Set<() => void>();
const notify = () => {
  version += 1;
  listeners.forEach((l) => l());
};

export const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));
export const localVersion = () => version;

/** A different desk (or none): forget everything about the last one. */
export function bindDesk(id: string | null) {
  if (id === deskId) return;
  deskId = id;
  verifiers = new Map();
  person = null;
  until = 0;
  locked = false;
  notify();
}

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function derive(pin: string, salt: Uint8Array, userId: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(`${deskId}:${userId}:${pin}`), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: ITERATIONS }, key, 256));
}

/** After a PIN the server accepted: remember it (as a hash) so it can be checked here without a connection. */
export async function rememberPin(id: string, userId: string, pin: string) {
  if (id !== deskId || typeof crypto?.subtle === "undefined") return;
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    verifiers.set(userId, { salt, hash: await derive(pin, salt, userId), fails: 0 });
  } catch {
    // Without Web Crypto the desk simply cannot unlock offline.
  }
}

export const canCheckOffline = (userId: string) => verifiers.has(userId);

/** Check a PIN without the server: ok, wrong (tries left), or unknown (this person has to wait for the connection). */
export async function checkPinOffline(userId: string, pin: string, failLimit: number): Promise<{ result: "ok" } | { result: "wrong"; left: number } | { result: "unknown" }> {
  const v = verifiers.get(userId);
  if (!v) return { result: "unknown" };
  if ((await derive(pin, v.salt, userId)) === v.hash) {
    v.fails = 0;
    return { result: "ok" };
  }
  v.fails += 1;
  const left = Math.max(0, failLimit - v.fails);
  if (left === 0) verifiers.delete(userId);
  return { result: "wrong", left };
}

/** Unlocked with a PIN checked on this device. */
export function unlockOffline(p: DeskPerson, idleMinutes: number) {
  person = { userId: p.userId, displayName: p.displayName, role: p.role, unlockId: null, pinOnDevice: true };
  until = Date.now() + idleMinutes * 60000;
  locked = false;
  notify();
}

/** Real input at the desk: whoever is unlocked stays so for another idle period (online the server also hears it). */
export function noteInput(idleMinutes: number) {
  until = Date.now() + idleMinutes * 60000;
}

/** Lock now, without the server. */
export function lockOffline() {
  person = null;
  until = 0;
  locked = true;
  notify();
}

/** The server answers again: its state is the truth; the PIN hashes stay for the next time. */
export function backOnline() {
  if (!person && !locked && !until) return;
  person = null;
  until = 0;
  locked = false;
  notify();
}

/** The desk as this device sees it while offline: the server's state with who is at the desk now, or locked. */
export type EffectiveDesk = OpenDesk & { offline: boolean; pinOnDevice: boolean };
export function offlineView(server: OpenDesk, now = Date.now()): EffectiveDesk {
  if (person) {
    const live = until > now;
    return { ...server, offline: true, pinOnDevice: live && person.pinOnDevice, unlocked: live ? { userId: person.userId, unlockId: person.unlockId ?? "", displayName: person.displayName, role: person.role, expiresAt: new Date(until).toISOString() } : null };
  }
  const u = server.unlocked;
  const end = u ? Math.max(Date.parse(u.expiresAt), until) : 0;
  return { ...server, offline: true, pinOnDevice: false, unlocked: !locked && u && end > now ? { ...u, expiresAt: new Date(end).toISOString() } : null };
}
