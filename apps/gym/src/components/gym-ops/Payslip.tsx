"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Printer } from "@phosphor-icons/react";
import { Button, Dialog, Notice, Skeleton } from "@kriraghor/ui/kit";
import { gymStaff, hoursText, type Payslip } from "@/lib/gym-staff";
import { useFmt, useGymError } from "../gym-manage/common";

/**
 * A payslip (M27-FR-81) in a dialog with Print (A4): the gym's name and address, the month, the staff member,
 * base pay, the trainer commission on fees, the sales commission, bonus, deduction, net, hours and late or
 * missed shifts, and how and when it was paid. Dark ink on white, also in the dark theme.
 */
export function PayslipDialog({ gymId, runId, lineId, onClose }: { gymId: string; runId: string; lineId: string; onClose: () => void }) {
  const t = useTranslations("gt");
  const err = useGymError();
  const q = useQuery({ queryKey: ["gt-payslip", gymId, runId, lineId], queryFn: () => gymStaff.payslip(gymId, runId, lineId) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t("payslip.title")} className="max-w-2xl">
      <div className="flex flex-col gap-3 px-6 pb-5">
        {q.isPending ? <Skeleton className="h-80 rounded-card" /> : q.isError ? <Notice tone="error">{err(q.error)}</Notice> : <PayslipSheet slip={q.data} />}
        <div className="no-print flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("close")}
          </Button>
          <Button variant="secondary" onClick={() => window.print()} disabled={!q.data} data-testid="payslip-print">
            <Printer size={18} aria-hidden />
            {t("print")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function PayslipSheet({ slip }: { slip: Payslip }) {
  const t = useTranslations("gt");
  const f = useFmt();
  const l = slip.line;
  const row = (label: string, value: string, strong = false) => (
    <div className={strong ? "flex justify-between gap-2 border-t border-[#d9dbd2] pt-2 text-base font-bold" : "flex justify-between gap-2"}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
  return (
    <div className="print-area mx-auto w-full max-w-[560px] rounded-card border border-[#d9dbd2] bg-white p-6 text-sm text-[#111210]" data-testid="payslip">
      <div className="text-center">
        <p className="font-display text-xl font-bold">{slip.gym.name}</p>
        {slip.gym.address ? <p className="text-[#55574f]">{slip.gym.address}</p> : null}
        <p className="mt-2 font-semibold">{t("payslip.heading", { month: f.month(slip.period) })}</p>
      </div>
      <div className="mt-4 flex flex-col gap-1">
        {row(t("payslip.staff"), l.staff.name ?? "–")}
        {row(t("payslip.worked"), hoursText(l.workedMinutes, (k, v) => t(`time.${k}`, v)))}
        {l.lateCount || l.missedCount ? row(t("payslip.lateMissed"), `${f.n(l.lateCount)} / ${f.n(l.missedCount)}`) : null}
      </div>
      <div className="mt-4 flex flex-col gap-1">
        {row(t("payslip.base"), f.taka(l.basePoisha))}
        {l.ptCommissionPoisha ? row(t("payslip.pt", { pct: f.n(l.ptCommissionBps / 100), base: f.taka(l.ptBasePoisha) }), f.taka(l.ptCommissionPoisha)) : null}
        {l.salesCommissionPoisha ? row(t("payslip.sales", { pct: f.n(l.salesCommissionBps / 100), base: f.taka(l.salesBasePoisha) }), f.taka(l.salesCommissionPoisha)) : null}
        {l.bonusPoisha ? row(t("payslip.bonus"), f.taka(l.bonusPoisha)) : null}
        {l.deductionPoisha ? row(t("payslip.deduction"), `− ${f.taka(l.deductionPoisha)}`) : null}
        {row(t("payslip.net"), f.taka(l.netPoisha), true)}
      </div>
      {l.note ? <p className="mt-3 text-[#55574f]">{t("payslip.note", { note: l.note })}</p> : null}
      <p className="mt-4 text-[#55574f]">{l.status === "paid" ? t("payslip.paid", { method: t(`method.${l.paidMethod ?? "other"}`), date: f.date(l.paidOn) }) : t("payslip.unpaid")}</p>
    </div>
  );
}
