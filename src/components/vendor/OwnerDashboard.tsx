"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { bucketLabel, compactTaka, dashboards, downloadCsv, hourLabel, pct, type OwnerDashboard as Data, type Period } from "@/lib/dashboard";
import { ownerTrust } from "@/lib/vendor/trust";
import { ChartBars, ChartLine, ChartRank, ChartSplit, DeltaBadge, KpiTile } from "../charts/Charts";
import { Notice } from "../ui";

const PERIODS: Period[] = ["7w", "qtr", "yr"];

function PeriodSwitch({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const t = useTranslations("dashboard");
  return (
    <div className="flex gap-1" role="tablist" aria-label={t("period")}>
      {PERIODS.map((p) => (
        <button key={p} type="button" role="tab" aria-selected={p === period} onClick={() => onChange(p)} className={`min-h-11 border-2 px-3 text-sm font-semibold ${p === period ? "border-brand bg-brand text-white" : "border-line"}`}>
          {t(`periods.${p}`)}
        </button>
      ))}
    </div>
  );
}

/** The owner's four tiles (M19 §6.2). */
export function OwnerTiles({ d }: { d: Data }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const vs = t(`vs.${d.period}`);
  const n = d.tiles.bookings.note as { app?: number; walkIn?: number; series?: number } | null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="owner-tiles">
      <KpiTile
        testId="tile-revenue"
        label={t("tiles.revenue")}
        help={d.definitions.revenue}
        value={compactTaka(d.tiles.revenue.value, locale)}
        delta={<DeltaBadge value={d.tiles.revenue.delta} kind="pct" label={vs} />}
        note={t("notes.bookedAhead", { amount: compactTaka((d.tiles.revenue.note as { bookedAhead?: number } | null)?.bookedAhead ?? 0, locale) })}
        spark={d.tiles.revenue.spark}
      />
      <KpiTile testId="tile-occupancy" label={t("tiles.occupancy")} help={d.definitions.occupancy} value={pct(d.tiles.occupancy.value, locale)} delta={<DeltaBadge value={d.tiles.occupancy.delta} kind="pts" label={vs} />} spark={d.tiles.occupancy.spark} />
      <KpiTile
        testId="tile-bookings"
        label={t("tiles.bookings")}
        help={d.definitions.bookings}
        value={String(d.tiles.bookings.value ?? 0)}
        delta={<DeltaBadge value={d.tiles.bookings.delta} kind="pct" label={vs} />}
        note={t("notes.sources", { app: n?.app ?? 0, walkIn: n?.walkIn ?? 0, series: n?.series ?? 0 })}
        spark={d.tiles.bookings.spark}
      />
      <KpiTile testId="tile-repeat" label={t("tiles.repeatTeams")} help={d.definitions.repeat_teams} value={pct(d.tiles.repeatTeams.value, locale)} note={t("notes.last90")} />
    </div>
  );
}

