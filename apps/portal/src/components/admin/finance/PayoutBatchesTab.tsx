"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { Button, DataTable, Notice, Select, type Column } from "@kriraghor/ui/kit";
import { formatTaka } from "@/lib/admin/finance";
import { payouts, type Batch } from "@/lib/admin/payouts";
import { useCursorList } from "@/lib/use-cursor-list";
import { StatusBadge } from "../../StatusBadge";
import { formatDhaka } from "../useAdminMe";
import type { DeskMe } from "./FinanceDesk";

const SCHEDULES = ["daily", "ground_weekly", "shop_weekly"] as const;
type Totals = { payouts?: number; amount?: number; needsApproval?: number };
const totalsOf = (b: Batch) => (b.totals ?? {}) as Totals;

/** Payout runs (M07 §4.3 Batches): totals per run; masters can build a run now (catch-up, or in dev). */
export function PayoutBatchesTab({ me }: { me: DeskMe }) {
  const t = useTranslations("payouts");
  const tf = useTranslations("finance");
  const locale = useLocale();
  const qc = useQueryClient();
  const list = useCursorList<Batch>(["payout-batches"], (cursor) => payouts.batches(cursor));
  const [schedule, setSchedule] = useState<(typeof SCHEDULES)[number]>("daily");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  const columns: Column<Batch>[] = [
    { id: "schedule", header: t("schedule"), primary: true, sort: (b) => b.schedule, cell: (b) => (t.has(`schedules.${b.schedule}`) ? t(`schedules.${b.schedule}`) : b.schedule) },
    { id: "windowEnd", header: t("windowEnd"), sort: (b) => b.windowEnd, cell: (b) => <span className="whitespace-nowrap">{formatDhaka(b.windowEnd, locale)}</span> },
    { id: "payouts", header: t("payoutsCount"), align: "end", sort: (b) => totalsOf(b).payouts ?? 0, cell: (b) => totalsOf(b).payouts ?? 0 },
    { id: "amount", header: t("amount"), align: "end", sort: (b) => totalsOf(b).amount ?? 0, cell: (b) => formatTaka(totalsOf(b).amount ?? 0, locale) },
    { id: "needsApproval", header: t("needsApprovalCount"), align: "end", hideBelow: "lg", sort: (b) => totalsOf(b).needsApproval ?? 0, cell: (b) => totalsOf(b).needsApproval ?? 0 },
    { id: "status", header: t("statusLabel"), sort: (b) => b.status, cell: (b) => <StatusBadge status={b.status}>{b.status}</StatusBadge> },
  ];

  return (
    <div className="mt-6 flex flex-col gap-4">
      {me.isMaster ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setProblem(null);
            try {
              await payouts.runNow(schedule);
              await qc.invalidateQueries({ queryKey: ["payout-batches"] });
              await qc.invalidateQueries({ queryKey: ["payouts"] });
            } catch (err) {
              setProblem(problemOf(err) ?? { code: "UNKNOWN", title: "Something went wrong", status: 0 });
            } finally {
              setBusy(false);
            }
          }}
        >
          <Select id="batch-schedule" className="w-full sm:w-56" label={t("schedule")} value={schedule} onChange={(e) => setSchedule(e.target.value as typeof schedule)}>
            {SCHEDULES.map((s) => (
              <option key={s} value={s}>
                {t(`schedules.${s}`)}
              </option>
            ))}
          </Select>
          <Button type="submit" busy={busy} data-testid="run-batch" confirm={{ kind: "money", title: t("ask.runBatch"), confirmLabel: t("runNow") }}>
            {t("runNow")}
          </Button>
        </form>
      ) : null}
      {problem ? (
        <div className="max-w-xl">
          <Notice tone="error">{problem.title}</Notice>
        </div>
      ) : null}
      <DataTable
        label={tf("tabs.batches")}
        testId="payout-batches"
        columns={columns}
        rows={list.rows}
        rowId={(b) => b.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.retry}
        empty={{ title: tf("empty") }}
        hasMore={list.hasMore}
        total={list.total}
        onMore={list.more}
        busy={list.busy}
      />
    </div>
  );
}
