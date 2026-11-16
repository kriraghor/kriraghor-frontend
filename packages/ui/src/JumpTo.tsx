"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import * as RDialog from "@radix-ui/react-dialog";
import { ArrowElbowDownLeft, MagnifyingGlass } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { isExternal } from "@kriraghor/session/links";
import { useRouter } from "./i18n/navigation";
import { cn } from "./cn";
import { Tooltip } from "./kit/Overlay";
import type { ShellItem } from "./shell-parts";

export type JumpItem = Pick<ShellItem, "href" | "label" | "icon"> & { group?: string };

/** Lower case, accents and Bangla vowel signs kept as they are: a plain "contains" on what the person reads. */
const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * The pages that match what was typed: a word that starts the label first, then a word inside it, then
 * the group's name; at most `limit`. Every word typed must appear (in any order).
 */
export function jumpMatches(items: JumpItem[], query: string, limit = 8): JumpItem[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return items.slice(0, limit);
  const scored: { it: JumpItem; score: number; i: number }[] = [];
  items.forEach((it, i) => {
    const label = norm(it.label);
    const group = norm(it.group ?? "");
    let score = 0;
    for (const w of words) {
      if (label.startsWith(w)) score += 3;
      else if (label.split(/\s+/).some((x) => x.startsWith(w))) score += 2;
      else if (label.includes(w)) score += 1;
      else if (group.includes(w)) score += 0.5;
      else return;
    }
    scored.push({ it, score, i });
  });
  return scored
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map((s) => s.it);
}

/** A Mac shows ⌘K, everything else Ctrl K; the server does not know, so it says Ctrl K. */
const noChange = () => () => {};
const onMac = () => /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

/** Ctrl+K (⌘K on a Mac) anywhere. */
const isJumpKey = (e: globalThis.KeyboardEvent) => (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k";

/**
 * "Jump to" (UI v2, the panels): a search over every page in the menu, opened with the button or with
 * Ctrl+K. Arrow keys move, Enter opens, Escape closes. It never hides a page the menu would not show:
 * the items are the menu's own.
 */
export function JumpTo({ items, rail = false, dark = false, compact = false, hotkey = true }: { items: JumpItem[]; rail?: boolean; dark?: boolean; compact?: boolean; hotkey?: boolean }) {
  const t = useTranslations("kit.jump");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => jumpMatches(items, query), [items, query]);
  const mac = useSyncExternalStore(noChange, onMac, () => false);

  // One copy on a page answers Ctrl+K (the shell mounts a second for the phone bar).
  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!isJumpKey(e)) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey]);

  const change = (o: boolean) => {
    setOpen(o);
    if (!o) {
      setQuery("");
      setIndex(0);
    }
  };

  const go = (it: JumpItem | undefined) => {
    if (!it) return;
    change(false);
    if (isExternal(it.href)) window.location.assign(it.href);
    else router.push(it.href);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[index]);
    }
  };

  const shortcut = mac ? "⌘K" : "Ctrl K";
  const trigger = (
    <button
      type="button"
      onClick={() => change(true)}
      aria-keyshortcuts="Control+K Meta+K"
      aria-label={rail || compact ? t("open") : undefined}
      className={cn(
        "flex min-h-11 items-center gap-2.5 rounded-control text-sm font-medium transition-colors",
        rail || compact ? "w-11 justify-center" : "w-full px-3",
        dark ? "bg-band-text/8 text-band-muted hover:bg-band-text/12 hover:text-band-text" : "border border-line bg-surface text-muted hover:border-line-strong hover:text-ink",
      )}
      data-testid="jump-open"
    >
      <MagnifyingGlass size={18} aria-hidden className="shrink-0" />
      {rail || compact ? null : (
        <>
          <span className="flex-1 text-left">{t("open")}</span>
          <kbd className={cn("rounded-[6px] px-1.5 font-sans text-[11px] font-semibold", dark ? "bg-band-text/10" : "bg-surface-2")}>{shortcut}</kbd>
        </>
      )}
    </button>
  );

  return (
    <RDialog.Root open={open} onOpenChange={change}>
      {rail ? (
        <Tooltip content={`${t("open")} (${shortcut})`} side="right">
          {trigger}
        </Tooltip>
      ) : (
        trigger
      )}
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-[kg-fade-in_160ms_ease-out]" />
        <RDialog.Content
          className="fixed left-1/2 top-[12vh] z-50 flex max-h-[70dvh] w-[calc(100vw-32px)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-card border border-line bg-surface shadow-lg focus:outline-none data-[state=open]:animate-[kg-pop-in_200ms_var(--ease-kg)]"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            input.current?.focus();
          }}
          data-testid="jump-dialog"
        >
          <RDialog.Title className="sr-only">{t("open")}</RDialog.Title>
          <RDialog.Description className="sr-only">{t("help")}</RDialog.Description>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <MagnifyingGlass size={20} aria-hidden className="shrink-0 text-muted" />
            <input
              ref={input}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIndex(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={t("placeholder")}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={results[index] ? `${listId}-${index}` : undefined}
              aria-autocomplete="list"
              className="min-h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
              data-testid="jump-input"
            />
            <kbd className="hidden rounded-[6px] bg-surface-2 px-1.5 text-[11px] font-semibold text-muted sm:block">Esc</kbd>
          </div>
          <ul id={listId} role="listbox" aria-label={t("results")} className="min-h-0 flex-1 overflow-y-auto p-2">
            {results.length ? (
              results.map((it, i) => {
                const Icon = it.icon;
                const on = i === index;
                return (
                  <li key={it.href} id={`${listId}-${i}`} role="option" aria-selected={on}>
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseMove={() => setIndex(i)}
                      onClick={() => go(it)}
                      className={cn("flex min-h-12 w-full items-center gap-3 rounded-control px-3 text-left", on ? "bg-brand-soft text-brand-text" : "text-ink")}
                      data-testid="jump-result"
                    >
                      <span className={cn("grid size-9 shrink-0 place-items-center rounded-[10px]", on ? "bg-brand text-on-brand" : "bg-surface-2 text-muted")}>
                        <Icon size={18} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{it.label}</span>
                        {it.group ? <span className="block truncate text-xs text-muted">{it.group}</span> : null}
                      </span>
                      {on ? <ArrowElbowDownLeft size={16} aria-hidden className="shrink-0" /> : null}
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-8 text-center text-sm text-muted" role="presentation">
                {t("none")}
              </li>
            )}
          </ul>
          <p className="border-t border-line px-4 py-2 text-xs text-muted">{t("help")}</p>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
