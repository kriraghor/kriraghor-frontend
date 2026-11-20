"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Printer } from "@phosphor-icons/react";
import { BarChart, DeltaBadge, KpiTile, RangePicker, RankBars, compactTaka, lastOfMonth, pctChange, periodFromParams, periodParams, type Better } from "@kriraghor/ui/charts";
import { Button, Card, Notice, Skeleton } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { useUrlFilters } from "@kriraghor/ui/url-filters";
import { dhakaToday } from "@/lib/gym-manage";
import { gymOps, type Pnl as PnlData } from "@/lib/gym-ops";
import { GymPage, Row, useFmt, useGymError, type GymCtx } from "../gym-manage/common";

/**
 * /manage/[gymId]/pnl (M27-FR-27): a period's profit and loss (a month by default, in the URL) against the
 * one before, with income against costs month by month (M27-FR-27a). Income (fees at
 * the counter and online, less the payment provider's charge; counter sales; locker fees), less the cost
 * of the goods sold and the expenses by category. Owner and reports.view; Standard plan. Prints on A4.
 */
export function Pnl({ gymId }: { gymId: string }) {
  const t = useTranslations("go");
  return (
    <GymPage gymId={gymId} page="pnl" feature="pnl" title={t("pnl.title")} description={t("pnl.lead")} testId="go-pnl">
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

const SPEC = { month: { default: "" }, from: { default: "" }, to: { default: "" } };

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("go");
  const err = useGymError();
  const today = dhakaToday();
  const { values, set } = useUrlFilters(SPEC);
  const period = periodFromParams(values, today);
  const range = "month" in period ? { from: `${period.month}-01`, to: lastOfMonth(period.month) < today ? lastOfMonth(period.month) : today } : period;
  const q = useQuery({ queryKey: ["go-pnl", ctx.gymId, range.from, range.to], queryFn: () => gymOps.pnl(ctx.gymId, range.from, range.to), placeholderData: (prev) => prev });
  const thisMonth = "month" in period && period.month === today.slice(0, 7);
  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <RangePicker value={period} today={today} onChange={(p) => set(periodParams(p, today))} />
        <Button variant="secondary" onClick={() => window.print()} disabled={!q.data}>
          <Printer size={18} aria-hidden />
          {t("print")}
        </Button>
      </div>
      {q.isPending ? (
        <Skeleton className="h-96 rounded-card" />
      ) : q.isError ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : (
        <div className={q.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <Statement ctx={ctx} p={q.data} thisMonth={thisMonth} />
        </div>
      )}
    </div>
  );
}

function Statement({ ctx, p, thisMonth }: { ctx: GymCtx; p: PnlData; thisMonth: boolean }) {
  const t = useTranslations("go");
  const f = useFmt();
  const c = p.current;
  const prev = p.previous;
  const vs = t("pnl.vsPeriod", { period: `${f.short(prev.from)}–${f.short(prev.to)}` });
  const big = (now: number, before: number, better: Better) => <DeltaBadge value={pctChange(now, before)} kind="pct" label={vs} better={better} />;
  const trend = p.trend ?? [];
  const byCategory = [...c.expenses.byCategory].sort((a, b) => b.amount - a.amount);
  return (
    <div className="print-area flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiTile label={t("pnl.income")} value={f.taka(c.income.total)} delta={big(c.income.total, prev.income.total, "up")} testId="pnl-income" />
        <KpiTile label={t("pnl.costs")} value={f.taka(c.goodsCost + c.expenses.total)} delta={big(c.goodsCost + c.expenses.total, prev.goodsCost + prev.expenses.total, "down")} testId="pnl-costs" />
        <KpiTile label={t("pnl.net")} value={<span className={cn(c.net < 0 ? "text-danger" : "text-brand-text")}>{f.taka(c.net)}</span>} delta={big(c.net, prev.net, "up")} tone={c.net < 0 ? "danger" : undefined} testId="pnl-net-tile" />
      </div>
      {thisMonth ? <p className="text-xs text-muted">{t("pnl.soFar")}</p> : null}
      <div className="no-print grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <BarChart
          title={t("pnl.trend")}
          subtitle={t("pnl.trendLead")}
          labels={trend.map((m) => f.month(m.month))}
          short={trend.map((m) => f.month(m.month).split(" ")[0].slice(0, 3))}
          series={[
            { key: "income", label: t("pnl.income"), values: trend.map((m) => m.income) },
            { key: "costs", label: t("pnl.costs"), values: trend.map((m) => m.costs) },
          ]}
          format={(v) => f.taka(v)}
          axis={(v, top) => compactTaka(v, f.locale, top)}
          emptyText={t("pnl.trendEmpty")}
          testId="pnl-trend"
        />
        <RankBars title={t("pnl.expensesByCategory")} items={byCategory.map((e) => ({ key: e.categoryId, label: e.name, value: e.amount }))} format={(v) => f.taka(v)} emptyText={t("pnl.noExpenses")} testId="pnl-categories" />
      </div>
      <Card className="flex flex-col" data-testid="pnl-statement">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="font-display text-lg font-bold">{ctx.gym.name}</p>
          <p className="text-sm text-muted">
            {f.date(p.from)} – {f.date(p.to)}
          </p>
        </div>
        <div className="flex justify-end gap-3 text-xs font-semibold uppercase tracking-wide text-muted" aria-hidden>
          <span className="hidden w-24 text-right sm:inline">{f.month(prev.from.slice(0, 7))}</span>
          <span className="min-w-24 text-right">{f.month(p.from.slice(0, 7))}</span>
        </div>
        <Section title={t("pnl.income")}>
          <Line label={t("pnl.fees")} now={c.income.fees} before={prev.income.fees} />
          <Line label={t("pnl.posSales")} now={c.income.posSales} before={prev.income.posSales} />
          <Line label={t("pnl.lockerFees")} now={c.income.lockerFees} before={prev.income.lockerFees} />
          <Line label={t("pnl.totalIncome")} now={c.income.total} before={prev.income.total} total />
        </Section>
        <Section title={t("pnl.goods")}>
          <Line label={t("pnl.goodsCost")} now={-c.goodsCost} before={-prev.goodsCost} />
          <Line label={t("pnl.gross")} now={c.gross} before={prev.gross} total />
        </Section>
        <Section title={t("pnl.expenses")}>
          {c.expenses.byCategory.length === 0 ? <p className="py-1.5 text-sm text-muted">{t("pnl.noExpenses")}</p> : null}
          {c.expenses.byCategory.map((e) => (
            <Line key={e.categoryId} label={e.name} now={-e.amount} before={-(prev.expenses.byCategory.find((x) => x.categoryId === e.categoryId)?.amount ?? 0)} />
          ))}
          <Line label={t("pnl.totalExpenses")} now={-c.expenses.total} before={-prev.expenses.total} total />
        </Section>
        <div className="mt-2 flex items-baseline justify-between gap-3 border-t-2 border-ink pt-3">
          <span className="font-display text-lg font-bold">{t("pnl.net")}</span>
          <span className={cn("font-display text-2xl font-extrabold tabular-nums", c.net < 0 && "text-danger")} data-testid="pnl-net">
            {f.taka(c.net)}
          </span>
        </div>
        <p className="mt-3 text-xs text-muted">{t("pnl.note")}</p>
      </Card>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line py-2 first-of-type:border-t-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      {children}
    </div>
  );
}

function Line({ label, now, before, total }: { label: string; now: number; before: number; total?: boolean }) {
  const f = useFmt();
  return (
    <Row label={total ? <span className="font-semibold text-ink">{label}</span> : label} className="gap-2">
      <span className="flex items-baseline gap-3">
        <span className="hidden w-24 text-right text-xs font-normal text-muted sm:inline">{f.taka(before)}</span>
        <span className={cn("min-w-24 text-right", total && "font-bold", now < 0 && "text-muted")}>{f.taka(now)}</span>
      </span>
    </Row>
  );
}
