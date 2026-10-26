"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CaretLeft, CaretRight, DownloadSimple } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { ChartBars, ChartLine, ChartRank, ChartSplit, KpiTile } from "@kriraghor/ui/charts";
import { csvErrorKey, downloadCsv } from "@kriraghor/ui/csv";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { Button, Card, IconButton, Notice } from "@kriraghor/ui/kit";
import { shiftMonth } from "@/lib/gym-manage";
import { churnPct, dayBars, exportQuery, hourBars, reasonsByCount, type ExportDataset, type Report } from "@/lib/gym-money";
import { useFmt } from "./common";

export type Figures = Pick<Report, "members" | "money" | "attendance">;

/** The month in the URL: back, forward (never past this month) and a month field. */
export function MonthPicker({ month, max, onChange }: { month: string; max: string; onChange: (m: string) => void }) {
  const t = useTranslations("gm");
  const f = useFmt();
  return (
    <div className="flex items-center gap-1" data-testid="month-picker">
      <IconButton label={t("reports.prevMonth")} variant="secondary" onClick={() => onChange(shiftMonth(month, -1))} data-testid="month-prev">
        <CaretLeft size={18} aria-hidden />
      </IconButton>
      <label className="sr-only" htmlFor="report-month">
        {t("reports.month")}
      </label>
      <input id="report-month" type="month" value={month} max={max} onChange={(e) => e.target.value && onChange(e.target.value)} className="min-h-11 rounded-control border border-line bg-surface px-3 text-sm font-semibold" data-testid="report-month" />
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
export function ReportFigures({ r, gymId, testId }: { r: Figures; gymId?: string; testId?: string }) {
  const t = useTranslations("gm");
  const f = useFmt();
  const churn = churnPct(r.members.churn);
  const reasons = reasonsByCount(r.members.left.byReason);
  const methods = Object.entries(r.money.byMethod).filter(([, v]) => v > 0);
  const overdue = r.money.overdueList ?? [];
  return (
    <div className="flex flex-col gap-4" data-testid={testId}>
      <Group title={t("reports.members")}>
        <KpiTile testId="kpi-active" label={t("reports.activeAtEnd")} value={f.n(r.members.activeAtEnd)} note={t("reports.activeAtStart", { n: f.n(r.members.activeAtStart) })} />
        <KpiTile testId="kpi-new" label={t("reports.new")} value={f.n(r.members.new)} note={t("reports.renewals", { n: f.n(r.members.renewals) })} />
        <KpiTile testId="kpi-left" label={t("reports.left")} value={f.n(r.members.left.total)} note={churn === null ? null : t("reports.churn", { pct: f.n(churn) })} />
        <KpiTile testId="kpi-active-now" label={t("reports.activeNow")} value={f.n(r.members.activeNow)} />
      </Group>
      <Group title={t("reports.money")}>
        <KpiTile testId="kpi-collected" label={t("reports.collected")} value={f.taka(r.money.collectedPoisha)} note={t("reports.onlineCounter", { online: f.taka(r.money.onlinePoisha), counter: f.taka(r.money.counterPoisha) })} />
        <KpiTile testId="kpi-outstanding" label={t("reports.outstanding")} value={f.taka(r.money.outstandingPoisha)} />
        <KpiTile testId="kpi-overdue" label={t("reports.overdue")} value={f.taka(r.money.overduePoisha)} />
      </Group>
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartLine title={t("reports.monthOverMonth")} points={r.money.monthOverMonth.map((m) => ({ key: m.month, value: m.collectedPoisha }))} format={(v) => f.taka(v)} labelOf={(k) => f.month(k).split(" ")[0].slice(0, 3)} />
        <ChartRank title={t("reports.byPackage")} items={r.money.byPackage.map((p) => ({ label: p.title, value: p.collectedPoisha }))} format={(v) => f.taka(v)} empty={t("reports.none")} />
        <ChartSplit title={t("reports.byMethod")} parts={methods.map(([m, v]) => ({ label: t.has(`method.${m}`) ? t(`method.${m}`) : m, value: v }))} format={(v) => f.taka(v)} empty={t("reports.none")} />
        <Card padded={false} className="p-4" data-testid="left-reasons">
          <h3 className="font-bold">{t("reports.leftByReason")}</h3>
          {reasons.length ? (
            <ul className="mt-2 divide-y divide-line text-sm">
              {reasons.map(([k, n]) => (
                <li key={k} className="flex justify-between py-1.5">
                  <span>{t.has(`leftReason.${k}`) ? t(`leftReason.${k}`) : k}</span>
                  <span className="font-semibold tabular-nums">{f.n(n)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">{t("reports.noneLeft")}</p>
          )}
        </Card>
      </div>
      <Group title={t("reports.attendance")}>
        <KpiTile testId="kpi-visits" label={t("reports.visits")} value={f.n(r.attendance.visits)} />
        <KpiTile testId="kpi-average" label={t("reports.averagePerActive")} value={r.attendance.averagePerActive == null ? "–" : f.n(Math.round(r.attendance.averagePerActive * 10) / 10)} />
        <KpiTile testId="kpi-not-seen" label={t("reports.notSeen", { days: r.attendance.notSeenDays })} value={f.n(r.attendance.notSeen)} />
      </Group>
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartBars title={t("reports.dailyVisits")} bars={dayBars(r.attendance.daily)} values={false} format={(v) => t("reports.visitsN", { n: v })} />
        <ChartBars title={t("reports.busiestHours")} bars={hourBars(r.attendance.busiestHours)} values={false} format={(v) => t("reports.visitsN", { n: v })} />
      </div>
      {overdue.length ? (
        <Card padded={false} className="p-4" data-testid="overdue-list">
          <h3 className="font-bold">
            {t("reports.overdueList")} <span className="text-sm font-normal text-muted tabular-nums">({f.n(overdue.length)})</span>
          </h3>
          <ul className="mt-2 max-h-96 divide-y divide-line overflow-y-auto text-sm">
            {overdue.map((o) => (
              <li key={o.dueId} className="flex flex-wrap items-center justify-between gap-2 py-2">
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
export function ExportButtons({ gymId, month }: { gymId: string; month: string }) {
  const t = useTranslations("gm");
  const [busy, setBusy] = useState<ExportDataset | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const run = async (dataset: ExportDataset) => {
    setBusy(dataset);
    setProblem(null);
    try {
      await downloadCsv("api", `/manage/gyms/${gymId}/reports/export`, exportQuery(dataset, month), `${dataset}-${month}.csv`);
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
