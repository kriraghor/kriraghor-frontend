"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, ChartLineUp, Hourglass } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { useAuth } from "@kriraghor/ui/auth";
import { ButtonLink, Card, Skeleton } from "@kriraghor/ui/kit";
import { ChartBars, ChartLine, ChartRank, ChartSplit, DeltaBadge, KpiTile } from "@kriraghor/ui/charts";
import { Notice } from "@kriraghor/ui/primitives";
import { bucketLabel, compactTaka, dashboards, pct, type GymDashboard, type OrganiserDashboard, type OwnerDashboard, type Period, type ShopDashboard } from "@/lib/dashboard";
import { analyticsHref, dayBars, hourBars, lineSeries, pairSeries, type DashRole } from "@/lib/vendor/analytics";
import { CsvButtons, PeriodSwitch } from "./OwnerDashboard";

/**
 * Round B2 dashboards (M19 §6.3) for shops, gyms and sports organisations: the tiles (also on the
 * vendor home) and the charts and exports of /vendor/analytics. Money in poisha shown as taka;
 * days and hours are Dhaka's; each tile's "i" is the API's own definition in the page's language.
 */
export type AnyDashboard = OwnerDashboard | ShopDashboard | GymDashboard | OrganiserDashboard;
type Target = { role: DashRole; orgId?: string | null };

/** One business's dashboard for a period (organisers per organisation). */
export function useBusinessDashboard(b: Target | null, period: Period) {
  const locale = useLocale();
  const { status } = useAuth();
  return useQuery<AnyDashboard>({
    queryKey: ["business-dashboard", b?.role ?? null, b?.orgId ?? null, period, locale],
    enabled: status === "signed_in" && Boolean(b) && (b?.role !== "organiser" || Boolean(b?.orgId)),
    retry: false,
    queryFn: () => {
      if (!b) throw new Error("no business");
      if (b.role === "shop_owner") return dashboards.shop(period, locale);
      if (b.role === "gym_owner") return dashboards.gym(period, locale);
      if (b.role === "organiser") return dashboards.organiser(b.orgId ?? "", period, locale);
      return dashboards.owner(period, locale);
    },
  });
}

/** Why a dashboard did not load, in the person's words (role missing, not a member, or a failure). */
export function DashboardError({ error }: { error: unknown }) {
  const t = useTranslations("dashboard");
  const code = problemOf(error)?.code;
  return <Notice tone="error">{code === "ROLE_REQUIRED" ? t("errors.roleRequired") : code === "NOT_FOUND" ? t("errors.orgNotFound") : t("loadFailed")}</Notice>;
}

const n = (note: Record<string, number> | null | undefined, k: string) => note?.[k] ?? 0;

// ---------------- tiles

export function ShopTiles({ d }: { d: ShopDashboard }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const vs = t(`vs.${d.period}`);
  const { sales, orders, averageOrder, repeatBuyers } = d.tiles;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="shop-tiles">
      <KpiTile testId="tile-sales" label={t("tiles.sales")} help={d.definitions.sales} value={compactTaka(sales.value, locale)} delta={<DeltaBadge value={sales.delta} kind="pct" label={vs} />} note={t("notes.items", { n: n(sales.note, "items") })} spark={sales.spark} />
      <KpiTile testId="tile-orders" label={t("tiles.orders")} help={d.definitions.orders} value={String(orders.value ?? 0)} delta={<DeltaBadge value={orders.delta} kind="pct" label={vs} />} spark={orders.spark} />
      <KpiTile testId="tile-average-order" label={t("tiles.averageOrder")} help={d.definitions.average_order} value={compactTaka(averageOrder.value, locale)} delta={<DeltaBadge value={averageOrder.delta} kind="pct" label={vs} />} spark={averageOrder.spark} />
      <KpiTile testId="tile-repeat-buyers" label={t("tiles.repeatBuyers")} help={d.definitions.repeat_buyers} value={pct(repeatBuyers.value, locale)} note={t("notes.last90")} />
    </div>
  );
}

export function GymTiles({ d }: { d: GymDashboard }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const vs = t(`vs.${d.period}`);
  const { passSales, passesSold, admissions, unusedShare } = d.tiles;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="gym-tiles">
      <KpiTile testId="tile-pass-sales" label={t("tiles.passSales")} help={d.definitions.pass_sales} value={compactTaka(passSales.value, locale)} delta={<DeltaBadge value={passSales.delta} kind="pct" label={vs} />} spark={passSales.spark} />
      <KpiTile
        testId="tile-passes-sold"
        label={t("tiles.passesSold")}
        help={d.definitions.passes_sold}
        value={String(passesSold.value ?? 0)}
        delta={<DeltaBadge value={passesSold.delta} kind="pct" label={vs} />}
        note={t("notes.passKinds", { day: n(passesSold.note, "day"), month: n(passesSold.note, "month"), quarter: n(passesSold.note, "quarter") })}
        spark={passesSold.spark}
      />
      <KpiTile testId="tile-admissions" label={t("tiles.admissions")} help={d.definitions.admissions} value={String(admissions.value ?? 0)} delta={<DeltaBadge value={admissions.delta} kind="pct" label={vs} />} spark={admissions.spark} />
      <KpiTile testId="tile-unused" label={t("tiles.unusedShare")} help={d.definitions.unused_share} value={pct(unusedShare.value, locale)} delta={<DeltaBadge value={unusedShare.delta} kind="pts" label={vs} />} spark={unusedShare.spark} />
    </div>
  );
}

