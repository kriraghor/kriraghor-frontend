"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChartCard, useWidth, type ChartState, type ChartTable, type LegendItem } from "./ChartCard";
import { linear, nearestIndex, niceTicks, tickEvery, tickShown } from "./scale";
import { seriesColor, Tip } from "./Tip";

/**
 * Change over time on one axis (kriraghor-docs design, charts): up to four series, an area wash under
 * the main one, a dashed comparison series (the previous period or last year), and the current,
 * unfinished bucket drawn dashed. A crosshair snaps to the nearest point and the readout lists every
 * series there; arrow keys move it when the chart has focus. Never two y-axes.
 */
export type LineSeries = {
  key: string;
  label: string;
  values: (number | null)[];
  /** A comparison line: dashed, in the recessive colour, no area. */
  compare?: boolean;
  color?: string;
};

const H_PAD_TOP = 8;
const X_AXIS = 24;

export function LineChart({
  title,
  subtitle,
  labels,
  short,
  series,
  format,
  axis,
  integer,
  area = true,
  partialLast,
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
  /** The full label of each point (tooltip and table). */
  labels: string[];
  /** A shorter label for the x axis (defaults to `labels`). */
  short?: string[];
  series: LineSeries[];
  format: (n: number) => string;
  axis?: (n: number, top: number) => string;
  integer?: boolean;
  area?: boolean;
  partialLast?: boolean;
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
  const main = series.filter((s) => !s.compare);
  const colors = series.map((s) => (s.compare ? "var(--viz-compare)" : seriesColor(main.indexOf(s), main.length, s.color)));
  const legend: LegendItem[] = series.map((s, i) => ({ label: s.label, color: colors[i], kind: s.compare ? "dash" : "line" }));
  const table: ChartTable = { columns: [t("when"), ...series.map((s) => s.label)], rows: labels.map((l, i) => [l, ...series.map((s) => (s.values[i] === null || s.values[i] === undefined ? "–" : format(s.values[i] as number)))]) };
  const allEmpty = series.every((s) => s.values.every((v) => !v));
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      legend={legend}
      table={table}
      state={state ?? (allEmpty ? "empty" : "ready")}
      refreshing={refreshing}
      emptyText={emptyText}
      emptyAction={emptyAction}
      onRetry={onRetry}
      onCsv={onCsv}
      height={height}
      testId={testId}
      className={className}
    >
      <Plot title={title} labels={labels} short={short ?? labels} series={series} colors={colors} format={format} axis={axis ?? format} integer={integer} area={area} partialLast={partialLast} height={height} soFar={t("soFar")} />
    </ChartCard>
  );
}

