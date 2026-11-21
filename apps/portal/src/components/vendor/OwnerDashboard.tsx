"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { CaretRight } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { BarChart, KpiTile, LineChart, RankBars } from "@kriraghor/ui/charts";
import { Badge, Card } from "@kriraghor/ui/kit";
import { bucketLabel, bucketLabels, dayLabel, deskHref, dhakaToday, hourRange, pct, type OwnerDashboard as Data } from "@/lib/dashboard";
import { busiestHours } from "@/lib/vendor/analytics";
import { ownerTrust } from "@/lib/vendor/trust";
import { CsvButtons, TileDelta, todayIndex, useCsv, useFmt, useSeriesSubtitle, useSparkLabels } from "./chart-parts";

export { PeriodSwitch, CsvButtons } from "./chart-parts";
export { PERIODS } from "@/lib/dashboard";

/** The venue owner's four tiles (M19 §6.2): the API's own definitions as each tile's "i". */
export function OwnerTiles({ d }: { d: Data }) {
  const t = useTranslations("dashboard");
  const f = useFmt();
  const sparkLabels = useSparkLabels(d.buckets, d.period);
  const { revenue, occupancy, bookings, repeatTeams } = d.tiles;
  const n = bookings.note as { app?: number; walkIn?: number; series?: number } | null;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="owner-tiles">
      <KpiTile
        testId="tile-revenue"
        label={t("tiles.revenue")}
        help={d.definitions.revenue}
        value={f.money(revenue.value)}
        delta={<TileDelta value={revenue.delta} period={d.period} />}
        note={t("notes.bookedAhead", { amount: f.money((revenue.note as { bookedAhead?: number } | null)?.bookedAhead ?? 0) })}
        spark={revenue.spark}
        sparkLabels={sparkLabels}
        sparkFormat={f.money}
      />
      <KpiTile
        testId="tile-occupancy"
        label={t("tiles.occupancy")}
        help={d.definitions.occupancy}
        value={pct(occupancy.value, f.locale)}
        delta={<TileDelta value={occupancy.delta} kind="pts" period={d.period} />}
        spark={occupancy.spark}
        sparkLabels={sparkLabels}
        sparkFormat={(v) => pct(v, f.locale)}
      />
      <KpiTile
        testId="tile-bookings"
        label={t("tiles.bookings")}
        help={d.definitions.bookings}
        value={f.n(bookings.value ?? 0)}
        delta={<TileDelta value={bookings.delta} period={d.period} />}
        note={t("notes.sources", { app: f.n(n?.app ?? 0), walkIn: f.n(n?.walkIn ?? 0), series: f.n(n?.series ?? 0) })}
        spark={bookings.spark}
        sparkLabels={sparkLabels}
        sparkFormat={f.n}
      />
      <KpiTile testId="tile-repeat" label={t("tiles.repeatTeams")} help={d.definitions.repeat_teams} value={pct(repeatTeams.value, f.locale)} note={t("notes.last90")} />
    </div>
  );
}

/** The vendor home's venue card (round 2): revenue, occupancy and bookings for the chosen period. */
export function VenueSnapshot({ d }: { d: Data }) {
  const t = useTranslations("dashboard");
  const f = useFmt();
  const sparkLabels = useSparkLabels(d.buckets, d.period);
  const { revenue, occupancy, bookings } = d.tiles;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="owner-tiles" data-compact>
      <KpiTile testId="tile-revenue" label={t("tiles.revenue")} help={d.definitions.revenue} value={f.money(revenue.value)} delta={<TileDelta value={revenue.delta} period={d.period} />} spark={revenue.spark} sparkLabels={sparkLabels} sparkFormat={f.money} />
      <KpiTile testId="tile-occupancy" label={t("tiles.occupancy")} help={d.definitions.occupancy} value={pct(occupancy.value, f.locale)} delta={<TileDelta value={occupancy.delta} kind="pts" period={d.period} />} spark={occupancy.spark} sparkLabels={sparkLabels} sparkFormat={(v) => pct(v, f.locale)} />
      <KpiTile testId="tile-bookings" label={t("tiles.bookings")} help={d.definitions.bookings} value={f.n(bookings.value ?? 0)} delta={<TileDelta value={bookings.delta} period={d.period} />} spark={bookings.spark} sparkLabels={sparkLabels} sparkFormat={f.n} />
    </div>
  );
}

/** `tag` names the business a line belongs to (Round B3: a staff member working at several places). */
type ActionRow = { key: string; count: number; href: string; severity: string; dueAt?: string | null; role?: string; tag?: string };

/**
 * "Needs your action" (FR-11): most urgent first, each line a link to the desk that clears it. Old
 * desk paths are moved to the current ones; with several businesses each line says whose it is.
 */
