"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Hourglass } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { useAuth } from "@kriraghor/ui/auth";
import { BarChart, HeatStrip, KpiTile, LineChart, RankBars } from "@kriraghor/ui/charts";
import { Button, Card, Notice, SegmentedControl } from "@kriraghor/ui/kit";
import { bucketLabel, bucketLabels, dashboards, dayLabel, dhakaToday, hourLabel, pct, type GymDashboard, type OrganiserDashboard, type OwnerDashboard, type Period, type ShopDashboard } from "@/lib/dashboard";
import { MEASURES, comingLaterItems, rankBy, type DashRole, type Measure } from "@/lib/vendor/analytics";
import { CsvButtons, TileDelta, todayIndex, useCsv, useFmt, useSeriesSubtitle, useSparkLabels } from "./chart-parts";
import { FeesByTournament } from "./FeesByTournament";

/**
 * Round B2 dashboards (M19 §6.3) for shops, gyms and sports organisations, on the chart kit since
 * round 2 (20 Nov 2026): the tiles, the compact cards of the vendor home and the charts and exports
 * of /vendor/analytics. Money in poisha shown as taka; days and hours are Dhaka's; each tile's "i" is
 * the API's own definition in the page's language.
 */
export type AnyDashboard = OwnerDashboard | ShopDashboard | GymDashboard | OrganiserDashboard;
export type Target = { role: DashRole; orgId?: string | null; groundId?: string };

/** The query key of one business's dashboard (shared by the home's strip, its cards and the analytics page). */
export const dashboardKey = (b: Target | null, period: Period, locale: string) => ["business-dashboard", b?.role ?? null, b?.orgId ?? null, b?.groundId ?? "", period, locale] as const;

export function fetchDashboard(b: Target, period: Period, locale: string): Promise<AnyDashboard> {
  if (b.role === "shop_owner") return dashboards.shop(period, locale);
  if (b.role === "gym_owner") return dashboards.gym(period, locale);
  if (b.role === "organiser") return dashboards.organiser(b.orgId ?? "", period, locale);
  return dashboards.owner(period, locale, b.groundId || undefined);
}

export const sameBusiness = (d: AnyDashboard, b: Target) => d.role === b.role && (d.role !== "organiser" || d.organisation.id === b.orgId);

/**
 * One business's dashboard for a period (organisers per organisation, venues optionally per venue).
 * While another period or venue loads, the last answer of the same business stays on screen.
 */
export function useBusinessDashboard(b: Target | null, period: Period, enabled = true) {
  const locale = useLocale();
  const { status } = useAuth();
  return useQuery<AnyDashboard>({
    queryKey: dashboardKey(b, period, locale),
    enabled: enabled && status === "signed_in" && Boolean(b) && (b?.role !== "organiser" || Boolean(b?.orgId)),
    retry: false,
    placeholderData: (prev) => (prev && b && sameBusiness(prev, b) ? prev : undefined),
    queryFn: () => {
      if (!b) throw new Error("no business");
      return fetchDashboard(b, period, locale);
    },
  });
}

/** Why a dashboard did not load, in the person's words (role missing, not a member, or a failure), with Retry for a failure. */
export function DashboardError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useTranslations("dashboard");
  const code = problemOf(error)?.code;
  const known = code === "ROLE_REQUIRED" || code === "NOT_FOUND";
  return (
    <Notice
      tone="error"
      action={
        !known && onRetry ? (
          <Button type="button" size="sm" variant="secondary" onClick={onRetry} data-testid="dashboard-retry">
            {t("retry")}
          </Button>
        ) : undefined
      }
    >
      {code === "ROLE_REQUIRED" ? t("errors.roleRequired") : code === "NOT_FOUND" ? t("errors.orgNotFound") : t("loadFailed")}
    </Notice>
  );
}

const n = (note: Record<string, number> | null | undefined, k: string) => note?.[k] ?? 0;

// ---------------- tiles

export function ShopTiles({ d, compact = false }: { d: ShopDashboard; compact?: boolean }) {
  const t = useTranslations("dashboard");
  const f = useFmt();
  const sparkLabels = useSparkLabels(d.buckets, d.period);
  const { sales, orders, averageOrder, repeatBuyers } = d.tiles;
  return (
    <div className={compact ? "grid grid-cols-2 gap-3 md:grid-cols-3" : "grid grid-cols-2 gap-3 lg:grid-cols-4"} data-testid="shop-tiles" data-compact={compact || undefined}>
      <KpiTile testId="tile-sales" label={t("tiles.sales")} help={d.definitions.sales} value={f.money(sales.value)} delta={<TileDelta value={sales.delta} period={d.period} />} note={t("notes.items", { n: n(sales.note, "items") })} spark={sales.spark} sparkLabels={sparkLabels} sparkFormat={f.money} />
      <KpiTile testId="tile-orders" label={t("tiles.orders")} help={d.definitions.orders} value={f.n(orders.value ?? 0)} delta={<TileDelta value={orders.delta} period={d.period} />} spark={orders.spark} sparkLabels={sparkLabels} sparkFormat={f.n} />
      <KpiTile testId="tile-average-order" label={t("tiles.averageOrder")} help={d.definitions.average_order} value={f.money(averageOrder.value)} delta={<TileDelta value={averageOrder.delta} period={d.period} />} spark={averageOrder.spark} sparkLabels={sparkLabels} sparkFormat={f.money} />
      {compact ? null : <KpiTile testId="tile-repeat-buyers" label={t("tiles.repeatBuyers")} help={d.definitions.repeat_buyers} value={pct(repeatBuyers.value, f.locale)} note={t("notes.last90")} />}
    </div>
  );
}

