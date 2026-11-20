"use client";

import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "../cn";
import { ChartCard, useWidth, type ChartState, type ChartTable, type LegendItem } from "./ChartCard";
import { linear, niceTicks, share, tickEvery, tickShown } from "./scale";
import { seriesColor, Tip } from "./Tip";

/**
 * Columns over time or over categories (kriraghor-docs design, charts): one series, two side by side
 * (same unit only) or up to four stacked. Bars are at most 24 px thick with a 4 px rounded data end
 * and a 2 px gap; each column is its own hover and focus target. `highlight` marks one column (today).
 */
export type BarSeries = { key: string; label: string; values: number[]; color?: string };

const TOP = 8;
const X_AXIS = 24;

export function BarChart({
  title,
  subtitle,
  labels,
  short,
  series,
  stacked,
  highlight,
  format,
  axis,
  integer,
  height = 200,
  state,
  refreshing,
  emptyText,
  emptyAction,
  onRetry,
  onCsv,
  testId,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  labels: string[];
  short?: string[];
  series: BarSeries[];
  stacked?: boolean;
  highlight?: number;
  format: (n: number) => string;
  axis?: (n: number, top: number) => string;
  integer?: boolean;
  height?: number;
  state?: ChartState;
  refreshing?: boolean;
  emptyText?: ReactNode;
  emptyAction?: ReactNode;
  onRetry?: () => void;
  onCsv?: () => void;
  testId?: string;
  className?: string;
}) {
  const t = useTranslations("kit.charts");
  const colors = series.map((s, i) => seriesColor(i, series.length, s.color));
  const legend: LegendItem[] = series.map((s, i) => ({ label: s.label, color: colors[i], kind: "rect" }));
  const table: ChartTable = { columns: [t("when"), ...series.map((s) => s.label)], rows: labels.map((l, i) => [l, ...series.map((s) => format(s.values[i] ?? 0))]) };
  const empty = series.every((s) => s.values.every((v) => !v));
  return (
    <ChartCard title={title} subtitle={subtitle} legend={legend} table={table} state={state ?? (empty ? "empty" : "ready")} refreshing={refreshing} emptyText={emptyText} emptyAction={emptyAction} onRetry={onRetry} onCsv={onCsv} height={height} testId={testId} className={className}>
      <Columns title={title} labels={labels} short={short ?? labels} series={series} colors={colors} stacked={stacked} highlight={highlight} format={format} axis={axis ?? format} integer={integer} height={height} />
    </ChartCard>
  );
}

