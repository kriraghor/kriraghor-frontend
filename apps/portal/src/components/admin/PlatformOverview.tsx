"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { KpiTile, LineChart, RankBars } from "@kriraghor/ui/charts";
import { Notice, SectionHeading, Skeleton } from "@kriraghor/ui/kit";
import { bucketLabels, dashboards, pct, type Period, type PlatformOverview as Data } from "@/lib/dashboard";
import { AsOf, CsvButtons, PeriodSwitch, TileDelta, useCsv, useFmt, useSeriesSubtitle, useSparkLabels } from "../vendor/chart-parts";

/**
 * The platform numbers on the admin home (M19 §6.4, FR-30; dashboards round 3 on the chart kit), for
 * masters and staff with view_analytics (Q104). Two parts share one answer: the tiles at the top of
 * the page (GTV with venue money, Q106; fee revenue from the ledger; take rate; bookings; esports
 * entries; prizes paid; verified members; the review queue) and the charts under "Needs your action"
 * (volume with its online part, volume by vertical, top areas). The period lives in the URL; the
 * definitions come back in the page's language.
 */
export function usePlatform(period: Period, locale: string, enabled: boolean) {
  return useQuery({ queryKey: ["platform-overview", period, locale], enabled, placeholderData: keepPreviousData, queryFn: () => dashboards.platform(period, locale) });
}

const note = (d: Data, tile: keyof Data["tiles"], key: string) => (d.tiles[tile].note as Record<string, number> | null | undefined)?.[key] ?? 0;

export function PlatformTiles({ period, onPeriod, locale }: { period: Period; onPeriod: (p: Period) => void; locale: string }) {
  const t = useTranslations("dashboard");
  const f = useFmt();
  const q = usePlatform(period, locale, true);
  const d = q.data;
  const sparkLabels = useSparkLabels(d?.buckets ?? [], d?.period ?? period);
  return (
    <section className="flex flex-col gap-4" data-testid="platform-overview" aria-busy={q.isFetching || undefined}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionHeading title={t("platform")} />
          <AsOf iso={d?.asOf} className="-mt-1 text-xs text-muted" />
        </div>
        <PeriodSwitch period={period} onChange={onPeriod} />
      </div>
      {q.isPending ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="platform-loading">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-card" />
          ))}
        </div>
      ) : q.isError || !d ? (
        <Notice tone="error">{t("loadFailed")}</Notice>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile testId="tile-gtv" label={t("tiles.gtv")} help={d.definitions.gtv} value={f.money(d.tiles.gtv.value ?? 0)} delta={<TileDelta value={d.tiles.gtv.delta} period={d.period} />} note={t("notes.online", { amount: f.money(note(d, "gtv", "online")) })} spark={d.tiles.gtv.spark} sparkLabels={sparkLabels} sparkFormat={f.money} />
          <KpiTile testId="tile-fee" label={t("tiles.feeRevenue")} help={d.definitions.fee_revenue} value={f.money(d.tiles.feeRevenue.value ?? 0)} delta={<TileDelta value={d.tiles.feeRevenue.delta} period={d.period} />} spark={d.tiles.feeRevenue.spark} sparkLabels={sparkLabels} sparkFormat={f.money} />
          <KpiTile testId="tile-take-rate" label={t("tiles.takeRate")} help={d.definitions.take_rate} value={pct(d.tiles.takeRate.value, f.locale)} delta={<TileDelta value={d.tiles.takeRate.delta} kind="pts" period={d.period} />} spark={d.tiles.takeRate.spark} sparkLabels={sparkLabels} sparkFormat={(v) => pct(v, f.locale)} />
          <KpiTile testId="tile-bookings" label={t("tiles.platformBookings")} help={d.definitions.bookings} value={f.n(d.tiles.bookings.value ?? 0)} delta={<TileDelta value={d.tiles.bookings.delta} period={d.period} />} spark={d.tiles.bookings.spark} sparkLabels={sparkLabels} sparkFormat={f.n} />
          <KpiTile testId="tile-esports" label={t("tiles.esportsEntries")} help={d.definitions.esports_entries} value={f.n(d.tiles.esportsEntries.value ?? 0)} delta={<TileDelta value={d.tiles.esportsEntries.delta} period={d.period} />} spark={d.tiles.esportsEntries.spark} sparkLabels={sparkLabels} sparkFormat={f.n} />
          <KpiTile testId="tile-prizes" label={t("tiles.prizesPaid")} help={d.definitions.prizes_paid} value={f.money(d.tiles.prizesPaid.value ?? 0)} delta={<TileDelta value={d.tiles.prizesPaid.delta} period={d.period} />} spark={d.tiles.prizesPaid.spark} sparkLabels={sparkLabels} sparkFormat={f.money} />
          <KpiTile testId="tile-members" label={t("tiles.verifiedMembers")} value={f.n(d.tiles.verifiedMembers.value ?? 0)} note={t("notes.businesses", { n: note(d, "verifiedMembers", "businesses") })} />
          <KpiTile
            testId="tile-waiting"
            label={t("tiles.waiting")}
            value={f.n(d.tiles.waitingForReview.value ?? 0)}
            note={t("notes.overdue", { n: note(d, "waitingForReview", "overdue") })}
            tone={note(d, "waitingForReview", "overdue") > 0 ? "warning" : undefined}
          />
        </div>
      )}
    </section>
  );
}

