"use client";

import type { ReactNode } from "react";

/**
 * M19 dashboard pieces on the design tokens (sharp corners, brand accent): KpiTile with a delta and a
 * sparkline, and four small charts (line, bars, rank, split). Plain SVG, no chart library; every chart
 * also renders its numbers as a visually hidden table for screen readers.
 */
export type Delta = { value: number | null; kind: "pct" | "pts" };

export function DeltaBadge({ value, kind, label }: Delta & { label: string }) {
  // Nothing to compare (no previous data): show no badge rather than a bare label.
  if (value === null || value === undefined) return null;
  const up = value > 0;
  const tone = value === 0 ? "text-muted" : up ? "text-brand" : "text-danger";
  return (
    <span className={`text-xs font-bold tabular-nums ${tone}`}>
      {up ? "▲" : value < 0 ? "▼" : "●"} {Math.abs(value)}
      {kind === "pct" ? "%" : " pts"} <span className="font-normal text-muted">{label}</span>
    </span>
  );
}

export function Sparkline({ points, label }: { points: (number | null)[]; label: string }) {
  const vals = points.map((p) => p ?? 0);
  const max = Math.max(1, ...vals);
  const w = 120;
  const hgt = 32;
  const step = vals.length > 1 ? w / (vals.length - 1) : w;
  const d = vals.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(hgt - (v / max) * (hgt - 4) - 2).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${hgt}`} className="h-8 w-full text-brand" role="img" aria-label={label} preserveAspectRatio="none">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function KpiTile({ label, value, delta, spark, note, help, testId }: { label: string; value: ReactNode; delta?: ReactNode; spark?: (number | null)[] | null; note?: string | null; help?: string; testId?: string }) {
  // Two tiles share a row on phones (390px), so the padding and the figure shrink there.
  return (
    <div className="flex min-w-0 flex-col gap-1 glass-card p-4 sm:p-5" data-testid={testId}>
      <p className="text-sm font-semibold text-muted" title={help}>
        {label}
      </p>
      <p className="break-words font-display text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
      {delta}
      {note ? <p className="text-xs text-muted">{note}</p> : null}
      {spark ? <Sparkline points={spark} label={label} /> : null}
    </div>
  );
}

// sr-only sits on a wrapping div: a table ignores the 1px height and overflow, so its rows would still
// lengthen the page (24 rows under the busiest-hours chart).
function SrTable({ caption, rows }: { caption: string; rows: [string, string][] }) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th scope="row">{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A line per bucket, optionally with a second, dashed series (last year, or a second count) and a
 * legend naming both. The axis labels are HTML so they stay legible at phone width; with more than
 * seven points every other label is left out on phones.
 */
export function ChartLine({
  title,
  points,
  compare,
  format,
  labelOf,
  legend,
}: {
  title: string;
  points: { key: string; value: number }[];
  compare?: number[] | null;
  format: (n: number) => string;
  labelOf: (key: string) => string;
  legend?: { current: string; compare?: string };
}) {
  const w = 600;
  const hgt = 160;
  const max = Math.max(1, ...points.map((p) => p.value), ...(compare ?? []));
  const pad = 28; // room for the first and last axis labels
  const step = points.length > 1 ? (w - 2 * pad) / (points.length - 1) : w;
  const x = (i: number) => (points.length > 1 ? pad + i * step : w / 2);
  const y = (v: number) => hgt - 8 - (v / max) * (hgt - 20);
  const path = (vals: number[]) => vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const many = points.length > 7;
  const rows: [string, string][] = points.map((p, i) => [labelOf(p.key), compare && legend?.compare ? `${format(p.value)} (${legend.compare}: ${format(compare[i] ?? 0)})` : format(p.value)]);
  return (
    <figure className="min-w-0 glass-card p-4">
      <figcaption className="font-bold">{title}</figcaption>
      {legend ? (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-hidden="true">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-brand" />
            {legend.current}
          </span>
          {compare && legend.compare ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-muted" />
              {legend.compare}
            </span>
          ) : null}
        </div>
      ) : null}
      <svg viewBox={`0 0 ${w} ${hgt}`} preserveAspectRatio="none" className="mt-2 h-40 w-full" aria-hidden="true">
        {compare ? <path d={path(compare)} fill="none" stroke="var(--color-muted)" strokeDasharray="4 4" strokeWidth="2" vectorEffect="non-scaling-stroke" /> : null}
        <path d={path(points.map((p) => p.value))} fill="none" stroke="var(--color-brand)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="relative mt-1 h-4" aria-hidden="true">
        {points.map((p, i) => (
          <span key={p.key} className={`absolute top-0 -translate-x-1/2 whitespace-nowrap text-[11px] text-muted ${many && i % 2 ? "hidden sm:block" : ""}`} style={{ left: `${(x(i) / w) * 100}%` }}>
            {labelOf(p.key)}
          </span>
        ))}
      </div>
      <SrTable caption={title} rows={rows} />
    </figure>
  );
}

/**
 * Bars with a label under each. `tick` replaces the label under the bar ("" shows none; the full
 * label stays in the hover title and the screen-reader table), and `values: false` leaves out the
 * figures above the bars: both for many narrow bars (24 hours, 30 days) on a phone.
 */
export function ChartBars({ title, bars, format, values = true }: { title: string; bars: { label: string; value: number; tick?: string }[]; format: (n: number) => string; values?: boolean }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <figure className="min-w-0 glass-card p-4">
      <figcaption className="font-bold">{title}</figcaption>
      <div className={`mt-3 flex h-40 items-end ${bars.length > 12 ? "gap-px sm:gap-0.5" : "gap-1"}`} aria-hidden="true">
        {bars.map((b) => (
          <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${b.label}: ${format(b.value)}`}>
            {values ? <span className="text-[11px] tabular-nums text-muted">{b.value ? format(b.value) : ""}</span> : null}
            <span className="w-full bg-brand" style={{ height: `${Math.max(2, (b.value / max) * 120)}px` }} />
            <span className={`h-4 text-[11px] text-muted ${b.tick === undefined ? "max-w-full truncate" : "whitespace-nowrap"}`}>{b.tick ?? b.label}</span>
          </div>
        ))}
      </div>
      <SrTable caption={title} rows={bars.map((b) => [b.label, format(b.value)])} />
    </figure>
  );
}

