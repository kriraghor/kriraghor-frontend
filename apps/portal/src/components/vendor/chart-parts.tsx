"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DownloadSimple } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { ChartCard, DeltaBadge, compactTaka as axisTaka, compact, count } from "@kriraghor/ui/charts";
import { Notice, SegmentedControl, Skeleton } from "@kriraghor/ui/kit";
import { PERIODS, asOfLabel, bucketLabels, compactTaka, csvErrorKey, downloadCsv, type Period } from "@/lib/dashboard";

/**
 * The pieces every vendor dashboard shares (round 2, the chart kit): number formats in the page's
 * language, the period switch, the change badge, the "Updated 10:42" line, the CSV downloads and the
 * loading layout. Money is poisha shown as taka; figures use Bangla digits in bn.
 */
export function useFmt() {
  const locale = useLocale();
  return {
    locale,
    /** A money figure: "৳4.3 lakh" from ৳1 lakh, otherwise the full taka. */
    money: (poisha: number | null | undefined) => compactTaka(poisha, locale),
    /** A money axis tick, one unit for the whole axis. */
    axisMoney: (poisha: number, top: number) => axisTaka(poisha, locale, top),
    n: (v: number | null | undefined) => (v === null || v === undefined ? "–" : count(v, locale)),
    axisCount: (v: number, top: number) => compact(v, locale, top),
  };
}

export function PeriodSwitch({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const t = useTranslations("dashboard");
  return <SegmentedControl size="sm" label={t("period")} value={period} onChange={onChange} options={PERIODS.map((p) => ({ value: p, label: t(`periods.${p}`), testId: `period-${p}` }))} />;
}

/** A tile's change against the period before ("vs the 30 days before"), in the page's digits. */
export function TileDelta({ value, kind = "pct", period, better }: { value: number | null; kind?: "pct" | "pts"; period: Period; better?: "up" | "down" }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  return <DeltaBadge value={value} kind={kind} label={t(`vs.${period}`)} better={better} locale={locale} />;
}

/** The labels under a dashboard's sparks: its buckets in full ("Sat 21 Nov", "12 Oct", "Oct 26"). */
export function useSparkLabels(buckets: readonly { key: string }[], period: Period) {
  const locale = useLocale();
  return bucketLabels(
    buckets.map((b) => b.key),
    period,
    locale,
  ).labels;
}

/** How a line's points are spaced, and the range they cover: "Day by day · 23 Oct – 21 Nov". */
export function useSeriesSubtitle(period: Period, short: readonly string[]) {
  const t = useTranslations("dashboard");
  const by = t(period === "30d" ? "charts.byDay" : period === "yr" ? "charts.byMonth" : "charts.byWeek");
  return short.length ? `${by} · ${short[0]} – ${short[short.length - 1]}` : by;
}

/** "Updated 10:42" (Dhaka time), shown once per page. */
export function AsOf({ iso, className }: { iso: string | null | undefined; className?: string }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const time = asOfLabel(iso, locale);
  if (!time) return null;
  return (
    <p className={className ?? "text-xs text-muted"} data-testid="as-of">
      {t("asOf", { time })}
    </p>
  );
}

/** The CSV exports of a dashboard (FR-22): one download at a time, and the reason when one fails. */
export function useCsv(period: Period) {
  const t = useTranslations("dashboard");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (dataset: string) => {
    if (busy) return;
    setBusy(dataset);
    setError(null);
    try {
      await downloadCsv("api", "/me/dashboard/export", { dataset, period });
    } catch (e) {
      setError(t(csvErrorKey(problemOf(e)?.code)));
    } finally {
      setBusy(null);
    }
  };
  return { busy, error, run: (dataset: string) => void run(dataset) };
}

type CsvSet = { dataset: string; label: string; testId?: string };

/** The download buttons (testid csv-exports, each csv-<dataset> unless named), sharing a chart card's CSV state. */
export function CsvButtons({ csv, sets, note }: { csv: ReturnType<typeof useCsv>; sets: CsvSet[]; note?: ReactNode }) {
  const t = useTranslations("dashboard");
  return (
    <div className="space-y-3" data-testid="csv-exports">
      <div className="flex flex-wrap gap-3">
        {sets.map((s) => (
          <button
            key={s.dataset}
            type="button"
            disabled={csv.busy !== null}
            onClick={() => csv.run(s.dataset)}
            className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line-strong/60 px-4 font-semibold transition-colors hover:bg-surface-2 disabled:opacity-60"
            data-testid={s.testId ?? `csv-${s.dataset}`}
          >
            <DownloadSimple size={18} aria-hidden />
            {csv.busy === s.dataset ? t("csv.preparing") : s.label}
          </button>
        ))}
      </div>
      {note ? <p className="text-xs text-muted">{note}</p> : null}
      {csv.error ? <Notice tone="error">{csv.error}</Notice> : null}
    </div>
  );
}

/** The analytics layout while the first answer loads: tile skeletons and charts in their loading state. */
export function AnalyticsSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="space-y-6" data-testid="analytics-loading">
      <div className={`grid grid-cols-2 gap-3 ${tiles === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
        {Array.from({ length: tiles }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-card" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <ChartCard key={i} title={<span aria-hidden className="kg-shimmer inline-block h-4 w-40 rounded bg-surface-2" />} state="loading" />
        ))}
      </div>
    </div>
  );
}

/** Index of today in a list of days (the current, unfinished one), or undefined. */
export function todayIndex(days: readonly string[], today: string): number | undefined {
  const i = days.indexOf(today);
  return i < 0 ? undefined : i;
}
