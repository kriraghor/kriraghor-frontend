"use client";

import * as RTabs from "@radix-ui/react-tabs";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../cn";

/**
 * Tabs with panels (Radix: arrow keys, Home/End, tab → panel wiring). `variant="pill"` is the
 * segmented look for 2–4 short choices; "line" underlines for page sections.
 */
export function Tabs({ value, onValueChange, defaultValue, label, items, variant = "line", className, listClassName }: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  label: string;
  items: { value: string; label: ReactNode; icon?: ReactNode; content: ReactNode; testId?: string }[];
  variant?: "line" | "pill";
  className?: string;
  listClassName?: string;
}) {
  return (
    <RTabs.Root value={value} defaultValue={defaultValue ?? items[0]?.value} onValueChange={onValueChange} className={className}>
      <RTabs.List aria-label={label} className={cn(variant === "pill" ? "inline-flex w-full gap-1 rounded-control bg-surface-2 p-1" : "flex gap-1 overflow-x-auto border-b border-line", listClassName)}>
        {items.map((it) => (
          <RTabs.Trigger
            key={it.value}
            value={it.value}
            data-testid={it.testId}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap px-3 text-sm font-semibold transition-colors duration-150",
              variant === "pill"
                ? "flex-1 rounded-[9px] text-muted hover:text-ink data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-sm"
                : "-mb-px rounded-none border-b-2 border-transparent text-muted hover:text-ink data-[state=active]:border-brand data-[state=active]:text-ink",
            )}
          >
            {it.icon}
            {it.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {items.map((it) => (
        <RTabs.Content key={it.value} value={it.value} className="pt-5 focus-visible:outline-none">
          {it.content}
        </RTabs.Content>
      ))}
    </RTabs.Root>
  );
}

/**
 * A segmented control for one choice among a few (a radio group): arrow keys move and select,
 * like native radios. Use it for filters and view switches that have no separate panels.
 */
export function SegmentedControl<T extends string>({ value, onChange, options, label, className, size = "md" }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; icon?: ReactNode; testId?: string }[];
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex gap-1 rounded-control bg-surface-2 p-1", className)}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-testid={o.testId}
            onClick={() => onChange(o.value)}
            onKeyDown={onKey(i)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 font-semibold transition-colors duration-150",
              size === "sm" ? "min-h-9 text-sm" : "min-h-10 text-sm",
              on ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