export function GymTiles({ d, compact = false }: { d: GymDashboard; compact?: boolean }) {
  const t = useTranslations("dashboard");
  const f = useFmt();
  const sparkLabels = useSparkLabels(d.buckets, d.period);
  const { passSales, passesSold, admissions, unusedShare } = d.tiles;
  return (
    <div className={compact ? "grid grid-cols-2 gap-3 md:grid-cols-3" : "grid grid-cols-2 gap-3 lg:grid-cols-4"} data-testid="gym-tiles" data-compact={compact || undefined}>
      <KpiTile testId="tile-pass-sales" label={t("tiles.passSales")} help={d.definitions.pass_sales} value={f.money(passSales.value)} delta={<TileDelta value={passSales.delta} period={d.period} />} spark={passSales.spark} sparkLabels={sparkLabels} sparkFormat={f.money} />
      <KpiTile
        testId="tile-passes-sold"
        label={t("tiles.passesSold")}
        help={d.definitions.passes_sold}
        value={f.n(passesSold.value ?? 0)}
        delta={<TileDelta value={passesSold.delta} period={d.period} />}
        note={compact ? undefined : t("notes.passKinds", { day: f.n(n(passesSold.note, "day")), month: f.n(n(passesSold.note, "month")), quarter: f.n(n(passesSold.note, "quarter")) })}
        spark={passesSold.spark}
        sparkLabels={sparkLabels}
        sparkFormat={f.n}
      />
      <KpiTile testId="tile-admissions" label={t("tiles.admissions")} help={d.definitions.admissions} value={f.n(admissions.value ?? 0)} delta={<TileDelta value={admissions.delta} period={d.period} />} spark={admissions.spark} sparkLabels={sparkLabels} sparkFormat={f.n} />
      {compact ? null : (
        <KpiTile testId="tile-unused" label={t("tiles.unusedShare")} help={d.definitions.unused_share} value={pct(unusedShare.value, f.locale)} delta={<TileDelta value={unusedShare.delta} kind="pts" period={d.period} better="down" />} spark={unusedShare.spark} sparkLabels={sparkLabels} sparkFormat={(v) => pct(v, f.locale)} />
      )}
    </div>
  );
}

export function OrganiserTiles({ d, compact = false }: { d: OrganiserDashboard; compact?: boolean }) {
  const t = useTranslations("dashboard");
  const f = useFmt();
  const sparkLabels = useSparkLabels(d.buckets, d.period);
  const { teams, entryFees, matchesPlayed } = d.tiles;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="organiser-tiles" data-compact={compact || undefined}>
      <KpiTile
        testId="tile-entry-fees"
        label={t("tiles.entryFees")}
        help={d.definitions.entry_fees}
        value={f.money(entryFees.value ?? 0)}
        delta={<TileDelta value={entryFees.delta} period={d.period} />}
        note={compact ? undefined : t("notes.fees", { held: f.money(n(entryFees.note, "held")), released: f.money(n(entryFees.note, "released")), refunded: f.money(n(entryFees.note, "refunded")) })}
        spark={entryFees.spark}
        sparkLabels={sparkLabels}
        sparkFormat={f.money}
      />
      <KpiTile
        testId="tile-teams"
        label={t("tiles.teams")}
        help={d.definitions.teams}
        value={t("ofTotal", { n: teams.value ?? 0, total: n(teams.note, "maxTeams") })}
        note={t("notes.teams", { waiting: f.n(n(teams.note, "waiting")), unpaid: f.n(n(teams.note, "unpaid")), reserve: f.n(n(teams.note, "reserve")) })}
      />
      <KpiTile testId="tile-matches" label={t("tiles.matchesPlayed")} help={d.definitions.matches_played} value={t("ofTotal", { n: f.n(matchesPlayed.value ?? 0), total: f.n(n(matchesPlayed.note, "total")) })} note={t("notes.matches")} />
    </div>
  );
}