export function ChartRank({ title, items, format, empty }: { title: string; items: { label: string; value: number }[]; format: (n: number) => string; empty: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <figure className="min-w-0 glass-card p-4">
      <figcaption className="font-bold">{title}</figcaption>
      {items.length ? (
        <ol className="mt-3 space-y-2">
          {items.map((i) => (
            <li key={i.label} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-2 text-sm">
              <span className="truncate">{i.label}</span>
              <span className="h-3 bg-brand" style={{ width: `${(i.value / max) * 100}%` }} aria-hidden="true" />
              <span className="tabular-nums">{format(i.value)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      )}
    </figure>
  );
}

const SPLIT = ["var(--color-brand)", "#d97706", "#2563eb", "#7c3aed", "#0891b2", "#64748b"];

export function ChartSplit({ title, parts, format, empty }: { title: string; parts: { label: string; value: number }[]; format: (n: number) => string; empty: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  return (
    <figure className="min-w-0 glass-card p-4">
      <figcaption className="font-bold">{title}</figcaption>
      {total > 0 ? (
        <>
          <div className="mt-3 flex h-4 w-full overflow-hidden" aria-hidden="true">
            {parts.map((p, i) => (
              <span key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: SPLIT[i % SPLIT.length] }} />
            ))}
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {parts.map((p, i) => (
              <li key={p.label} className="flex items-center gap-2">
                <span className="h-3 w-3 shrink-0" style={{ background: SPLIT[i % SPLIT.length] }} aria-hidden="true" />
                <span className="flex-1 truncate">{p.label}</span>
                <span className="tabular-nums">{format(p.value)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      )}
    </figure>
  );
}
