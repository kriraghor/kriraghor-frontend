"use client";

import { useSyncExternalStore } from "react";

/**
 * True when the viewport is at least `px` wide. Server render and the first client render assume
 * a desktop (`ssr`, default true), then the real width takes over; one layout is rendered at a
 * time, so test ids and focus never point at a hidden copy.
 */
export function useMinWidth(px: number, ssr = true): boolean {
  const query = `(min-width: ${px}px)`;
  return useSyncExternalStore(
    (on) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
      const m = window.matchMedia(query);
      m.addEventListener("change", on);
      return () => m.removeEventListener("change", on);
    },
    () => (typeof window === "undefined" || !window.matchMedia ? ssr : window.matchMedia(query).matches),
    () => ssr,
  );
}

/** Tailwind's md and xl breakpoints, as the kit uses them. */
export const MD = 768;
export const XL = 1280;
