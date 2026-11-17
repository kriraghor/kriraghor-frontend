import { api } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { unwrap } from "./manage";

/**
 * M24 §21 desk mode with a PIN (ADR-010): a device at the front desk that does nothing until a person picks
 * their name and types their own 4-digit PIN; then it works as that person, at that gym only, until they lock
 * it or it sits idle. Ending desk mode signs the device out. The API enforces every rule; these helpers only
 * shape the screens (the PIN check below mirrors the server's for instant feedback).
 */
type S = components["schemas"];
export type DeskState = S["GymDeskState"];
export type OpenDesk = Extract<DeskState, { open: true }>;
export type DeskPerson = OpenDesk["people"][number];
export type DeskOverview = S["GymDeskOverview"];
export type MyDeskPins = S["GymMyDeskPins"];

const G = (gymId: string) => ({ params: { path: { gymId } } });

export const desk = {
  /** This device's desk: off, or the gym, who is unlocked until when, and the names for the lock screen. */
  state: async () => unwrap(await api().GET("/manage/desk-mode")),
  open: async (gymId: string) => unwrap(await api().POST("/manage/gyms/{gymId}/desk-mode/open", G(gymId))),
  unlock: async (userId: string, pin: string) => unwrap(await api().POST("/manage/desk-mode/unlock", { body: { userId, pin } })),
  lock: async () => unwrap(await api().POST("/manage/desk-mode/lock")),
  touch: async () => unwrap(await api().POST("/manage/desk-mode/touch")),
  /** Any valid PIN of the gym ends desk mode; the server signs the device out. */
  close: async (userId: string, pin: string) => unwrap(await api().POST("/manage/desk-mode/close", { body: { userId, pin } })),
  myPins: async () => unwrap(await api().GET("/me/gym-desk-pins")),
  setPin: async (gymId: string, pin: string) => unwrap(await api().PUT("/me/gym-desk-pins", { body: { gymId, pin } })),
  overview: async (gymId: string) => unwrap(await api().GET("/manage/gyms/{gymId}/desk", G(gymId))),
  resetPin: async (gymId: string, userId: string) => unwrap(await api().POST("/manage/gyms/{gymId}/desk-pins/{userId}/reset", { params: { path: { gymId, userId } } })),
  end: async (gymId: string) => unwrap(await api().POST("/manage/gyms/{gymId}/desk-mode/end", G(gymId))),
};

export type PinProblem = "format" | "repeat" | "run" | "phone";

/** Why a desk PIN would be refused, or null: the server's rule (M24-FR-134), for feedback while typing. */
export function pinProblem(pin: string, phone?: string | null): PinProblem | null {
  if (!/^\d{4}$/.test(pin)) return "format";
  const d = [...pin].map(Number);
  if (d.every((x) => x === d[0])) return "repeat";
  const step = d[1] - d[0];
  if (Math.abs(step) === 1 && d.every((x, i) => i === 0 || x - d[i - 1] === step)) return "run";
  if (phone && pin === phone.replace(/\D/g, "").slice(-4)) return "phone";
  return null;
}

/** How long until a time, in whole minutes rounded up (for "try again in 12 minutes"); 0 when past. */
export const minutesUntil = (iso: string | null | undefined, now = Date.now()) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 60000)) : 0);

/** At most one touch per this many ms: real input keeps the desk awake without a request per key. */
export const TOUCH_EVERY_MS = 30_000;

/** Should real input at `now` send a touch, given the last one sent? */
export const touchDue = (lastSent: number, now: number) => now - lastSent >= TOUCH_EVERY_MS;
