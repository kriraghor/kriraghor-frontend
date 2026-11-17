"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@kriraghor/api-client";
import { problemOf } from "@kriraghor/api-client";
import * as db from "@/lib/desk-db";
import { deskOffline, isNetworkError, maySend, sendVerdict, type HeldCopy, type ServerOfflineItem, type Taker, type WaitingItem } from "@/lib/desk-offline";
import type { EffectiveDesk } from "../desk/deskLocal";

/**
 * M24 §22: the connection as the desk sees it, the desk copy, and the items waiting on this device.
 * "Offline" means the browser says so or the last request of the desk never reached the server; the next
 * request that does, or the browser's `online` event, clears it.
 */
let down = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Each desk request tells how it went: reached the server (true) or not (false). */
export function reportNetwork(ok: boolean) {
  if (down === !ok) return;
  down = !ok;
  notify();
}

function subscribeConnection(l: () => void) {
  listeners.add(l);
  const on = () => {
    down = false;
    l();
  };
  window.addEventListener("online", on);
  window.addEventListener("offline", l);
  return () => {
    listeners.delete(l);
    window.removeEventListener("online", on);
    window.removeEventListener("offline", l);
  };
}

/** Is the desk working without a connection? */
export const useOffline = () => useSyncExternalStore(subscribeConnection, () => down || navigator.onLine === false, () => false);

/** Run a desk request and report whether it reached the server. */
export async function reaching<T>(run: () => Promise<T>): Promise<T> {
  try {
    const r = await run();
    reportNetwork(true);
    return r;
  } catch (e) {
    reportNetwork(!isNetworkError(e));
    throw e;
  }
}

/**
 * The desk copy of a gym (M24-FR-144), kept in memory while the page is open and fetched again every
 * gym_manage.desk_snapshot_refresh_minutes. `fetch` false only reads the copy already held (another page).
 */
export function useDeskCopy(gymId: string | null, { fetch }: { fetch: boolean }): HeldCopy | null {
  const q = useQuery({
    queryKey: ["desk-copy", gymId],
    enabled: Boolean(gymId) && fetch,
    queryFn: () => reaching(async (): Promise<HeldCopy> => ({ ...(await deskOffline.snapshot(gymId as string)), receivedAt: performance.now() })),
    staleTime: 60_000,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => (query.state.data?.refreshMinutes ?? 10) * 60_000,
  });
  return q.data ?? null;
}

/** The items of a gym waiting on this device, kept current across screens. */
export function useWaiting(gymId: string | null): WaitingItem[] {
  const v = useSyncExternalStore(db.subscribe, db.changeVersion, () => 0);
  const [items, setItems] = useState<{ gymId: string | null; v: number; list: WaitingItem[] }>({ gymId: null, v: -1, list: [] });
  useEffect(() => {
    if (!gymId) return;
    let live = true;
    void db.waiting(gymId).then((list) => live && setItems({ gymId, v, list }));
    return () => {
      live = false;
    };
  }, [gymId, v]);
  return items.gymId === gymId ? items.list : [];
}

export type SendSummary = { sent: ServerOfflineItem[]; refused: number; stopped: "network" | "blocked" | null };
const running = new Map<string, Promise<SendSummary>>();

/**
 * Send a gym's waiting items one by one, as the person signed in (or at the desk). Sent: removed here.
 * No connection, a locked desk or a missing permission: stop and try later. Refused as malformed: kept,
 * with why, until someone removes it. One run per gym at a time.
 */
export function sendWaiting(gymId: string, perms: readonly string[] | null): Promise<SendSummary> {
  const busy = running.get(gymId);
  if (busy) return busy;
  const run = (async (): Promise<SendSummary> => {
    const out: SendSummary = { sent: [], refused: 0, stopped: null };
    for (const item of await db.waiting(gymId)) {
      if (item.problem || !maySend(item, perms)) continue;
      try {
        const r = await deskOffline.send(gymId, item.body);
        reportNetwork(true);
        await db.remove(item.body.clientId);
        out.sent.push(r.item);
      } catch (e) {
        const verdict = sendVerdict(e);
        if (verdict === "wait") {
          reportNetwork(!isNetworkError(e));
          out.stopped = isNetworkError(e) ? "network" : "blocked";
          break;
        }
        out.refused += 1;
        await db.put({ ...item, problem: problemOf(e)?.title ?? "Refused" });
      }
    }
    return out;
  })().finally(() => running.delete(gymId));
  running.set(gymId, run);
  return run;
}

/** The desk as the shell sees it (with the offline view), for screens that take items. */
export const DeskContext = createContext<EffectiveDesk | null>(null);
export const useDeskHere = () => useContext(DeskContext);

/**
 * Who is taking an item now: the person at the desk (desk mode, with the unlock or "PIN checked on the
 * device"), else the person signed in. Null until the signed-in person is known.
 */
export function useTaker(): Taker | null {
  const desk = useDeskHere();
  const me = useQuery({ queryKey: ["me"], queryFn: async () => (await api().GET("/me")).data ?? null, retry: false, staleTime: 60_000 });
  if (desk?.unlocked) return { userId: desk.unlocked.userId, displayName: desk.unlocked.displayName, unlockId: desk.pinOnDevice ? null : desk.unlocked.unlockId || null, pinOnDevice: desk.pinOnDevice };
  const m = me.data as { id?: string; displayName?: string | null; name?: string | null } | null | undefined;
  return m?.id ? { userId: m.id, displayName: m.displayName ?? m.name ?? null } : null;
}