/** The tiles of any dashboard but the venue's. */
export function BusinessTiles({ d, compact }: { d: Exclude<AnyDashboard, OwnerDashboard>; compact?: boolean }) {
  if (d.role === "shop_owner") return <ShopTiles d={d} compact={compact} />;
  if (d.role === "gym_owner") return <GymTiles d={d} compact={compact} />;
  return <OrganiserTiles d={d} compact={compact} />;
}

// ---------------- charts (the analytics page)

/** A money line with last year dashed when the API has last year (FR-05). */
function MoneyLine({ title, label, chart, period, refreshing, onCsv, testId }: { title: string; label: string; chart: { points: { key: string; value: number; lastYear: number }[]; lastYearShown: boolean }; period: Period; refreshing?: boolean; onCsv?: () => void; testId: string }) {
  const t = useTranslations("dashboard");
  const f = useFmt();
  const { labels, short } = bucketLabels(
    chart.points.map((p) => p.key),
    period,
    f.locale,
  );
  const subtitle = useSeriesSubtitle(period, short);
  return (
    <LineChart
      title={title}
      subtitle={subtitle}
      labels={labels}
      short={short}
      series={[
        { key: "current", label, values: chart.points.map((p) => p.value) },
        ...(chart.lastYearShown ? [{ key: "lastYear", label: t("legend.lastYear"), values: chart.points.map((p) => p.lastYear), compare: true }] : []),
      ]}
      format={f.money}
      axis={f.axisMoney}
      partialLast
      refreshing={refreshing}
      emptyText={t("empty")}
      onCsv={onCsv}
      testId={testId}
    />
  );
}

/** Counts per day of the period ("this period": the 30 days, this week or this month), today marked. */
function DayBars({ title, label, days, period, refreshing, onCsv, testId }: { title: string; label: string; days: { day: string; value: number }[]; period: Period; refreshing?: boolean; onCsv?: () => void; testId: string }) {
  const t = useTranslations("dashboard");
  const f = useFmt();
  return (
    <BarChart
      title={title}
      subtitle={t(`scope.${period}`)}
      labels={days.map((x) => dayLabel(x.day, f.locale))}
      short={days.map((x) => bucketLabel(x.day, f.locale))}
      series={[{ key: "count", label, values: days.map((x) => x.value) }]}
      highlight={todayIndex(
        days.map((x) => x.day),
        dhakaToday(),
      )}
      format={f.n}
      axis={f.axisCount}
      integer
      refreshing={refreshing}
      emptyText={t("empty")}
      onCsv={onCsv}
      testId={testId}
    />
  );
}

export function ShopAnalytics({ d, refreshing }: { d: ShopDashboard; refreshing?: boolean }) {
  const t = useTranslations("dashboard");
  const f = useFmt();
  const csv = useCsv(d.period);
  const [measure, setMeasure] = useState<Measure>("value");
  const units = (v: number) => t("units", { n: v });
  const show = measure === "units" ? units : f.money;
  const other = (r: { units: number; value: number }) => (measure === "units" ? f.money(r.value) : units(r.units));
  const categories = rankBy(d.charts.salesByCategory, measure, (c) => c.name || t("charts.noCategory"), (c) => c.categoryId ?? "none", other);
  const sellers = rankBy(d.charts.bestSellers, measure, (b) => b.title, (b) => b.productId, other);
  const later = comingLaterItems(d.comingLater, (k) => t.has(`comingLater.${k}`));
  return (
    <div className="space-y-6" data-testid="shop-analytics">
      <ShopTiles d={d} />
      <div className="grid gap-4 lg:grid-cols-2">
        <MoneyLine title={t("charts.sales")} label={t("tiles.sales")} chart={d.charts.weeklySales} period={d.period} refreshing={refreshing} onCsv={() => csv.run("shop_orders")} testId="chart-sales" />
        <DayBars title={t("charts.ordersByDay")} label={t("tiles.orders")} days={d.charts.ordersByDay} period={d.period} refreshing={refreshing} testId="chart-orders-by-day" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-muted">
          {t("measure.label")}
        </p>
        <div data-testid="shop-measure">
          <SegmentedControl size="sm" label={t("measure.label")} value={measure} onChange={setMeasure} options={MEASURES.map((m) => ({ value: m, label: t(`measure.${m}`), testId: `measure-${m}` }))} />
        </div>
      </div>
      <div className="-mt-2 grid gap-4 lg:grid-cols-2">
        <RankBars title={t("charts.salesByCategory")} subtitle={t(`scope.${d.period}`)} items={categories} format={show} emptyText={t("empty")} testId="chart-sales-by-category" />
        <RankBars title={t("charts.bestSellersTitle")} subtitle={t("charts.last30")} items={sellers} format={show} emptyText={t("empty")} onCsv={() => csv.run("shop_sales_by_product")} testId="chart-best-sellers" />
      </div>
      {later.length ? (
        <Card data-testid="coming-later">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-control bg-surface-2 text-muted">
              <Hourglass size={20} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg font-bold">{t("comingLater.title")}</p>
              <p className="text-sm font-semibold">{later.map((k) => t(`comingLater.${k}`)).join(" · ")}</p>
              <p className="mt-1 text-sm text-muted">{d.definitions.conversion ?? t("comingLater.body")}</p>
            </div>
          </div>
        </Card>
      ) : null}
      <CsvButtons
        csv={csv}
        sets={[
          { dataset: "shop_orders", label: t("csv.shopOrders") },
          { dataset: "shop_sales_by_product", label: t("csv.shopProducts") },
        ]}
      />
      <p className="text-xs text-muted">{t("shopNote")}</p>
    </div>
  );
}

