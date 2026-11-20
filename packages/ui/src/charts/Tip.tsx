"use client";

import type { ReactNode } from "react";
import { Key } from "./ChartCard";

/**
 * The hover and focus readout: the value leads, the series name follows, each row keyed by a short
 * stroke of its colour. Placed over the plot at `x` (px from the plot's left), flipped to the left
 * of the pointer past the middle so it never leaves the card.
 */
export type TipRow = { label: string; value: string; color: string; dashed?: boolean };

export function Tip({ x, width, title, rows, note }: { x: number; width: number; title: string; rows: TipRow[]; note?: ReactNode }) {
  const right = x > width / 2;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute top-0 z-10 min-w-36 max-w-60 rounded-control border border-line bg-surface px-3 py-2 text-sm shadow-lg"
      style={right ? { right: Math.max(0, width - x + 12) } : { left: Math.max(0, x + 12) }}
    >
      <p className="text-xs font-semibold text-muted">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2">
            <Key color={r.color} kind={r.dashed ? "dash" : "line"} />
            <span className="font-bold tabular-nums">{r.value}</span>
            <span className="truncate text-xs text-muted">{r.label}</span>
          </li>
        ))}
      </ul>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

/** The colour of series `i` of `n`: one series takes the panel's own colour, more take the palette. */
export function seriesColor(i: number, n: number, own?: string): string {
  if (own) return own;
  if (n <= 1) return "var(--viz-solo)";
  return `var(--viz-${(i % 6) + 1})`;
}