function Columns({
  title,
  labels,
  short,
  series,
  colors,
  stacked,
  highlight,
  format,
  axis,
  integer,
  height,
}: {
  title: string;
  labels: string[];
  short: string[];
  series: BarSeries[];
  colors: string[];
  stacked?: boolean;
  highlight?: number;
  format: (n: number) => string;
  axis: (n: number, top: number) => string;
  integer?: boolean;
  height: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [at, setAt] = useState<number | null>(null);
  const n = labels.length;
  const totals = labels.map((_, i) => series.reduce((s, x) => s + (x.values[i] ?? 0), 0));
  const max = stacked ? Math.max(0, ...totals) : Math.max(0, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(max, { count: 4, integer });
  const top = ticks[ticks.length - 1];
  const left = Math.min(64, Math.max(...ticks.map((v) => axis(v, top).length)) * 7 + 8);
  const plotW = Math.max(0, width - left - 4);
  const plotH = height - X_AXIS - TOP;
  const band = n > 0 ? plotW / n : 0;
  const groups = stacked ? 1 : series.length;
  const barW = Math.max(2, Math.min(24, (band * 0.72 - 2 * (groups - 1)) / groups));
  const y = linear([0, top], [TOP + plotH, TOP]);
  const every = tickEvery(n, Math.max(1, Math.floor(plotW / 48)));
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      setAt((cur) => Math.min(n - 1, Math.max(0, (cur ?? (e.key === "ArrowRight" ? -1 : n)) + (e.key === "ArrowRight" ? 1 : -1))));
    } else if (e.key === "Escape") setAt(null);
  };
  // The whole column (its band, empty or not) answers the pointer, by mouse or by touch.
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left - left;
    setAt(x < 0 || band <= 0 ? null : Math.min(n - 1, Math.floor(x / band)));
  };
  return (
    <div
      ref={ref}
      className="relative rounded-control outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      style={{ height }}
      tabIndex={0}
      role="img"
      aria-label={title}
      onKeyDown={onKey}
      onBlur={() => setAt(null)}
      onPointerMove={onMove}
      onPointerDown={onMove}
      onPointerLeave={() => setAt(null)}
    >
      {width > 0 ? (
        <svg width={width} height={height} className="block" aria-hidden>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={left} x2={left + plotW} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--viz-axis)" : "var(--viz-grid)"} strokeWidth="1" shapeRendering="crispEdges" />
              <text x={left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted text-[12px] tabular-nums">
                {axis(v, top)}
              </text>
            </g>
          ))}
          {labels.map((_, i) => {
            const cx = left + band * i + band / 2;
            let base = 0;
            return (
              <g key={i}>
                {at === i ? <rect x={left + band * i} y={TOP} width={band} height={plotH} fill="var(--viz-hover)" /> : null}
                {series.map((s, si) => {
                  const v = s.values[i] ?? 0;
                  if (v <= 0) return null;
                  const x0 = stacked ? cx - barW / 2 : cx - (groups * barW + 2 * (groups - 1)) / 2 + si * (barW + 2);
                  const yTop = y(stacked ? base + v : v);
                  const yBot = y(stacked ? base : 0);
                  const isTop = !stacked || series.slice(si + 1).every((o) => !(o.values[i] > 0));
                  if (stacked) base += v;
                  const h = Math.max(1, yBot - yTop - (stacked && si > 0 ? 2 : 0));
                  return <path key={s.key} d={barPath(x0, yTop, barW, h, isTop ? 4 : 0)} fill={colors[si]} opacity={highlight === undefined || highlight === i ? 1 : 0.72} className="viz-grow-y" style={{ transformOrigin: `0 ${yBot}px` }} />;
                })}
                {tickShown(i, n, every) ? (
                  <text x={i === n - 1 && n > 1 ? left + plotW : cx} y={height - 6} textAnchor={i === n - 1 && n > 1 ? "end" : "middle"} className={cn("text-[12px]", highlight === i ? "fill-ink font-semibold" : "fill-muted")}>
                    {short[i]}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : null}
      {at !== null && width > 0 ? (
        <Tip
          x={left + band * at + band / 2}
          width={width}
          title={labels[at]}
          rows={series.map((s, si) => ({ label: s.label, value: format(s.values[at] ?? 0), color: colors[si] }))}
          note={stacked && series.length > 1 ? format(totals[at]) : undefined}
        />
      ) : null}
    </div>
  );
}

/** A bar from its top-left, rounded only at the data end (the top). */
export function barPath(x: number, yTop: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  if (rr <= 0) return `M${x},${yTop}h${w}v${h}h${-w}Z`;
  return `M${x},${yTop + h}V${yTop + rr}Q${x},${yTop} ${x + rr},${yTop}H${x + w - rr}Q${x + w},${yTop} ${x + w},${yTop + rr}V${yTop + h}Z`;
}

/**
 * Items compared by size, longest first (the caller sorts): a horizontal bar per item with its name
 * and its value at the tip. `secondary` prints a quieter second figure (units beside value). Rows can
 * be links (`href` through `linkAs`).
 */
export type RankItem = { key?: string; label: string; value: number; secondary?: string; href?: string };

export function RankBars({
  title,
  subtitle,
  items,
  format,
  emptyText,
  state,
  onRetry,
  onCsv,
  testId,
  className,
  linkAs: LinkAs,
  limit = 8,
}: {
  title: string;
  subtitle?: ReactNode;
  items: RankItem[];
  format: (n: number) => string;
  emptyText?: ReactNode;
  state?: ChartState;
  onRetry?: () => void;
  onCsv?: () => void;
  testId?: string;
  className?: string;
  linkAs?: (p: { href: string; className?: string; children: ReactNode }) => ReactNode;
  limit?: number;
}) {
  const t = useTranslations("kit.charts");
  const shown = items.slice(0, limit);
  const max = Math.max(1, ...shown.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0);
  const table: ChartTable = { columns: [t("item"), t("value"), t("share")], rows: items.map((i) => [i.label, format(i.value), share(i.value, total)]) };
  return (
    <ChartCard title={title} subtitle={subtitle} table={table} state={state ?? (items.length ? "ready" : "empty")} emptyText={emptyText} onRetry={onRetry} onCsv={onCsv} height={120} testId={testId} className={className}>
      <ol className="space-y-2.5">
        {shown.map((i) => {
          const row = (
            <>
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{i.label}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {format(i.value)}
                  {i.secondary ? <span className="ml-1.5 text-xs font-normal text-muted">{i.secondary}</span> : null}
                </span>
              </span>
              <span className="mt-1 block h-2 rounded-r-[4px] bg-[var(--viz-track)]">
                <span className="viz-grow-x block h-full rounded-r-[4px]" style={{ width: `${Math.max(1, (i.value / max) * 100)}%`, background: "var(--viz-solo)" }} />
              </span>
            </>
          );
          return (
            <li key={i.key ?? i.label}>
              {i.href && LinkAs ? (
                <LinkAs href={i.href} className="block rounded-[6px] outline-offset-2 hover:opacity-85">
                  {row}
                </LinkAs>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ol>
      {items.length > shown.length ? <p className="mt-3 text-xs text-muted">{t("moreItems", { n: items.length - shown.length })}</p> : null}
    </ChartCard>
  );
}
