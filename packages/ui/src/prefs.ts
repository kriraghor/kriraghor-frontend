"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Small per-browser choices (the sidebar rail, table density): kept in localStorage under `kg.*`,
 * in memory when storage is blocked (private mode, site data off), and shared live between every
 * component and tab that reads the same key. Never for anything that must be kept for sure.
 */

const memory = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();

function stored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The saved value, or the fallback when none is saved or it is not one of `allowed`. */
export function readPref<T extends string>(key: string, fallback: T, allowed?: readonly T[]): T {
  const v = stored(key) ?? memory.get(key) ?? null;
  return v !== null && (!allowed || (allowed as readonly string[]).includes(v)) ? (v as T) : fallback;
}

/** Saves a choice and tells every reader of the key. */
export function writePref(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    memory.delete(key);
  } catch {
    memory.set(key, value); // storage blocked: the choice lasts while the page is open
  }
  listeners.get(key)?.forEach((fn) => fn());
}

function subscribe(key: string, fn: () => void) {
  const set = listeners.get(key) ?? new Set();
  set.add(fn);
  listeners.set(key, set);
  // Another tab changed it (key null: that tab cleared storage).
  const onStorage = (e: StorageEvent) => {
    if (e.key === key || e.key === null) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

/** A saved choice and its setter; the fallback on the server and before hydration. */
export function usePref<T extends string>(key: string, fallback: T, allowed?: readonly T[]): [T, (next: T) => void] {
  const sub = useCallback((fn: () => void) => subscribe(key, fn), [key]);
  const value = useSyncExternalStore(
    sub,
    () => readPref(key, fallback, allowed),
    () => fallback,
  );
  return [value, (next: T) => writePref(key, next)];
}
