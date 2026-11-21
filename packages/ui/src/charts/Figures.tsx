"use client";

import { useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Info } from "@phosphor-icons/react";
import * as RPopover from "@radix-ui/react-popover";
import { useTranslations } from "next-intl";
import { cn } from "../cn";
import { ChartCard, type ChartState, type ChartTable } from "./ChartCard";
import { deltaTone, type Better } from "./delta";
import { digits, share, tickEvery } from "./scale";

/**
 * The figures of a dashboard (kriraghor-docs design, charts): the KPI tile with its change and
 * sparkline, a tall split bar for part of a whole, a heat strip for hours and a funnel for steps.
 */

/**
 * A change against a named period: an arrow and the number, coloured by good or bad (not by sign).
 * `locale` "bn" prints Bangla digits and "পয়েন্ট" for points (dashboards round 2).
 */
export function DeltaBadge({ value, kind, label, better = "up", locale = "en" }: { value: number | null; kind: "pct" | "pts"; label: string; better?: Better; locale?: string }) {
  // Nothing to compare (no previous data): no badge rather than a bare label.
  if (value === null || value === undefined) return null;
  const tone = deltaTone(value, better);
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : ArrowRight;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 text-xs">
      <span className={cn("inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 font-bold tabular-nums", tone === "good" ? "bg-[var(--viz-good-soft)] text-[var(--viz-good)]" : tone === "bad" ? "bg-danger-soft text-danger" : "bg-surface-2 text-muted")}>
        <Icon size={12} weight="bold" aria-hidden />
        {digits(String(Math.abs(value)), locale)}
        {kind === "pct" ? "%" : locale === "bn" ? " পয়েন্ট" : " pts"}
      </span>
      <span className="text-muted">{label}</span>
    </span>
  );
}

