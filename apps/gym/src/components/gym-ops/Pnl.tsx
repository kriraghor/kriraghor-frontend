"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowDownRight, ArrowUpRight, CaretLeft, CaretRight, Printer } from "@phosphor-icons/react";
import { Button, Card, IconButton, Notice, Skeleton } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";
import { dhakaToday } from "@/lib/gym-manage";
import { delta, gymOps, monthRange, previousMonth, type Pnl as PnlData } from "@/lib/gym-ops";
import { GymPage, Row, useFmt, useGymError, type GymCtx } from "../gym-manage/common";

/**
 * /manage/[gymId]/pnl (M27-FR-27): one month's profit and loss against the month before. Income (fees at
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

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("go");
  const f = useFmt();
  const err = useGymError();
  const today = dhakaToday();
  const [range, setRange] = useState(monthRange(today));
  const q = useQuery({ queryKey: ["go-pnl", ctx.gymId, range.from], queryFn: () => gymOps.pnl(ctx.gymId, range.from, range.to) });
  const thisMonth = range.from === monthRange(today).from;
  const next = () => {
    const [y, m] = range.from.split("-").map(Number);
    setRange(monthRange(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`));
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconButton label={t("prevMonth")} variant="secondary" onClick={() => setRange(previousMonth(range.from))}>
            <CaretLeft size={18} aria-hidden />
          </IconButton>
          <p className="min-w-36 text-center font-display text-lg font-bold" aria-live="polite">
            {f.month(range.from.slice(0, 7))}
          </p>
          <IconButton label={t("nextMonth")} variant="secondary" onClick={next} disabled={thisMonth}>
            <CaretRight size={18} aria-hidden />
          </IconButton>
        </div>
        <Button variant="secondary" onClick={() => window.print()} disabled={!q.data}>
          <Printer size={18} aria-hidden />
          {t("print")}
        </Button>
      </div>
      {q.isPending ? <Skeleton className="h-96 rounded-card" /> : q.isError ? <Notice tone="error">{err(q.error)}</Notice> : <Statement ctx={ctx} p={q.data} thisMonth={thisMonth} />}
    </div>
  );
}

function Statement({ ctx, p, thisMonth }: { ctx: GymCtx; p: PnlData; thisMonth: boolean }) {
  const t = useTranslations("go");
  const f = useFmt();
  const c = p.current;
  const prev = p.previous;
  return (
    <div className="print-area flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Big label={t("pnl.income")} now={c.income.total} before={prev.income.total} />
        <Big label={t("pnl.costs")} now={c.goodsCost + c.expenses.total} before={prev.goodsCost + prev.expenses.total} costs />
        <Big label={t("pnl.net")} now={c.net} before={prev.net} strong />
      </div>
      {thisMonth ? <p className="text-xs text-muted">{t("pnl.soFar")}</p> : null}
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

function Big({ label, now, before, costs, strong }: { label: string; now: number; before: number; costs?: boolean; strong?: boolean }) {
  const t = useTranslations("go");
  const f = useFmt();
  const d = delta(now, before);
  // For costs, going up is the bad direction.
  const good = d == null ? null : costs ? d <= 0 : d >= 0;
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      <span className={cn("font-display text-2xl font-extrabold tabular-nums md:text-3xl", strong && now < 0 && "text-danger", strong && now >= 0 && "text-brand-text")}>{f.taka(now)}</span>
      <span className="flex items-center gap-1 text-xs text-muted">
        {d == null ? (
          t("pnl.noBefore")
        ) : (
          <>
            {d >= 0 ? <ArrowUpRight size={14} className={good ? "text-brand-text" : "text-danger"} aria-hidden /> : <ArrowDownRight size={14} className={good ? "text-brand-text" : "text-danger"} aria-hidden />}
            {t("pnl.vsBefore", { pct: f.n(Math.abs(d)), up: d >= 0 ? "up" : "down" })}
          </>
        )}
      </span>
    </Card>
  );
}

