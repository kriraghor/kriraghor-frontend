"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { desk, touchDue, type DeskState } from "@/lib/desk";
import { isNetworkError } from "@/lib/desk-offline";
import { reportNetwork } from "../offline/useOffline";
import { noteInput } from "./deskLocal";

export const DESK_KEY = ["desk-mode"] as const;

/** The problem a desk call answered with, with the fields desk errors carry (tries left, until, scope). */
export type DeskProblem = Problem & { left?: number; until?: string; scope?: "person" | "device"; reason?: string };
export const deskProblem = (e: unknown) => problemOf(e) as DeskProblem | null;

/**
 * This device's desk (M24 §21). Polled while it is open, so a lock by idle time, a PIN reset or the owner
 * ending desk mode elsewhere shows within seconds; a sign-in that is gone reads as "off".
 */
export function useDeskState(enabled: boolean) {
  return useQuery({
    queryKey: DESK_KEY,
    queryFn: async (): Promise<DeskState> => {
      try {
        const s = await desk.state();
        reportNetwork(true);
        return s;
      } catch (e) {
        // No connection (M24 §22): keep the last state; the shell shows the offline view of it.
        if (isNetworkError(e)) reportNetwork(false);
        // Signed out (desk mode ended, or ended elsewhere): no desk on this device any more.
        if (deskProblem(e)?.status === 401) return { open: false };
        throw e;
      }
    },
    enabled,
    retry: false,
    staleTime: 5_000,
    refetchInterval: (q) => (q.state.data?.open ? 20_000 : false),
    refetchOnWindowFocus: true,
  });
}

/**
 * While unlocked: real input (a tap, a key, a scroll) keeps the desk awake, at most one touch per 30 s,
 * and the screen locks when the time runs out. The page refreshing itself never keeps it awake (FR-136).
 * Without a connection the same input keeps it awake on this device (M24 §22, deskLocal).
 */
export function useDeskKeepAlive(unlocked: { userId: string; expiresAt: string } | null, idleMinutes: number) {
  const qc = useQueryClient();
  const lastSent = useRef(0);
  const expiresAt = unlocked?.expiresAt ?? null;
  const userId = unlocked?.userId ?? null;

  useEffect(() => {
    if (!expiresAt) return;
    const onInput = () => {
      noteInput(idleMinutes);
      const now = Date.now();
      if (!touchDue(lastSent.current, now)) return;
      lastSent.current = now;
      desk
        .touch()
        .then((r) => qc.setQueryData<DeskState>(DESK_KEY, (d) => (d && d.open && d.unlocked ? { ...d, unlocked: { ...d.unlocked, expiresAt: r.expiresAt } } : d)))
        .catch((e) => (isNetworkError(e) ? reportNetwork(false) : void qc.invalidateQueries({ queryKey: DESK_KEY })));
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
    // When the time is up, read the desk again: it shows the lock.
    const id = window.setTimeout(() => void qc.invalidateQueries({ queryKey: DESK_KEY }), Math.max(0, new Date(expiresAt).getTime() - Date.now() + 500));
    return () => {
      events.forEach((e) => window.removeEventListener(e, onInput));
      window.clearTimeout(id);
    };
  }, [expiresAt, userId, qc, idleMinutes]);
}

/** A person was unlocked or the desk locked: everything on screen is read again as the new person. */
export function refreshAsNewPerson(qc: ReturnType<typeof useQueryClient>, next: DeskState) {
  qc.setQueryData(DESK_KEY, next);
  void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== DESK_KEY[0] });
}

/** Marks the page while a device is in desk mode, so the site's own header (account, bell) is hidden. */
export function useDeskPageMark(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const html = document.documentElement;
    html.dataset.desk = "on";
    return () => {
      delete html.dataset.desk;
    };
  }, [on]);
}