/** A small trend: the line in the recessive colour, the latest point in the panel's colour. */
export function Sparkline({ points, label, labels, format }: { points: (number | null)[]; label: string; labels?: string[]; format?: (n: number) => string }) {
  const [at, setAt] = useState<number | null>(null);
  const vals = points.map((p) => p ?? 0);
  const max = Math.max(1, ...vals);
  const w = 120;
  const hgt = 32;
  const step = vals.length > 1 ? w / (vals.length - 1) : w;
  const yy = (v: number) => hgt - (v / max) * (hgt - 6) - 3;
  const d = vals.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${yy(v).toFixed(1)}`).join(" ");
  const last = vals.length - 1;
  const hover = labels && format;
  return (
    <div className="relative">
      <svg
        viewBox={`-3 0 ${w + 6} ${hgt}`}
        className="h-8 w-full overflow-visible"
        role="img"
        aria-label={label}
        preserveAspectRatio="none"
        onPointerMove={hover ? (e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setAt(Math.min(last, Math.max(0, Math.round(((e.clientX - box.left) / box.width) * last))));
        } : undefined}
        onPointerLeave={() => setAt(null)}
      >
        <path d={`${d}L${(last * step).toFixed(1)},${hgt}L0,${hgt}Z`} fill="var(--viz-solo)" opacity="0.1" />
        <path d={d} fill="none" stroke="var(--viz-compare)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {last >= 0 ? <circle cx={last * step} cy={yy(vals[last])} r="3" fill="var(--viz-solo)" vectorEffect="non-scaling-stroke" /> : null}
        {at !== null ? <line x1={at * step} x2={at * step} y1="0" y2={hgt} stroke="var(--viz-axis)" strokeWidth="1" vectorEffect="non-scaling-stroke" /> : null}
      </svg>
      {at !== null && hover ? (
        <span className="pointer-events-none absolute -top-6 right-0 rounded-[6px] bg-band px-1.5 py-0.5 text-xs font-semibold text-band-text">
          {labels[at]}: {format(vals[at])}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The KPI tile: label, the figure, its change, a note and a sparkline. `help` opens a short
 * definition. `tone` marks a figure that needs attention (overdue) without colouring the number.
 */
export function KpiTile({
  label,
  value,
  delta,
  spark,
  sparkLabels,
  sparkFormat,
  note,
  help,
  tone,
  icon,
  interactive,
  testId,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  spark?: (number | null)[] | null;
  sparkLabels?: string[];
  sparkFormat?: (n: number) => string;
  note?: ReactNode;
  help?: string;
  tone?: "warning" | "danger";
  icon?: ReactNode;
  interactive?: boolean;
  testId?: string;
  className?: string;
}) {
  const t = useTranslations("kit.charts");
  // Two tiles share a row on phones (390px), so the padding and the figure shrink there.
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col gap-1.5 surface-card p-4 sm:p-5",
        tone === "warning" && "border-l-4 border-l-warning",
        tone === "danger" && "border-l-4 border-l-danger",
        interactive && "transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-line-strong",
        className,
      )}
      data-testid={testId}
    >
      <div className="flex items-start gap-1.5">
        {icon ? <span className="mt-0.5 text-muted [&>svg]:size-4">{icon}</span> : null}
        <p className="min-w-0 flex-1 text-sm font-semibold text-muted">{label}</p>
        {help ? (
          <RPopover.Root>
            <RPopover.Trigger asChild>
              <button type="button" aria-label={t("whatIs", { label })} className="relative z-[1] -m-2 inline-flex size-8 shrink-0 items-center justify-center rounded-pill text-muted hover:bg-surface-2 hover:text-ink">
                <Info size={16} aria-hidden />
              </button>
            </RPopover.Trigger>
            <RPopover.Portal>
              <RPopover.Content side="top" align="end" sideOffset={6} className="z-50 max-w-72 rounded-control border border-line bg-surface p-3 text-sm shadow-lg">
                <p className="font-semibold">{label}</p>
                <p className="mt-1 text-muted">{help}</p>
              </RPopover.Content>
            </RPopover.Portal>
          </RPopover.Root>
        ) : null}
      </div>
      <p className="break-words font-display text-2xl font-bold leading-tight sm:text-3xl">{value}</p>
      {delta}
      {note ? <p className="text-xs text-muted">{note}</p> : null}
      {spark && spark.length > 1 ? (
        <div className="mt-auto pt-1">
          <Sparkline points={spark} label={label} labels={sparkLabels} format={sparkFormat} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Part of a whole, five parts at most: one tall bar split into blocks in a fixed colour order (the
 * colour follows the part, not its size), each block printing its share when it fits, and a legend
 * with the amounts. A part at zero draws no block but stays in the legend.
 */
export type SplitPart = { key?: string; label: string; value: number };

export function SplitBar({
  title,
  subtitle,
  parts,
  format,
  emptyText,
  state,
  onRetry,
  testId,
  className,
  locale = "en",
}: {
  title: string;
  subtitle?: ReactNode;
  parts: SplitPart[];
  format: (n: number) => string;
  emptyText?: ReactNode;
  state?: ChartState;
  onRetry?: () => void;
  testId?: string;
  className?: string;
  locale?: string;
}) {
  const t = useTranslations("kit.charts");
  const [at, setAt] = useState<number | null>(null);
  const total = parts.reduce((s, p) => s + p.value, 0);
  const color = (i: number) => `var(--viz-${(i % 6) + 1})`;
  const table: ChartTable = { columns: [t("item"), t("value"), t("share")], rows: parts.map((p) => [p.label, format(p.value), share(p.value, total, locale)]) };
  return (
    <ChartCard title={title} subtitle={subtitle} table={table} state={state ?? (total > 0 ? "ready" : "empty")} emptyText={emptyText} onRetry={onRetry} height={80} testId={testId} className={className}>
      <div className="flex h-7 w-full gap-0.5" role="img" aria-label={parts.map((p) => `${p.label} ${share(p.value, total, locale)}`).join(", ")}>
        {parts.map((p, i) =>
          p.value > 0 ? (
            <span
              key={p.key ?? p.label}
              className={cn("viz-grow-x flex min-w-0 items-center overflow-hidden rounded-[4px] px-1.5 text-xs font-bold transition-opacity", at !== null && at !== i && "opacity-50")}
              style={{ width: `${(p.value / total) * 100}%`, background: color(i), color: `var(--viz-on-${(i % 6) + 1})` }}
              onPointerEnter={() => setAt(i)}
              onPointerLeave={() => setAt(null)}
              title={`${p.label}: ${format(p.value)} (${share(p.value, total, locale)})`}
            >
              {p.value / total >= 0.12 ? share(p.value, total, locale) : ""}
            </span>
          ) : null,
        )}
      </div>
      <ul className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
        {parts.map((p, i) => (
          <li key={p.key ?? p.label} className={cn("flex items-center gap-2 rounded-[6px] transition-opacity", at !== null && at !== i && "opacity-60")} onPointerEnter={() => setAt(i)} onPointerLeave={() => setAt(null)}>
            <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color(i) }} />
            <span className="min-w-0 flex-1 truncate">{p.label}</span>
            <span className="font-semibold tabular-nums">{format(p.value)}</span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

/**
 * Counts per slot on one hue, light to dark (busiest hours): every cell is a hover and focus target;
 * labels print every few cells; the scale reads "fewer → more".
 */
export type HeatCell = { label: string; short?: string; value: number };

export function HeatStrip({
  title,
  subtitle,
  cells,
  format,
  emptyText,
  state,
  onRetry,
  testId,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  cells: HeatCell[];
  format: (n: number) => string;
  emptyText?: ReactNode;
  state?: ChartState;
  onRetry?: () => void;
  testId?: string;
  className?: string;
}) {
  const t = useTranslations("kit.charts");
  const [at, setAt] = useState<number | null>(null);
  const max = Math.max(0, ...cells.map((c) => c.value));
  const every = tickEvery(cells.length, 8);
  const table: ChartTable = { columns: [t("when"), t("value")], rows: cells.map((c) => [c.label, format(c.value)]) };
  const fill = (v: number) => (v <= 0 ? "var(--viz-track)" : `color-mix(in oklab, var(--viz-solo) ${Math.round(18 + (v / max) * 82)}%, var(--color-surface))`);
  return (
    <ChartCard title={title} subtitle={subtitle} table={table} state={state ?? (max > 0 ? "ready" : "empty")} emptyText={emptyText} onRetry={onRetry} height={72} testId={testId} className={className}>
      <div className="relative">
        <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
          {cells.map((c, i) => (
            <button
              key={c.label}
              type="button"
              aria-label={`${c.label}: ${format(c.value)}`}
              className={cn("h-10 rounded-[4px] outline-offset-1 transition-transform duration-150", at === i && "scale-y-110")}
              style={{ background: fill(c.value) }}
              onPointerEnter={() => setAt(i)}
              onPointerLeave={() => setAt(null)}
              onFocus={() => setAt(i)}
              onBlur={() => setAt(null)}
            />
          ))}
        </div>
        <div className="mt-1 grid text-xs text-muted" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }} aria-hidden>
          {cells.map((c, i) => (
            <span key={c.label} className="overflow-visible whitespace-nowrap">
              {i % every === 0 ? (c.short ?? c.label) : ""}
            </span>
          ))}
        </div>
        {at !== null ? (
          <p className="pointer-events-none absolute -top-9 rounded-control border border-line bg-surface px-2 py-1 text-xs shadow-md" style={{ left: `clamp(0px, calc(${((at + 0.5) / cells.length) * 100}% - 3rem), calc(100% - 7rem))` }} role="status">
            <span className="font-bold tabular-nums">{format(cells[at].value)}</span> <span className="text-muted">{cells[at].label}</span>
          </p>
        ) : null}
        <div className="mt-2 flex items-center justify-end gap-1.5 text-xs text-muted" aria-hidden>
          {t("heatFewer")}
          <span className="h-2 w-16 rounded-pill" style={{ background: "linear-gradient(90deg, color-mix(in oklab, var(--viz-solo) 18%, var(--color-surface)), var(--viz-solo))" }} />
          {t("heatMore")}
        </div>
      </div>
    </ChartCard>
  );
}

/** Steps people pass through (visit → joined): bars from one baseline and each step's share of the one before. */
export type FunnelStep = { label: string; value: number };

export function Funnel({ title, subtitle, steps, format, emptyText, testId, className, locale = "en" }: { title: string; subtitle?: ReactNode; steps: FunnelStep[]; format: (n: number) => string; emptyText?: ReactNode; testId?: string; className?: string; locale?: string }) {
  const t = useTranslations("kit.charts");
  const first = steps[0]?.value ?? 0;
  const table: ChartTable = { columns: [t("step"), t("value"), t("ofPrevious")], rows: steps.map((s, i) => [s.label, format(s.value), i === 0 ? "–" : share(s.value, steps[i - 1].value, locale)]) };
  return (
    <ChartCard title={title} subtitle={subtitle} table={table} state={first > 0 ? "ready" : "empty"} emptyText={emptyText} height={120} testId={testId} className={className}>
      <ol className="space-y-2.5">
        {steps.map((s, i) => (
          <li key={s.label}>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{s.label}</span>
              <span className="shrink-0 font-semibold tabular-nums">
                {format(s.value)}
                {i > 0 ? <span className="ml-1.5 text-xs font-normal text-muted">{t("ofPreviousShort", { share: share(s.value, steps[i - 1].value, locale) })}</span> : null}
              </span>
            </span>
            <span className="mt-1 block h-2.5 rounded-r-[4px] bg-[var(--viz-track)]">
              <span className="viz-grow-x block h-full rounded-r-[4px]" style={{ width: `${first > 0 ? Math.max(1, (s.value / first) * 100) : 0}%`, background: "var(--viz-solo)" }} />
            </span>
          </li>
        ))}
      </ol>
    </ChartCard>
  );
}