export function OrganiserTiles({ d }: { d: OrganiserDashboard }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const vs = t(`vs.${d.period}`);
  const { teams, entryFees, matchesPlayed } = d.tiles;
  const money = (v: number) => compactTaka(v, locale);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3" data-testid="organiser-tiles">
      <KpiTile
        testId="tile-teams"
        label={t("tiles.teams")}
        help={d.definitions.teams}
        value={t("ofTotal", { n: teams.value ?? 0, total: n(teams.note, "maxTeams") })}
        note={t("notes.teams", { waiting: n(teams.note, "waiting"), unpaid: n(teams.note, "unpaid"), reserve: n(teams.note, "reserve") })}
      />
      <KpiTile
        testId="tile-entry-fees"
        label={t("tiles.entryFees")}
        help={d.definitions.entry_fees}
        value={money(entryFees.value ?? 0)}
        delta={<DeltaBadge value={entryFees.delta} kind="pct" label={vs} />}
        note={t("notes.fees", { held: money(n(entryFees.note, "held")), released: money(n(entryFees.note, "released")), refunded: money(n(entryFees.note, "refunded")) })}
        spark={entryFees.spark}
      />
      <KpiTile testId="tile-matches" label={t("tiles.matchesPlayed")} help={d.definitions.matches_played} value={t("ofTotal", { n: matchesPlayed.value ?? 0, total: n(matchesPlayed.note, "total") })} note={t("notes.matches")} />
    </div>
  );
}

/** The tiles of any dashboard. */
export function BusinessTiles({ d }: { d: Exclude<AnyDashboard, OwnerDashboard> }) {
  if (d.role === "shop_owner") return <ShopTiles d={d} />;
  if (d.role === "gym_owner") return <GymTiles d={d} />;
  return <OrganiserTiles d={d} />;
}

// ---------------- charts (the analytics page)

export function ShopAnalytics({ d }: { d: ShopDashboard }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const money = (v: number) => compactTaka(v, locale);
  const sales = lineSeries(d.charts.weeklySales);
  const days = dayBars(d.charts.ordersByDay, locale);
  return (
    <div className="space-y-6" data-testid="shop-analytics">
      <ShopTiles d={d} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartLine title={t("charts.sales")} points={sales.points} compare={sales.compare} legend={{ current: t("legend.thisPeriod"), compare: t("legend.lastYear") }} format={money} labelOf={(k) => bucketLabel(k, locale)} />
        <ChartBars title={t("charts.ordersByDay")} bars={days.bars} values={days.values} format={(v) => String(v)} />
        <ChartSplit title={t("charts.salesByCategory")} parts={d.charts.salesByCategory.map((c) => ({ label: c.name || t("charts.noCategory"), value: c.value }))} format={money} empty={t("empty")} />
        <ChartRank title={t("charts.bestSellers")} items={d.charts.bestSellers.map((b) => ({ label: b.title, value: b.units }))} format={(v) => t("units", { n: v })} empty={t("empty")} />
      </div>
      {d.comingLater.length ? (
        <Card data-testid="coming-later">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-control bg-surface-2 text-muted">
              <Hourglass size={20} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg font-bold">{t("comingLater.title")}</p>
              <p className="text-sm font-semibold">{d.comingLater.map((k) => (t.has(`comingLater.${k}`) ? t(`comingLater.${k}`) : k)).join(" · ")}</p>
              <p className="mt-1 text-sm text-muted">{d.definitions.conversion ?? t("comingLater.body")}</p>
            </div>
          </div>
        </Card>
      ) : null}
      <CsvButtons period={d.period} sets={[{ dataset: "shop_orders", label: t("csv.shopOrders") }, { dataset: "shop_sales_by_product", label: t("csv.shopProducts") }]} />
      <p className="text-xs text-muted">{t("shopNote")}</p>
    </div>
  );
}

