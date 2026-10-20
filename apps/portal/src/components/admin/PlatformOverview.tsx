"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { bucketLabel, compactTaka, dashboards, downloadCsv, pct, type Period } from "@/lib/dashboard";
import { ChartLine, ChartRank, ChartSplit, DeltaBadge, KpiTile } from "@kriraghor/ui/charts";
import { Notice } from "@kriraghor/ui/primitives";
import { ActionList } from "../vendor/OwnerDashboard";

const PERIODS: Period[] = ["7w", "qtr", "yr"];

/**
 * Admin home, platform overview (M19 §6.4): GTV with venue money (Q106), fee revenue from the ledger,
 * take rate, bookings, esports, members and the review queue; monthly volume, by vertical, top areas.
 * Masters and staff with view_analytics (Q104); everyone on staff sees "Needs your action".
 */
export function PlatformOverview({ canSee }: { canSee: boolean }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const [period, setPeriod] = useState<Period>("yr");
  const [csvFailed, setCsvFailed] = useState(false);
  const d = useQuery({ queryKey: ["platform-overview", period], enabled: canSee, queryFn: () => dashboards.platform(period) });
  const actions = useQuery({ queryKey: ["staff-actions"], queryFn: () => dashboards.staffActions() });
  const money = (n: number) => compactTaka(n, locale);
  const vs = t(`vs.${period}`);
  return (
    <div className="mt-8 space-y-6" data-testid="platform-overview">
      <div>
        <h2 className="text-lg font-extrabold">{t("actions.title")}</h2>
        <div className="mt-2">{actions.data ? <ActionList items={actions.data.items} /> : <div className="h-12 animate-pulse bg-surface-2" />}</div>
      </div>
      {!canSee ? null : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold">{t("platform")}</h2>
            <div className="flex gap-1" role="tablist" aria-label={t("period")}>
              {PERIODS.map((p) => (
                <button key={p} type="button" role="tab" aria-selected={p === period} onClick={() => setPeriod(p)} className={`min-h-11 border-2 px-3 text-sm font-semibold ${p === period ? "border-brand bg-brand text-white" : "border-line"}`}>
                  {t(`periods.${p}`)}
                </button>
              ))}
            </div>
          </div>
          {d.isPending ? (
            <div className="h-48 animate-pulse bg-surface-2" />
          ) : d.isError || !d.data ? (
            <Notice tone="error">{t("loadFailed")}</Notice>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiTile testId="tile-gtv" label={t("tiles.gtv")} help={d.data.definitions.gtv} value={money(d.data.tiles.gtv.value ?? 0)} delta={<DeltaBadge value={d.data.tiles.gtv.delta} kind="pct" label={vs} />} note={t("notes.online", { amount: money((d.data.tiles.gtv.note as { online?: number } | null)?.online ?? 0) })} spark={d.data.tiles.gtv.spark} />
                <KpiTile testId="tile-fee" label={t("tiles.feeRevenue")} help={d.data.definitions.fee_revenue} value={money(d.data.tiles.feeRevenue.value ?? 0)} delta={<DeltaBadge value={d.data.tiles.feeRevenue.delta} kind="pct" label={vs} />} spark={d.data.tiles.feeRevenue.spark} />
                <KpiTile label={t("tiles.takeRate")} help={d.data.definitions.take_rate} value={pct(d.data.tiles.takeRate.value, locale)} delta={<DeltaBadge value={d.data.tiles.takeRate.delta} kind="pts" label={vs} />} />
                <KpiTile label={t("tiles.platformBookings")} help={d.data.definitions.bookings} value={String(d.data.tiles.bookings.value ?? 0)} delta={<DeltaBadge value={d.data.tiles.bookings.delta} kind="pct" label={vs} />} spark={d.data.tiles.bookings.spark} />
                <KpiTile label={t("tiles.esportsEntries")} help={d.data.definitions.esports_entries} value={String(d.data.tiles.esportsEntries.value ?? 0)} delta={<DeltaBadge value={d.data.tiles.esportsEntries.delta} kind="pct" label={vs} />} spark={d.data.tiles.esportsEntries.spark} />
                <KpiTile label={t("tiles.prizesPaid")} help={d.data.definitions.prizes_paid} value={money(d.data.tiles.prizesPaid.value ?? 0)} spark={d.data.tiles.prizesPaid.spark} />
                <KpiTile label={t("tiles.verifiedMembers")} value={String(d.data.tiles.verifiedMembers.value ?? 0)} note={t("notes.businesses", { n: (d.data.tiles.verifiedMembers.note as { businesses?: number } | null)?.businesses ?? 0 })} />
                <KpiTile label={t("tiles.waiting")} value={String(d.data.tiles.waitingForReview.value ?? 0)} note={t("notes.overdue", { n: (d.data.tiles.waitingForReview.note as { overdue?: number } | null)?.overdue ?? 0 })} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartLine title={t("charts.volume")} points={d.data.charts.volume} format={money} labelOf={(k) => bucketLabel(k, locale)} />
                <ChartSplit title={t("charts.byVertical")} parts={d.data.charts.volumeByVertical.map((v) => ({ label: t(`verticals.${v.vertical}`), value: v.value }))} format={money} empty={t("empty")} />
                <ChartRank title={t("charts.topAreas")} items={d.data.charts.topAreas.map((a) => ({ label: a.name, value: a.bookings }))} format={(n) => String(n)} empty={t("empty")} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="min-h-11 border-2 border-line px-4 font-semibold" onClick={() => downloadCsv("admin", "/admin/analytics/export", { dataset: "platform_daily", period }).catch(() => setCsvFailed(true))}>
                  {t("csv.platform")}
                </button>
                {d.data.asOf ? <span className="text-xs text-muted">{t("asOf", { time: new Date(d.data.asOf).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" }) })}</span> : null}
              </div>
              {csvFailed ? <Notice tone="error">{t("csv.failed")}</Notice> : null}
            </>
          )}
        </>
      )}
    </div>
  );
}
