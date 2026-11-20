"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CaretLeft, CaretRight, DownloadSimple } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { BarChart, DeltaBadge, HeatStrip, KpiTile, LineChart, RankBars, SplitBar, compact, compactTaka, pctChange, ptsChange, type Better } from "@kriraghor/ui/charts";
import { csvErrorKey, downloadCsv } from "@kriraghor/ui/csv";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { MonthPicker as MonthField } from "@kriraghor/ui/date";
import { Button, Card, IconButton, Notice } from "@kriraghor/ui/kit";
import { shiftMonth } from "@/lib/gym-manage";
import { churnPct, exportQuery, fillVisitDays, reasonsByCount, METHOD_ORDER, type ExportDataset, type Period, type Report } from "@/lib/gym-money";
import { useFmt } from "./common";

export type Figures = Pick<Report, "members" | "money" | "attendance">;
export type Previous = Report["previous"];

/** The month in the URL: back, forward (never past this month) and a month field. */
export function MonthPicker({ month, max, onChange }: { month: string; max: string; onChange: (m: string) => void }) {
  const t = useTranslations("gm");
  const f = useFmt();
  return (
    <div className="flex items-center gap-1" data-testid="month-picker">
      <IconButton label={t("reports.prevMonth")} variant="secondary" onClick={() => onChange(shiftMonth(month, -1))} data-testid="month-prev">
        <CaretLeft size={18} aria-hidden />
      </IconButton>
      <MonthField id="report-month" label={t("reports.month")} labelHidden value={month} max={max} clearable={false} onChange={(v) => v && onChange(v)} triggerClassName="min-h-11 w-auto min-w-44 text-sm font-semibold" testId="report-month" />
      <IconButton label={t("reports.nextMonth")} variant="secondary" onClick={() => onChange(shiftMonth(month, 1))} disabled={month >= max} data-testid="month-next">
        <CaretRight size={18} aria-hidden />
      </IconButton>
      <span className="hidden text-sm text-muted sm:inline">{f.month(month)}</span>
    </div>
  );
}

/**
 * One period's figures (M24-FR-71): members, money and attendance as KPI tiles, month over month,
 * daily visits, busiest hours (Dhaka), revenue by package, by method, left by reason and the overdue
 * list. The same shape serves one gym and the all-gyms totals (FR-74).
 */