export function GymAnalytics({ d }: { d: GymDashboard }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const money = (v: number) => compactTaka(v, locale);
  const sales = lineSeries(d.charts.sales);
  const days = dayBars(d.charts.admissionsByDay, locale);
  return (
    <div className="space-y-6" data-testid="gym-analytics">
      <GymTiles d={d} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartLine title={t("charts.passSales")} points={sales.points} compare={sales.compare} legend={{ current: t("legend.thisPeriod"), compare: t("legend.lastYear") }} format={money} labelOf={(k) => bucketLabel(k, locale)} />
        <ChartBars title={t("charts.admissionsByDay")} bars={days.bars} values={days.values} format={(v) => String(v)} />
        <ChartBars title={t("charts.busiestHoursDhaka")} bars={hourBars(d.charts.busiestHours.map((h) => ({ hour: h.hour, value: h.admissions })), locale)} values={false} format={(v) => t("admissionsN", { n: v })} />
        <ChartRank title={t("charts.salesByPackage")} items={d.charts.salesByPackage.map((p) => {
            // The kind only when the package title doesn't already say it ("Day pass", not "Day pass · Day pass").
            const kind = t(`passKind.${p.kind}`);
            return { label: p.title.trim().toLowerCase() === kind.toLowerCase() ? p.title : `${p.title} · ${kind}`, value: p.value };
          })} format={money} empty={t("empty")} />
      </div>
      <CsvButtons period={d.period} sets={[{ dataset: "gym_passes", label: t("csv.gymPasses") }, { dataset: "gym_admissions", label: t("csv.gymAdmissions") }]} />
      <p className="text-xs text-muted">{t("gymNote")}</p>
    </div>
  );
}

export function OrganiserAnalytics({ d }: { d: OrganiserDashboard }) {
  const t = useTranslations("dashboard");
  const ts = useTranslations("sportsConsole");
  const locale = useLocale();
  const money = (v: number) => compactTaka(v, locale);
  const regs = pairSeries(d.charts.registrationsOverTime, "registered", "approved");
  const eventsHref = `/vendor/events/${d.organisation.id}`;
  return (
    <div className="space-y-6" data-testid="organiser-analytics">
      <OrganiserTiles d={d} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartLine title={t("charts.registrations")} points={regs.points} compare={regs.compare} legend={{ current: t("legend.registered"), compare: t("legend.approved") }} format={(v) => String(v)} labelOf={(k) => bucketLabel(k, locale)} />
        <figure className="min-w-0 surface-card p-4" data-testid="fees-by-event">
          <figcaption className="font-bold">{t("charts.feesByEvent")}</figcaption>
          {d.charts.feesByEvent.length ? (
            <ul className="mt-3 divide-y divide-line">
              {d.charts.feesByEvent.map((e) => (
                <li key={e.tournamentId} className="py-2">
                  <Link href={`${eventsHref}/e/${e.tournamentId}`} className="flex min-h-11 flex-wrap items-baseline gap-x-3 gap-y-0.5 no-underline hover:underline">
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink">{e.name}</span>
                    <span className="font-display font-bold tabular-nums text-ink">{money(e.collected)}</span>
                    <span className="w-full text-xs text-muted">
                      {ts.has(`status.${e.status}`) ? ts(`status.${e.status}`) : e.status} · {t("notes.fees", { held: money(e.held), released: money(e.released), refunded: money(e.refunded) })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">{t("empty")}</p>
          )}
        </figure>
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

// ---------------- the vendor home's overview per business

/**
 * A business's tiles on the vendor home with the period switch and the way into its analytics (as
 * the venue owner's Overview). Organisers get one row per sports organisation, named.
 */
export function BusinessOverview({ role, orgId, title }: { role: Exclude<DashRole, "ground_owner">; orgId?: string; title?: string }) {
  const t = useTranslations("dashboard");
  const [period, setPeriod] = useState<Period>("7w");
  const d = useBusinessDashboard({ role, orgId }, period);
  const data = d.data && d.data.role !== "ground_owner" ? d.data : null;
  return (
    <div className="space-y-4" data-testid={`overview-${role}${orgId ? `-${orgId}` : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="min-w-0 font-display text-xl font-bold">{title ?? t("overview")}</h3>
        <PeriodSwitch period={period} onChange={setPeriod} />
      </div>
      {d.isPending ? <Skeleton className="h-36 rounded-card" /> : d.isError ? <DashboardError error={d.error} /> : data ? <BusinessTiles d={data} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <ButtonLink href={analyticsHref(role, orgId)} variant="secondary" icon={<ChartLineUp size={18} aria-hidden />} iconEnd={<ArrowRight size={16} aria-hidden />} data-testid={`open-analytics-${role}`}>
          {t("openAnalytics")}
        </ButtonLink>
        {d.data?.asOf ? <span className="text-xs text-muted">{t("asOf", { time: new Date(d.data.asOf).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" }) })}</span> : null}
      </div>
    </div>
  );
}