export function ActionList({ items }: { items: ActionRow[] }) {
  const t = useTranslations("dashboard");
  const tp = useTranslations("panel");
  const locale = useLocale();
  if (!items.length) return <p className="text-sm text-muted">{t("actions.none")}</p>;
  const due = (iso: string) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(iso));
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface" data-testid="actions">
      {items.map((a) => (
        <li key={`${a.role ?? ""}-${a.tag ?? ""}-${a.key}-${a.href}`}>
          <Link href={deskHref(a.href)} className="flex min-h-14 items-center gap-3 px-4 py-2.5 no-underline transition-colors hover:bg-surface-2" data-testid="action-item">
            <span className={`size-2.5 shrink-0 rounded-full ${a.severity === "high" ? "bg-danger" : a.severity === "low" ? "bg-line-strong" : "bg-brand"}`} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">{t.has(`actions.${a.key}`) ? t(`actions.${a.key}`, { n: a.count }) : t("actions.other", { n: a.count })}</span>
              {a.dueAt || a.role || a.tag ? (
                <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {a.role && tp.has(`roles.${a.role}`) ? <Badge>{tp(`roles.${a.role}`)}</Badge> : null}
                  {a.tag ? <Badge>{a.tag}</Badge> : null}
                  {a.dueAt ? <span>{t("actions.due", { time: due(a.dueAt) })}</span> : null}
                </span>
              ) : null}
            </span>
            {a.severity === "high" ? <Badge tone="danger">{t("actions.urgent")}</Badge> : null}
            <CaretRight size={18} className="shrink-0 text-muted" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** M18: the owner's reliability, with what lowers it (shown to members once there are enough bookings). */
export function OwnerReliability() {
  const t = useTranslations("vendorTrust");
  const q = useQuery({ queryKey: ["my-trust"], queryFn: () => ownerTrust.myTrust() });
  const s = q.data?.items.find((x) => x.kind === "owner") as { score: number | null; shown: boolean; sample: number; minSample?: number; detail?: { owner_cancel?: number; owner_dispute_lost?: number } } | undefined;
  if (!s) return null;
  return (
    <Card data-testid="owner-reliability">
      <p className="text-sm font-semibold text-muted">{t("reliability")}</p>
      <p className="mt-1 font-display text-3xl font-bold tabular">{s.score === null ? "–" : `${s.score}%`}</p>
      <p className="text-sm text-muted">{s.shown ? t("reliabilityShown", { n: s.sample }) : t("reliabilityHidden", { n: s.sample, min: s.minSample ?? 0 })}</p>
      <p className="mt-1 text-xs text-muted">{t("reliabilityHow", { cancels: s.detail?.owner_cancel ?? 0, disputes: s.detail?.owner_dispute_lost ?? 0 })}</p>
    </Card>
  );
}

/**
 * The venue part of /vendor/analytics (M19 §4.2, FR-06, FR-22; round 2 on the chart kit): the four
 * tiles; revenue with last year dashed; bookings by day; the busiest hours (the API's top six,
 * ranked); revenue by venue (only with more than one venue and no venue chosen); the CSV exports.
 * `groundId` is the venue the numbers are filtered to ("" = all venues).
 */
export function VenueAnalytics({ d, groundId = "", refreshing }: { d: Data; groundId?: string; refreshing?: boolean }) {
  const t = useTranslations("dashboard");
  const f = useFmt();
  const csv = useCsv(d.period);
  const rev = d.charts.weeklyRevenue;
  const { labels, short } = bucketLabels(
    rev.points.map((p) => p.key),
    d.period,
    f.locale,
  );
  const subtitle = useSeriesSubtitle(d.period, short);
  const days = d.charts.bookingsByDay;
  const hours = busiestHours(d.charts.busiestHours, (h) => h.hours);
  const grounds = [...d.charts.revenueByGround].sort((a, b) => b.value - a.value);
  const scope = t(`scope.${d.period}`);
  return (
    <div className="space-y-6" data-testid="venue-analytics">
      <OwnerTiles d={d} />
      <div className="grid gap-4 lg:grid-cols-2">
        <LineChart
          title={t("charts.revenue")}
          subtitle={subtitle}
          labels={labels}
          short={short}
          series={[
            { key: "revenue", label: t("tiles.revenue"), values: rev.points.map((p) => p.value) },
            ...(rev.lastYearShown ? [{ key: "lastYear", label: t("legend.lastYear"), values: rev.points.map((p) => p.lastYear), compare: true }] : []),
          ]}
          format={f.money}
          axis={f.axisMoney}
          partialLast
          refreshing={refreshing}
          emptyText={t("empty")}
          onCsv={() => csv.run("owner_revenue")}
          testId="chart-revenue"
        />
        <BarChart
          title={t("charts.bookingsByDay")}
          subtitle={scope}
          labels={days.map((x) => dayLabel(x.day, f.locale))}
          short={days.map((x) => bucketLabel(x.day, f.locale))}
          series={[{ key: "bookings", label: t("tiles.bookings"), values: days.map((x) => x.value) }]}
          highlight={todayIndex(
            days.map((x) => x.day),
            dhakaToday(),
          )}
          format={f.n}
          axis={f.axisCount}
          integer
          refreshing={refreshing}
          emptyText={t("empty")}
          onCsv={() => csv.run("owner_bookings")}
          testId="chart-bookings-by-day"
        />
        <RankBars
          title={t("charts.busiestHours")}
          subtitle={`${t("charts.busiestHoursTop")} · ${scope}`}
          items={hours.map((h) => ({ key: String(h.hour), label: hourRange(h.hour, f.locale), value: h.value }))}
          format={(v) => t("hours", { n: v })}
          emptyText={t("empty")}
          testId="chart-busiest-hours"
        />
        {!groundId && grounds.length > 1 ? (
          <RankBars title={t("charts.revenueByGround")} subtitle={scope} items={grounds.map((g) => ({ key: g.groundId, label: g.name, value: g.value }))} format={f.money} emptyText={t("empty")} testId="chart-revenue-by-ground" />
        ) : null}
      </div>
      <CsvButtons
        csv={csv}
        sets={[
          { dataset: "owner_bookings", label: t("csv.bookings"), testId: "csv-bookings" },
          { dataset: "owner_revenue", label: t("csv.revenue") },
        ]}
        note={groundId ? t("ground.csvNote") : undefined}
      />
      <p className="text-xs text-muted">{t("revenueNote")}</p>
    </div>
  );
}
