"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChartBar, DownloadSimple, Table } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { cn } from "../cn";
import { Button } from "../kit/Button";

/**
 * The frame every dashboard chart sits in (kriraghor-docs design, charts): title and subtitle, the
 * legend, a Table toggle (every value reachable without hovering), an optional CSV button, and the
 * loading, empty and error states. While new data loads (`refreshing`) the chart keeps its last
 * render at reduced opacity, so nothing jumps.
 */
export type ChartState = "ready" | "loading" | "empty" | "error";
export type LegendItem = { label: string; color: string; kind?: "line" | "dash" | "rect" };
export type ChartTable = { columns: string[]; rows: string[][] };

export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  state = "ready",
  refreshing,
  emptyText,
  emptyAction,
  onRetry,
  onCsv,
  height = 200,
  className,
  testId,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  legend?: LegendItem[];
  table?: ChartTable;
  state?: ChartState;
  refreshing?: boolean;
  emptyText?: ReactNode;
  emptyAction?: ReactNode;
  onRetry?: () => void;
  onCsv?: () => void;
  height?: number;
  className?: string;
  testId?: string;
  children?: ReactNode;
}) {
  const t = useTranslations("kit.charts");
  const [asTable, setAsTable] = useState(false);
  const ready = state === "ready";
  return (
    <figure className={cn("viz flex min-w-0 flex-col surface-card p-4 sm:p-5", className)} data-testid={testId}>
      <div className="flex items-start gap-2">
        <figcaption className="min-w-0 flex-1">
          <span className="block font-bold leading-snug">{title}</span>
          {subtitle ? <span className="mt-0.5 block text-sm text-muted">{subtitle}</span> : null}
        </figcaption>
        {ready && table ? (
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
            aria-label={asTable ? t("showChart") : t("showTable")}
            title={asTable ? t("showChart") : t("showTable")}
            className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
            data-testid={testId ? `${testId}-table` : undefined}
          >
            {asTable ? <ChartBar size={20} aria-hidden /> : <Table size={20} aria-hidden />}
          </button>
        ) : null}
        {ready && onCsv ? (
          <button
            type="button"
            onClick={onCsv}
            aria-label={t("csv")}
            title={t("csv")}
            className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            <DownloadSimple size={20} aria-hidden />
          </button>
        ) : null}
      </div>
      {ready && legend && legend.length > 1 && !asTable ? <Legend items={legend} /> : null}
      <div className={cn("mt-3 min-w-0 transition-opacity duration-200", refreshing && "opacity-60")}>
        {state === "loading" ? (
          <ChartSkeleton height={height} label={t("loading")} />
        ) : state === "error" ? (
          <div role="alert" className="flex flex-col items-center justify-center gap-2 text-center" style={{ minHeight: height }}>
            <p className="font-semibold">{t("error")}</p>
            {onRetry ? (
              <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
                {t("retry")}
              </Button>
            ) : null}
          </div>
        ) : state === "empty" ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-control border border-dashed border-line px-4 text-center text-sm text-muted" style={{ minHeight: height }}>
            <p>{emptyText ?? t("empty")}</p>
            {emptyAction}
          </div>
        ) : asTable && table ? (
          <DataGrid table={table} caption={typeof title === "string" ? title : undefined} />
        ) : (
          <>
            {children}
            {table ? <SrTable table={table} caption={typeof title === "string" ? title : undefined} /> : null}
          </>
        )}
      </div>
    </figure>
  );
}

/** The legend: a short line for lines, a dashed line for the comparison, a square for bars and parts. */
export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn("mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted", className)}>
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <Key color={i.color} kind={i.kind ?? "line"} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export function Key({ color, kind = "line" }: { color: string; kind?: LegendItem["kind"] }) {
  if (kind === "rect") return <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />;
  return <span aria-hidden className="w-4 shrink-0" style={{ borderTop: `2px ${kind === "dash" ? "dashed" : "solid"} ${color}` }} />;
}

function DataGrid({ table, caption }: { table: ChartTable; caption?: string }) {
  return (
    <div className="max-h-80 overflow-auto rounded-control border border-line">
      <table className="w-full text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="sticky top-0 bg-surface-2 text-left text-xs text-muted">
          <tr>
            {table.columns.map((c, i) => (
              <th key={c} scope="col" className={cn("px-3 py-2 font-semibold", i > 0 && "text-right")}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {table.rows.map((r, ri) => (
            <tr key={`${r[0]}-${ri}`}>
              {r.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="px-3 py-2 text-left font-normal">
                    {cell}
                  </th>
                ) : (
                  <td key={i} className="px-3 py-2 text-right tabular-nums">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// sr-only sits on a wrapping div: a table ignores the 1px height and overflow, so its rows would still
// lengthen the page.
function SrTable({ table, caption }: { table: ChartTable; caption?: string }) {
  return (
    <div className="sr-only">
      <table>
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {table.columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, ri) => (
            <tr key={`${r[0]}-${ri}`}>
              {r.map((cell, i) => (i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i}>{cell}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A loading chart: shimmer bars in the chart's own height, so nothing moves when the data arrives. */
function ChartSkeleton({ height, label }: { height: number; label: string }) {
  const bars = [46, 62, 38, 74, 55, 82, 60, 48, 70, 58];
  return (
    <div role="status" aria-label={label} className="flex items-end gap-2" style={{ height }}>
      {bars.map((h, i) => (
        <span key={i} className="kg-shimmer flex-1 rounded-t-[4px] bg-surface-2" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

/** The width of an element, updated as it resizes (0 until it has been measured). */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