/** "Needs your action" (FR-11). */
export function ActionList({ items }: { items: { key: string; count: number; href: string; severity: string }[] }) {
  const t = useTranslations("dashboard");
  if (!items.length) return <p className="text-sm text-muted">{t("actions.none")}</p>;
  return (
    <ul className="divide-y-2 divide-line border-y-2 border-line" data-testid="actions">
      {items.map((a) => (
        <li key={`${a.key}-${a.href}`}>
          <Link href={a.href} className="flex min-h-12 items-center gap-3 py-2 hover:bg-surface-2">
            <span className={`h-2.5 w-2.5 shrink-0 ${a.severity === "high" ? "bg-danger" : "bg-brand"}`} aria-hidden="true" />
            <span className="flex-1">{t(`actions.${a.key}`, { n: a.count })}</span>
            <span aria-hidden="true">→</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** vendor home for an active owner: tiles, actions and the period switch. */
/** M18: the owner's reliability, with what lowers it (shown to members once there are enough bookings). */
function OwnerReliability() {
  const t = useTranslations("vendorTrust");
  const q = useQuery({ queryKey: ["my-trust"], queryFn: () => ownerTrust.myTrust() });
  const s = q.data?.items.find((x) => x.kind === "owner") as { score: number | null; shown: boolean; sample: number; minSample?: number; detail?: { owner_cancel?: number; owner_dispute_lost?: number } } | undefined;
  if (!s) return null;
  return (
    <div className="border-2 border-line p-4" data-testid="owner-reliability">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{t("reliability")}</p>
      <p className="text-3xl font-extrabold tabular-nums">{s.score === null ? "–" : `${s.score}%`}</p>
      <p className="text-sm text-muted">{s.shown ? t("reliabilityShown", { n: s.sample }) : t("reliabilityHidden", { n: s.sample, min: s.minSample ?? 0 })}</p>
      <p className="mt-1 text-xs text-muted">{t("reliabilityHow", { cancels: s.detail?.owner_cancel ?? 0, disputes: s.detail?.owner_dispute_lost ?? 0 })}</p>
    </div>
  );
}

export function OwnerOverview() {
  const t = useTranslations("dashboard");
  const { status } = useAuth();
  const [period, setPeriod] = useState<Period>("7w");
  const d = useQuery({ queryKey: ["owner-dashboard", period], enabled: status === "signed_in", queryFn: () => dashboards.owner(period) });
  const actions = useQuery({ queryKey: ["owner-actions"], enabled: status === "signed_in", queryFn: () => dashboards.ownerActions() });
  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">{t("overview")}</h2>
        <PeriodSwitch period={period} onChange={setPeriod} />
      </div>
      {d.isPending ? <div className="h-36 animate-pulse bg-surface-2" /> : d.isError || !d.data ? <Notice tone="error">{t("loadFailed")}</Notice> : <OwnerTiles d={d.data} />}
      <OwnerReliability />
      <div>
        <h2 className="text-lg font-extrabold">{t("actions.title")}</h2>
        <div className="mt-2">{actions.data ? <ActionList items={actions.data.items} /> : <div className="h-16 animate-pulse bg-surface-2" />}</div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/vendor/analytics" className="inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white hover:bg-brand-hover" data-testid="open-analytics">
          {t("openAnalytics")}
        </Link>
        {d.data?.asOf ? <span className="text-xs text-muted">{t("asOf", { time: new Date(d.data.asOf).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" }) })}</span> : null}
      </div>
    </div>
  );
}

/** /vendor/analytics: the four charts and the CSV exports (M19 §4.2, FR-06, FR-22). */
export function OwnerAnalytics() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { status } = useAuth();
  const [period, setPeriod] = useState<Period>("7w");
  const [exportError, setExportError] = useState(false);
  const d = useQuery({ queryKey: ["owner-dashboard", period], enabled: status === "signed_in", queryFn: () => dashboards.owner(period) });
  const money = (n: number) => compactTaka(n, locale);
  const csv = (dataset: string) => downloadCsv("api", "/me/dashboard/export", { dataset, period }).catch(() => setExportError(true));
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">{t("analytics")}</h1>
          <p className="mt-1 max-w-2xl text-muted">{t("analyticsLead")}</p>
        </div>
        <PeriodSwitch period={period} onChange={setPeriod} />
      </div>
      {d.isPending ? (
        <div className="mt-6 h-96 animate-pulse bg-surface-2" />
      ) : d.isError || !d.data ? (
        <div className="mt-6">
          <Notice tone="error">{t("loadFailed")}</Notice>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <OwnerTiles d={d.data} />
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartLine
              title={d.data.charts.weeklyRevenue.lastYearShown ? t("charts.revenueVsLastYear") : t("charts.revenue")}
              points={d.data.charts.weeklyRevenue.points}
              compare={d.data.charts.weeklyRevenue.lastYearShown ? d.data.charts.weeklyRevenue.points.map((p) => p.lastYear) : null}
              format={money}
              labelOf={(k) => bucketLabel(k, locale)}
            />
            <ChartBars
              title={t("charts.bookingsByDay")}
              bars={d.data.charts.bookingsByDay.map((b) => ({ label: new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${b.day}T12:00:00Z`)), value: b.value }))}
              format={(n) => String(n)}
            />
            <ChartRank title={t("charts.busiestHours")} items={d.data.charts.busiestHours.map((h) => ({ label: hourLabel(h.hour, locale), value: h.hours }))} format={(n) => t("hours", { n })} empty={t("empty")} />
            <ChartSplit title={t("charts.revenueByGround")} parts={d.data.charts.revenueByGround.map((g) => ({ label: g.name, value: g.value }))} format={money} empty={t("empty")} />
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => csv("owner_bookings")} className="min-h-11 border-2 border-line px-4 font-semibold" data-testid="csv-bookings">
              {t("csv.bookings")}
            </button>
            <button type="button" onClick={() => csv("owner_revenue")} className="min-h-11 border-2 border-line px-4 font-semibold">
              {t("csv.revenue")}
            </button>
          </div>
          {exportError ? <Notice tone="error">{t("csv.failed")}</Notice> : null}
          <p className="text-xs text-muted">{t("revenueNote")}</p>
        </div>
      )}
    </section>
  );
}
