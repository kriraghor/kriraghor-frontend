"use client";

import { useLayoutEffect } from "react";

/**
 * Typed form text survives a language switch, both ways (tester feedback, 28 Nov 2026).
 *
 * Switching language refreshes the [locale] root layout: the page is rendered again in the other language
 * and the old one is kept hidden (so going back showed the old text, and the new language showed empty
 * fields). Just before the switch, `snapshotForms` saves the fields of the page in view (sessionStorage,
 * this tab only); when the page in the new language mounts or shows again, `useFormCarry` puts the values
 * back through the fields' own input events, so React state follows. Passwords, files, one-time codes,
 * hidden fields and anything marked data-no-carry are never saved.
 */
const KEY = "kg.formCarry";
const MAX_AGE_MS = 60_000;
const SKIP_TYPES = new Set(["password", "file", "hidden", "submit", "button", "reset", "image"]);

type Saved = { k: string; v?: string; c?: boolean };
type Carry = { path: string; at: number; fields: Saved[] };
type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const visible = (el: Element) => {
  const e = el as HTMLElement & { checkVisibility?: () => boolean };
  return e.checkVisibility ? e.checkVisibility() : e.offsetParent !== null || e.getClientRects().length > 0;
};

/** The page in view: its <main> (the other language's copy, kept hidden, is skipped). */
function currentMain(): HTMLElement | null {
  return [...document.querySelectorAll("main")].find(visible) ?? null;
}

function carried(el: Field): boolean {
  if (el.closest("[data-no-carry]")) return false;
  if (el instanceof HTMLInputElement && (SKIP_TYPES.has(el.type) || el.autocomplete === "one-time-code")) return false;
  return true;
}

/** Stable keys: the id, else the name (with its place among same-named fields), else the place in the page. */
function keyed(main: HTMLElement): [string, Field][] {
  const all = [...main.querySelectorAll<Field>("input, textarea, select")].filter(carried);
  const names = new Map<string, number>();
  return all.map((el, i) => {
    if (el.id) return [`#${el.id}`, el];
    if (el instanceof HTMLInputElement && el.type === "radio" && el.name) return [`r:${el.name}:${el.value}`, el];
    if (el.name) {
      const n = names.get(el.name) ?? 0;
      names.set(el.name, n + 1);
      return [`n:${el.name}:${n}`, el];
    }
    return [`i:${i}`, el];
  });
}

const isToggle = (el: Field): el is HTMLInputElement => el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio");

/** Saves the fields of the page in view. Called by the language switch just before it refreshes. */
export function snapshotForms(): void {
  try {
    const main = currentMain();
    if (!main) return;
    const fields: Saved[] = keyed(main).map(([k, el]) => (isToggle(el) ? { k, c: el.checked } : { k, v: el.value }));
    const carry: Carry = { path: location.pathname + location.search, at: Date.now(), fields };
    sessionStorage.setItem(KEY, JSON.stringify(carry));
  } catch {
    /* storage blocked: the switch still works, the text is just not carried */
  }
}

/** Sets a field the way typing would, so a controlled React input updates its state. */
function setField(el: Field, s: Saved): boolean {
  if (isToggle(el)) {
    if (s.c === undefined || el.checked === s.c) return true;
    el.click();
    return true;
  }
  if (s.v === undefined) return true;
  if (el.value === s.v) return true;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, s.v);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  return true;
}

function read(): Carry | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Carry;
    if (c.path !== location.pathname + location.search || Date.now() - c.at > MAX_AGE_MS) return null;
    return c;
  } catch {
    return null;
  }
}

/**
 * Puts the saved fields back on the page in view. Forms that load their data a moment later are caught by
 * retrying for a few seconds; it stops at once when the visitor types (their input wins).
 */
export function restoreForms(opts: { tries?: number; everyMs?: number } = {}): () => void {
  const carry = read();
  if (!carry) return () => undefined;
  const pending = new Map(carry.fields.map((f) => [f.k, f]));
  let tries = opts.tries ?? 24;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const cancel = () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    document.removeEventListener("input", onUser, true);
  };
  // Done (or the visitor typed): the saved text is used up. Unmounting only cancels, because the page left
  // behind is hidden in the same commit that mounts the new one, and must not drop the text it is about to get.
  const stop = () => {
    cancel();
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  };
  const onUser = (e: Event) => {
    if (e.isTrusted) stop();
  };
  const pass = () => {
    if (stopped) return;
    const main = currentMain();
    if (main) {
      for (const [k, el] of keyed(main)) {
        const s = pending.get(k);
        if (s && setField(el, s)) pending.delete(k);
      }
    }
    tries -= 1;
    if (pending.size === 0 || tries <= 0) return stop();
    timer = setTimeout(pass, opts.everyMs ?? 150);
  };
  document.addEventListener("input", onUser, true);
  pass();
  return cancel;
}

/** Mounted once per page tree (Providers): restores after a language switch, in either direction. */
export function useFormCarry() {
  useLayoutEffect(() => restoreForms(), []);
}
