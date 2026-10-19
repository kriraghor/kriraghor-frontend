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

export function KpiTile({ label, value, delta, spark, note, help, testId }: { label: string; value: string; delta?: ReactNode; spark?: (number | null)[] | null; note?: string | null; help?: string; testId?: string }) {
  return (
    <div className="flex flex-col gap-1 glass-card p-4" data-testid={testId}>
      <p className="text-xs font-bold uppercase tracking-wide text-muted" title={help}>
        {label}
      </p>
      <p className="text-3xl font-extrabold tabular-nums">{value}</p>
      {delta}
      {note ? <p className="text-xs text-muted">{note}</p> : null}
      {spark ? <Sparkline points={spark} label={label} /> : null}
    </div>
  );
}

function SrTable({ caption, rows }: { caption: string; rows: [string, string][] }) {
  return (
    <table className="sr-only">
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
  );
}

export function ChartLine({ title, points, compare, format, labelOf }: { title: string; points: { key: string; value: number }[]; compare?: number[] | null; format: (n: number) => string; labelOf: (key: string) => string }) {
  const w = 600;
  const hgt = 180;
  const max = Math.max(1, ...points.map((p) => p.value), ...(compare ?? []));
  const pad = 28; // room for the first and last axis labels
  const step = points.length > 1 ? (w - 2 * pad) / (points.length - 1) : w;
  const y = (v: number) => hgt - 24 - (v / max) * (hgt - 40);
  const path = (vals: number[]) => vals.map((v, i) => `${i === 0 ? "M" : "L"}${(pad + i * step).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <figure className="glass-card p-4">
      <figcaption className="font-bold">{title}</figcaption>
      <svg viewBox={`0 0 ${w} ${hgt}`} className="mt-2 h-44 w-full" aria-hidden="true">
        {compare ? <path d={path(compare)} fill="none" stroke="var(--color-muted)" strokeDasharray="4 4" strokeWidth="2" /> : null}
        <path d={path(points.map((p) => p.value))} fill="none" stroke="var(--color-brand)" strokeWidth="3" />
        {points.map((p, i) => (
          <text key={p.key} x={pad + i * step} y={hgt - 6} fontSize="11" textAnchor="middle" fill="var(--color-muted)">
            {labelOf(p.key)}
          </text>
        ))}
      </svg>
      <SrTable caption={title} rows={points.map((p) => [labelOf(p.key), format(p.value)])} />
    </figure>
  );
}

export function ChartBars({ title, bars, format }: { title: string; bars: { label: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <figure className="glass-card p-4">
      <figcaption className="font-bold">{title}</figcaption>
      <div className="mt-3 flex h-40 items-end gap-1" aria-hidden="true">
        {bars.map((b) => (
          <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[11px] tabular-nums text-muted">{b.value ? format(b.value) : ""}</span>
            <span className="w-full bg-brand" style={{ height: `${Math.max(2, (b.value / max) * 120)}px` }} />
            <span className="truncate text-[11px] text-muted">{b.label}</span>
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
    <figure className="glass-card p-4">
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
    <figure className="glass-card p-4">
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
