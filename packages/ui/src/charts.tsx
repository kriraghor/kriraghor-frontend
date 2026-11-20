"use client";

import { LineChart } from "./charts/LineChart";
import { BarChart, RankBars } from "./charts/BarChart";
import { SplitBar } from "./charts/Figures";

/**
 * Dashboard charts (M19, the panels; kriraghor-docs design, charts). Plain SVG and HTML on the chart
 * tokens (--viz-*), no chart library: each chart has axes, a hover and keyboard readout, a Table
 * toggle and loading, empty and error states. The pieces live in ./charts/; the four Chart* names
 * below are the first versions' props, kept so existing pages draw with the new pieces.
 */
export { ChartCard, Legend, Key, useWidth, type ChartState, type ChartTable, type LegendItem } from "./charts/ChartCard";
export { LineChart, type LineSeries } from "./charts/LineChart";
export { BarChart, RankBars, barPath, type BarSeries, type RankItem } from "./charts/BarChart";
export { KpiTile, DeltaBadge, Sparkline, SplitBar, HeatStrip, Funnel, type SplitPart, type HeatCell, type FunnelStep } from "./charts/Figures";
export { pctChange, ptsChange, deltaTone, type Better, type DeltaTone } from "./charts/delta";
export { compact, compactTaka, count, share, digits, niceTicks } from "./charts/scale";
export { seriesColor } from "./charts/Tip";
export { RangePicker } from "./charts/RangePicker";
export { periodFromParams, periodParams, presetOf, presetPeriod, shiftMonth, lastOfMonth, type Period, type Preset } from "./charts/range";

export type Delta = { value: number | null; kind: "pct" | "pts" };

/** A line per bucket, with an optional dashed comparison (last year, or a second count). */
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
  const labels = points.map((p) => labelOf(p.key));
  return (
    <LineChart
      title={title}
      labels={labels}
      format={format}
      series={[
        { key: "current", label: legend?.current ?? title, values: points.map((p) => p.value) },
        ...(compare && legend?.compare ? [{ key: "compare", label: legend.compare, values: compare, compare: true }] : []),
      ]}
    />
  );
}

/** Columns with a label under each; `tick` replaces the label under the column ("" shows none). */
export function ChartBars({ title, bars, format }: { title: string; bars: { label: string; value: number; tick?: string }[]; format: (n: number) => string; values?: boolean }) {
  return <BarChart title={title} labels={bars.map((b) => b.label)} short={bars.map((b) => b.tick ?? b.label)} series={[{ key: "value", label: title, values: bars.map((b) => b.value) }]} format={format} />;
}

/** Items by size, longest first. */
export function ChartRank({ title, items, format, empty }: { title: string; items: { label: string; value: number }[]; format: (n: number) => string; empty: string }) {
  return <RankBars title={title} items={items} format={format} emptyText={empty} />;
}

/** Part of a whole. */
export function ChartSplit({ title, parts, format, empty }: { title: string; parts: { label: string; value: number }[]; format: (n: number) => string; empty: string }) {
  return <SplitBar title={title} parts={parts} format={format} emptyText={empty} />;
}
