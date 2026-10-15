"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { formatTaka } from "@/lib/admin/finance";
import { payouts } from "@/lib/admin/payouts";
import { problemOf, type Problem } from "@/lib/api/client";
import { Notice } from "../../ui";
import { formatDhaka } from "../useAdminMe";
import type { DeskMe } from "./FinanceDesk";
import { DataTable, Field, inputCls } from "./shared";

const SCHEDULES = ["daily", "ground_weekly", "shop_weekly"] as const;

/** Payout runs (M07 §4.3 Batches): totals per run; masters can build a run now (catch-up, or in dev). */
export function PayoutBatchesTab({ me }: { me: DeskMe }) {
  const t = useTranslations("payouts");
  const locale = useLocale();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["payout-batches"], queryFn: payouts.batches });
  const [schedule, setSchedule] = useState<(typeof SCHEDULES)[number]>("daily");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const items = q.data?.items ?? [];

  return (
    <div className="mt-6">
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
          <Field label={t("schedule")}>
            <select value={schedule} onChange={(e) => setSchedule(e.target.value as typeof schedule)} className={`${inputCls} w-56`}>
              {SCHEDULES.map((s) => (
                <option key={s} value={s}>
                  {t(`schedules.${s}`)}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" disabled={busy} className="min-h-11 border-2 border-brand px-4 font-semibold disabled:opacity-50" data-testid="run-batch">
            {t("runNow")}
          </button>
        </form>
      ) : null}
      {problem ? (
        <div className="mt-3 max-w-xl">
          <Notice tone="error">{problem.title}</Notice>
        </div>
      ) : null}
      <DataTable head={[t("schedule"), t("windowEnd"), t("payoutsCount"), t("amount"), t("needsApprovalCount"), t("statusLabel")]} loading={q.isPending} error={q.isError} empty={!items.length} testId="payout-batches">
        {items.map((b) => {
          const totals = (b.totals ?? {}) as { payouts?: number; amount?: number; needsApproval?: number };
          return (
            <tr key={b.id}>
              <td className="px-3 py-2">{t.has(`schedules.${b.schedule}`) ? t(`schedules.${b.schedule}`) : b.schedule}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatDhaka(b.windowEnd, locale)}</td>
              <td className="px-3 py-2 tabular-nums">{totals.payouts ?? 0}</td>
              <td className="px-3 py-2 tabular-nums">{formatTaka(totals.amount ?? 0, locale)}</td>
              <td className="px-3 py-2 tabular-nums">{totals.needsApproval ?? 0}</td>
              <td className="px-3 py-2">{b.status}</td>
            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}