function Plot({
  title,
  labels,
  short,
  series,
  colors,
  format,
  axis,
  integer,
  area,
  partialLast,
  height,
  soFar,
}: {
  title: string;
  labels: string[];
  short: string[];
  series: LineSeries[];
  colors: string[];
  format: (n: number) => string;
  axis: (n: number, top: number) => string;
  integer?: boolean;
  area: boolean;
  partialLast?: boolean;
  height: number;
  soFar: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [at, setAt] = useState<number | null>(null);
  const gradient = useId();
  const n = labels.length;
  const max = Math.max(0, ...series.flatMap((s) => s.values.map((v) => v ?? 0)));
  const ticks = niceTicks(max, { count: 4, integer });
  const top = ticks[ticks.length - 1];
  const yLabelW = Math.min(64, Math.max(...ticks.map((v) => axis(v, top).length)) * 7 + 8);
  const left = yLabelW;
  const right = 8;
  const plotW = Math.max(0, width - left - right);
  const plotH = height - X_AXIS - H_PAD_TOP;
  const step = n > 1 ? plotW / (n - 1) : 0;
  const x = (i: number) => (n > 1 ? left + i * step : left + plotW / 2);
  const y = linear([0, top], [H_PAD_TOP + plotH, H_PAD_TOP]);
  const every = tickEvery(n, Math.max(1, Math.floor(plotW / 56)));

  const pathOf = (vals: (number | null)[], from = 0, to = n - 1) => {
    let d = "";
    let pen = false;
    for (let i = from; i <= to; i += 1) {
      const v = vals[i];
      if (v === null || v === undefined) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    }
    return d;
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setAt(nearestIndex(e.clientX - box.left, n, left, step));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      setAt((cur) => Math.min(n - 1, Math.max(0, (cur ?? (e.key === "ArrowRight" ? -1 : n)) + (e.key === "ArrowRight" ? 1 : -1))));
    } else if (e.key === "Home") setAt(0);
    else if (e.key === "End") setAt(n - 1);
    else if (e.key === "Escape") setAt(null);
  };

  const mainIdx = series.findIndex((s) => !s.compare);
  return (
    <div
      ref={ref}
      className="relative select-none outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded-control"
      style={{ height, touchAction: "pan-y" }}
      tabIndex={0}
      role="img"
      aria-label={title}
      onPointerMove={onMove}
      onPointerDown={onMove}
      onPointerLeave={() => setAt(null)}
      onKeyDown={onKey}
      onBlur={() => setAt(null)}
    >
      {width > 0 ? (
        <svg width={width} height={height} className="block overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={colors[mainIdx] ?? "var(--viz-solo)"} stopOpacity="0.18" />
              <stop offset="100%" stopColor={colors[mainIdx] ?? "var(--viz-solo)"} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={left} x2={left + plotW} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--viz-axis)" : "var(--viz-grid)"} strokeWidth="1" shapeRendering="crispEdges" />
              <text x={left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted text-[12px] tabular-nums">
                {axis(v, top)}
              </text>
            </g>
          ))}
          {labels.map((_, i) =>
            tickShown(i, n, every) ? (
              <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 && n > 1 ? "start" : i === n - 1 && n > 1 ? "end" : "middle"} className="fill-muted text-[12px]">
                {short[i]}
              </text>
            ) : null,
          )}
          {area && mainIdx >= 0 ? (
            <path
              d={`${pathOf(series[mainIdx].values)}L${x(lastIndex(series[mainIdx].values)).toFixed(1)},${y(0).toFixed(1)}L${x(firstIndex(series[mainIdx].values)).toFixed(1)},${y(0).toFixed(1)}Z`}
              fill={`url(#${gradient})`}
              className="viz-fade"
            />
          ) : null}
          {series.map((s, si) => {
            const dashed = s.compare;
            const cut = partialLast && !s.compare && n > 1;
            return (
              <g key={s.key} className="viz-fade">
                <path d={pathOf(s.values, 0, cut ? n - 2 : n - 1)} fill="none" stroke={colors[si]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={dashed ? "5 5" : undefined} />
                {cut ? <path d={pathOf(s.values, n - 2, n - 1)} fill="none" stroke={colors[si]} strokeWidth="2" strokeLinecap="round" strokeDasharray="2 4" /> : null}
              </g>
            );
          })}
          {at !== null ? (
            <g>
              <line x1={x(at)} x2={x(at)} y1={H_PAD_TOP} y2={H_PAD_TOP + plotH} stroke="var(--viz-axis)" strokeWidth="1" shapeRendering="crispEdges" />
              {series.map((s, si) =>
                s.values[at] === null || s.values[at] === undefined ? null : (
                  <circle key={s.key} cx={x(at)} cy={y(s.values[at] as number)} r="4.5" fill={colors[si]} stroke="var(--color-surface)" strokeWidth="2" />
                ),
              )}
            </g>
          ) : null}
        </svg>
      ) : null}
      {at !== null && width > 0 ? (
        <Tip
          x={x(at)}
          width={width}
          title={labels[at]}
          rows={series.map((s, si) => ({ label: s.label, value: s.values[at] === null || s.values[at] === undefined ? "–" : format(s.values[at] as number), color: colors[si], dashed: s.compare }))}
          note={partialLast && at === n - 1 ? soFar : undefined}
        />
      ) : null}
    </div>
  );
}

function firstIndex(vals: (number | null)[]) {
  const i = vals.findIndex((v) => v !== null && v !== undefined);
  return i < 0 ? 0 : i;
}
function lastIndex(vals: (number | null)[]) {
  for (let i = vals.length - 1; i >= 0; i -= 1) if (vals[i] !== null && vals[i] !== undefined) return i;
  return 0;
}