export function ReportFigures({ r, previous, period, today, gymId, testId }: { r: Figures; previous?: Previous; period: { from: string; to: string }; today: string; gymId?: string; testId?: string }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const churn = churnPct(r.members.churn);
  const reasons = reasonsByCount(r.members.left.byReason);
  const methods = METHOD_ORDER.filter((m) => r.money.byMethod[m] !== undefined).concat(Object.keys(r.money.byMethod).filter((m) => !METHOD_ORDER.includes(m)));
  const overdue = r.money.overdueList ?? [];
  const vs = previous ? t("reports.vsPrevious", { period: `${f.short(previous.period.from)}–${f.short(previous.period.to)}` }) : "";
  // A change on a tile: against the period before, coloured by whether more is better.
  const delta = (cur: number | null | undefined, prev: number | null | undefined, better: Better = "up") =>
    previous ? <DeltaBadge value={pctChange(cur, prev)} kind="pct" label={vs} better={better} /> : undefined;
  const end = period.to < today ? period.to : today;
  const visits = fillVisitDays(r.attendance.daily, period.from, end);
  const dayLabel = (d: string) => `${f.weekday(d)} ${f.short(d)}`;
  const hours = Array.from({ length: 24 }, (_, h) => ({ label: `${String(h).padStart(2, "0")}:00`, short: String(h).padStart(2, "0"), value: r.attendance.busiestHours.find((x) => x.hour === h)?.visits ?? 0 }));
  const checkins = Object.entries(r.attendance.byMethod ?? {});
  const partial = period.from <= today && today <= period.to;
  return (
    <div className="flex flex-col gap-6" data-testid={testId}>
      <Group title={t("reports.members")}>
        <KpiTile testId="kpi-active" label={t("reports.activeAtEnd")} value={f.n(r.members.activeAtEnd)} delta={delta(r.members.activeAtEnd, previous?.members.activeAtEnd)} note={t("reports.activeAtStart", { n: f.n(r.members.activeAtStart) })} />
        <KpiTile testId="kpi-new" label={t("reports.new")} value={f.n(r.members.new)} delta={delta(r.members.new, previous?.members.new)} note={t("reports.renewals", { n: f.n(r.members.renewals) })} />
        <KpiTile
          testId="kpi-left"
          label={t("reports.left")}
          value={f.n(r.members.left.total)}
          delta={previous ? <DeltaBadge value={pctChange(r.members.left.total, previous.members.left)} kind="pct" label={vs} better="down" /> : undefined}
          note={churn === null ? null : t("reports.churn", { pct: f.n(churn) })}
          help={t("reports.churnHelp")}
        />
        <KpiTile testId="kpi-active-now" label={t("reports.activeNow")} value={f.n(r.members.activeNow)} />
      </Group>
      <Group title={t("reports.money")}>
        <KpiTile testId="kpi-collected" label={t("reports.collected")} value={f.taka(r.money.collectedPoisha)} delta={delta(r.money.collectedPoisha, previous?.money.collectedPoisha)} note={t("reports.onlineCounter", { online: f.taka(r.money.onlinePoisha), counter: f.taka(r.money.counterPoisha) })} />
        <KpiTile testId="kpi-outstanding" label={t("reports.outstanding")} value={f.taka(r.money.outstandingPoisha)} help={t("reports.outstandingHelp")} />
        <KpiTile testId="kpi-overdue" label={t("reports.overdue")} value={f.taka(r.money.overduePoisha)} tone={r.money.overduePoisha > 0 ? "danger" : undefined} />
      </Group>
      <div className="grid gap-4 lg:grid-cols-2">
        <LineChart
          title={t("reports.collectedDaily")}
          subtitle={`${f.short(period.from)}–${f.short(end)}`}
          labels={(r.money.daily ?? []).map((d) => dayLabel(d.date))}
          short={(r.money.daily ?? []).map((d) => f.short(d.date))}
          series={[{ key: "collected", label: t("reports.collected"), values: (r.money.daily ?? []).map((d) => d.collectedPoisha) }]}
          format={(v) => f.taka(v)}
          axis={(v, top) => compactTaka(v, f.locale, top)}
          partialLast={partial}
          emptyText={t("reports.none")}
          testId="chart-collected-daily"
        />
        <BarChart
          title={t("reports.monthOverMonth")}
          labels={r.money.monthOverMonth.map((m) => f.month(m.month))}
          short={r.money.monthOverMonth.map((m) => f.month(m.month).split(" ")[0].slice(0, 3))}
          series={[{ key: "collected", label: t("reports.collected"), values: r.money.monthOverMonth.map((m) => m.collectedPoisha) }]}
          highlight={r.money.monthOverMonth.length - 1}
          format={(v) => f.taka(v)}
          axis={(v, top) => compactTaka(v, f.locale, top)}
          emptyText={t("reports.none")}
          testId="chart-months"
        />
        <RankBars title={t("reports.byPackage")} items={r.money.byPackage.map((p) => ({ label: p.title, value: p.collectedPoisha }))} format={(v) => f.taka(v)} emptyText={t("reports.none")} testId="chart-packages" />
        <SplitBar title={t("reports.byMethod")} parts={methods.map((m) => ({ key: m, label: t.has(`method.${m}`) ? t(`method.${m}`) : m, value: r.money.byMethod[m] ?? 0 }))} format={(v) => f.taka(v)} emptyText={t("reports.none")} locale={f.locale} testId="chart-methods" />
      </div>
      <Group title={t("reports.attendance")}>
        <KpiTile testId="kpi-visits" label={t("reports.visits")} value={f.n(r.attendance.visits)} delta={delta(r.attendance.visits, previous?.attendance.visits)} />
        <KpiTile
          testId="kpi-average"
          label={t("reports.averagePerActive")}
          value={r.attendance.averagePerActive == null ? "–" : f.n(Math.round(r.attendance.averagePerActive * 10) / 10)}
          delta={previous && r.attendance.averagePerActive != null && previous.attendance.averagePerActive != null ? <DeltaBadge value={ptsChange(r.attendance.averagePerActive, previous.attendance.averagePerActive)} kind="pts" label={vs} /> : undefined}
        />
        <KpiTile testId="kpi-visit-length" label={t("reports.visitLength")} value={r.attendance.averageVisitMinutes == null ? "–" : t("reports.minutesN", { n: r.attendance.averageVisitMinutes })} help={t("reports.visitLengthHelp")} />
        <KpiTile testId="kpi-not-seen" label={t("reports.notSeen", { days: r.attendance.notSeenDays })} value={f.n(r.attendance.notSeen)} />
      </Group>
      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart
          title={t("reports.dailyVisits")}
          subtitle={`${f.short(period.from)}–${f.short(end)}`}
          labels={visits.map((d) => dayLabel(d.date))}
          short={visits.map((d) => f.short(d.date))}
          series={[{ key: "visits", label: t("reports.visits"), values: visits.map((d) => d.visits) }]}
          highlight={partial ? visits.length - 1 : undefined}
          format={(v) => t("reports.visitsN", { n: v })}
          axis={(v, top) => compact(v, f.locale, top)}
          integer
          emptyText={t("reports.none")}
          testId="chart-visits"
        />
        <div className="flex flex-col gap-4">
          <HeatStrip title={t("reports.busiestHours")} cells={hours} format={(v) => t("reports.visitsN", { n: v })} emptyText={t("reports.none")} testId="chart-hours" />
          <SplitBar title={t("reports.checkinMethods")} parts={checkins.map(([m, n]) => ({ key: m, label: t.has(`checkinMethod.${m}`) ? t(`checkinMethod.${m}`) : m, value: n }))} format={f.n} emptyText={t("reports.none")} locale={f.locale} testId="chart-checkin-methods" />
        </div>
        <RankBars title={t("reports.leftByReason")} items={reasons.map(([k, n]) => ({ key: k, label: t.has(`leftReason.${k}`) ? t(`leftReason.${k}`) : k, value: n }))} format={f.n} emptyText={t("reports.noneLeft")} testId="left-reasons" />
      </div>
      {overdue.length ? (
        <Card padded={false} className="p-4 sm:p-5" data-testid="overdue-list">
          <h3 className="font-bold">
            {t("reports.overdueList")} <span className="text-sm font-normal text-muted tabular-nums">({f.n(overdue.length)})</span>
          </h3>
          <ul className="mt-2 max-h-96 divide-y divide-line overflow-y-auto text-sm">
            {overdue.map((o) => (
              <li key={o.dueId} className="flex flex-wrap items-center justify-between gap-2 py-2 transition-colors hover:bg-surface-2/60">
                <span className="min-w-0">
                  {gymId ? (
                    <Link href={`/manage/${gymId}/members/${o.memberId}`} className="font-semibold hover:underline">
                      {o.displayName}
                    </Link>
                  ) : (
                    <span className="font-semibold">{o.displayName}</span>
                  )}{" "}
                  <span className="text-xs text-muted tabular-nums">{o.memberCode}</span>
                  <span className="block text-xs text-muted">{t("profile.dueOn", { date: f.short(o.dueOn) })}</span>
                </span>
                <span className="font-semibold tabular-nums text-danger">{f.taka(o.outstandingPoisha)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-display text-lg font-bold">{title}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
    </section>
  );
}

/** The owner's CSV exports for the month (M24-FR-73), fetched with the session and saved. */
export function ExportButtons({ gymId, period }: { gymId: string; period: Period }) {
  const t = useTranslations("gm");
  const [busy, setBusy] = useState<ExportDataset | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const run = async (dataset: ExportDataset) => {
    setBusy(dataset);
    setProblem(null);
    try {
      const name = "month" in period ? period.month : `${period.from}_${period.to}`;
      await downloadCsv("api", `/manage/gyms/${gymId}/reports/export`, exportQuery(dataset, period), `${dataset}-${name}.csv`);
    } catch (e) {
      setProblem(t(`reports.${csvErrorKey(problemOf(e)?.code)}`));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card padded={false} className="flex flex-col gap-2 p-4" data-testid="report-exports">
      <h2 className="font-display text-lg font-bold">{t("reports.exports")}</h2>
      <p className="text-sm text-muted">{t("reports.exportsLead")}</p>
      <div className="flex flex-wrap gap-2">
        {(["members", "payments", "attendance"] as const).map((d) => (
          <Button key={d} type="button" size="sm" variant="secondary" icon={<DownloadSimple size={16} aria-hidden />} busy={busy === d} onClick={() => void run(d)} data-testid={`export-${d}`}>
            {t(`reports.export.${d}`)}
          </Button>
        ))}
      </div>
      {problem ? <Notice tone="error">{problem}</Notice> : null}
    </Card>
  );
}