export function PlatformCharts({ period, locale }: { period: Period; locale: string }) {
  const t = useTranslations("dashboard");
  const f = useFmt();
  const q = usePlatform(period, locale, true);
  const csv = useCsv(period, { audience: "admin", path: "/admin/analytics/export" });
  const d = q.data;
  const volume = d?.charts.volume ?? [];
  const { labels, short } = bucketLabels(
    volume.map((p) => p.key),
    d?.period ?? period,
    f.locale,
  );
  const subtitle = useSeriesSubtitle(d?.period ?? period, short);
  if (q.isError) return null; // the tiles above already say the numbers could not load
  const state = q.isPending ? ("loading" as const) : undefined;
  const scope = t(`scope.${d?.period ?? period}`);
  const refreshing = q.isFetching && q.isPlaceholderData;
  return (
    <section className="flex flex-col gap-4" data-testid="platform-charts">
      <div className="grid gap-4 lg:grid-cols-2">
        <LineChart
          title={t("charts.volume")}
          subtitle={subtitle}
          labels={labels}
          short={short}
          series={[
            { key: "gtv", label: t("tiles.gtv"), values: volume.map((p) => p.value) },
            { key: "online", label: t("legend.online"), values: volume.map((p) => p.online ?? 0) },
          ]}
          format={f.money}
          axis={f.axisMoney}
          partialLast
          state={state}
          refreshing={refreshing}
          emptyText={t("empty")}
          onCsv={() => csv.run("platform_daily")}
          testId="chart-volume"
          className="lg:col-span-2"
        />
        {d ? (
          <>
            <RankBars
              title={t("charts.byVertical")}
              subtitle={scope}
              items={[...d.charts.volumeByVertical].sort((a, b) => b.value - a.value).map((v) => ({ key: v.vertical, label: t.has(`verticals.${v.vertical}`) ? t(`verticals.${v.vertical}`) : v.vertical, value: v.value }))}
              format={f.money}
              emptyText={t("empty")}
              testId="chart-by-vertical"
            />
            <RankBars title={t("charts.topAreas")} subtitle={scope} items={d.charts.topAreas.map((a) => ({ key: a.areaId ?? "other", label: a.name, value: a.bookings }))} format={f.n} emptyText={t("empty")} testId="chart-top-areas" />
          </>
        ) : (
          <Skeleton className="h-64 rounded-card lg:col-span-2" />
        )}
      </div>
      <CsvButtons csv={csv} sets={[{ dataset: "platform_daily", label: t("csv.platform"), testId: "csv-platform" }]} />
    </section>
  );
}