/** The gym's numbers here are a fallback: the gym owner's reports live on gym.kriraghor.com (the business switch goes there). */
export function GymAnalytics({ d, refreshing }: { d: GymDashboard; refreshing?: boolean }) {
  const t = useTranslations("dashboard");
  const f = useFmt();
  const csv = useCsv(d.period);
  const hours = Array.from({ length: 24 }, (_, h) => ({ label: hourLabel(h, f.locale), value: d.charts.busiestHours.find((x) => x.hour === h)?.admissions ?? 0 }));
  const packages = [...d.charts.salesByPackage]
    .sort((a, b) => b.value - a.value)
    .map((p) => {
      // The kind only when the package title doesn't already say it.
      const kind = t.has(`passKind.${p.kind}`) ? t(`passKind.${p.kind}`) : "";
      return { key: p.packageId, label: !kind || p.title.trim().toLowerCase() === kind.toLowerCase() ? p.title : `${p.title} · ${kind}`, value: p.value };
    });
  return (
    <div className="space-y-6" data-testid="gym-analytics">
      <GymTiles d={d} />
      <div className="grid gap-4 lg:grid-cols-2">
        <MoneyLine title={t("charts.passSales")} label={t("tiles.passSales")} chart={d.charts.sales} period={d.period} refreshing={refreshing} onCsv={() => csv.run("gym_passes")} testId="chart-pass-sales" />
        <DayBars title={t("charts.admissionsByDay")} label={t("tiles.admissions")} days={d.charts.admissionsByDay} period={d.period} refreshing={refreshing} onCsv={() => csv.run("gym_admissions")} testId="chart-admissions-by-day" />
        <HeatStrip title={t("charts.busiestHoursDhaka")} subtitle={t(`scope.${d.period}`)} cells={hours} format={(v) => t("admissionsN", { n: v })} emptyText={t("empty")} testId="chart-gym-hours" />
        <RankBars title={t("charts.salesByPackage")} subtitle={t(`scope.${d.period}`)} items={packages} format={f.money} emptyText={t("empty")} testId="chart-sales-by-package" />
      </div>
      <CsvButtons
        csv={csv}
        sets={[
          { dataset: "gym_passes", label: t("csv.gymPasses") },
          { dataset: "gym_admissions", label: t("csv.gymAdmissions") },
        ]}
      />
      <p className="text-xs text-muted">{t("gymNote")}</p>
    </div>
  );
}

export function OrganiserAnalytics({ d, refreshing }: { d: OrganiserDashboard; refreshing?: boolean }) {
  const t = useTranslations("dashboard");
  const f = useFmt();
  const rows = d.charts.registrationsOverTime;
  const { labels, short } = bucketLabels(
    rows.map((r) => r.key),
    d.period,
    f.locale,
  );
  const subtitle = useSeriesSubtitle(d.period, short);
  const eventsHref = `/vendor/events/${d.organisation.id}`;
  return (
    <div className="space-y-6" data-testid="organiser-analytics">
      <OrganiserTiles d={d} />
      <div className="grid gap-4 lg:grid-cols-2">
        <LineChart
          title={t("charts.registrations")}
          subtitle={subtitle}
          labels={labels}
          short={short}
          series={[
            { key: "registered", label: t("legend.registered"), values: rows.map((r) => r.registered) },
            { key: "approved", label: t("legend.approved"), values: rows.map((r) => r.approved) },
          ]}
          format={f.n}
          axis={f.axisCount}
          integer
          area={false}
          partialLast
          refreshing={refreshing}
          emptyText={t("empty")}
          testId="chart-registrations"
        />
        <FeesByTournament items={d.charts.feesByEvent} eventsHref={eventsHref} />
      </div>
      <p className="text-sm text-muted">
        {t("organiserCsv")}{" "}
        <Link href={eventsHref} className="font-semibold text-brand-text">
          {t("openEvents")}
        </Link>
      </p>
      <p className="text-xs text-muted">{t("organiserNote")}</p>
    </div>
  );
}
