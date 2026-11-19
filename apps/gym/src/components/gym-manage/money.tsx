"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Receipt as ReceiptIcon } from "@phosphor-icons/react";
import { newKey } from "@kriraghor/ui/format";
import { DatePicker } from "@kriraghor/ui/date";
import { Button, Dialog, Field, Notice, Select, Textarea, useConfirm, useToast } from "@kriraghor/ui/kit";
import { dhakaToday, gymManage, PAY_METHODS, poishaToTakaText, receiptPath, takaToPoisha, type PayMethod, type Payment } from "@/lib/gym-manage";
import { useFmt, useGymError } from "./common";
import { put as keepOffline } from "@/lib/desk-db";
import { copyUsable, dueLeft, isNetworkError, newItem, newSlipNo, type WaitingItem } from "@/lib/desk-offline";
import { OfflineSlip } from "@/components/manage/offline/OfflineDesk";
import { useDeskCopy, useTaker, useWaiting } from "@/components/manage/offline/useOffline";

/** A receipt link that opens the public receipt page (/r/<token>) in a new tab. */
export function ReceiptLink({ url, label, testId }: { url: string | null | undefined; label?: string; testId?: string }) {
  const t = useTranslations("gm");
  const path = receiptPath(url);
  if (!path) return null;
  return (
    <a href={path} target="_blank" rel="noopener" className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-brand-text underline" data-testid={testId ?? "receipt-link"}>
      <ReceiptIcon size={16} aria-hidden />
      {label ?? t("money.receipt")}
    </a>
  );
}

/** The payment part of a form (amount, method, date when allowed, note), as text until submit. */
export type PaymentDraft = { taka: string; method: PayMethod; paidOn: string; note: string };
export const emptyPayment = (amount?: number): PaymentDraft => ({ taka: poishaToTakaText(amount ?? null), method: "cash", paidOn: dhakaToday(), note: "" });

/** Draft → API body, or a problem key. `backdate` (fees.adjust) allows a date before today. */
export function paymentBody(d: PaymentDraft, backdate: boolean): { ok: true; payment: Payment } | { ok: false; problem: "amount" } {
  const amountPoisha = takaToPoisha(d.taka);
  if (amountPoisha === null) return { ok: false, problem: "amount" };
  const payment: Payment = { amountPoisha, method: d.method };
  if (backdate && d.paidOn && d.paidOn !== dhakaToday()) payment.paidOn = d.paidOn;
  if (d.note.trim()) payment.note = d.note.trim().slice(0, 300);
  return { ok: true, payment };
}

export function PaymentFields({ id, value, onChange, backdate, max, error }: { id: string; value: PaymentDraft; onChange: (v: PaymentDraft) => void; backdate: boolean; max?: number; error?: string }) {
  const t = useTranslations("gm");
  const f = useFmt();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field
        id={`${id}-amount`}
        label={t("money.amount")}
        inputMode="decimal"
        value={value.taka}
        onChange={(e) => onChange({ ...value, taka: e.target.value })}
        hint={max !== undefined ? t("money.outstanding", { amount: f.taka(max) }) : undefined}
        error={error}
        leading={<span className="text-muted">৳</span>}
        data-testid={`${id}-amount`}
      />
      <Select id={`${id}-method`} label={t("money.method")} value={value.method} onChange={(e) => onChange({ ...value, method: e.target.value as PayMethod })} data-testid={`${id}-method`}>
        {PAY_METHODS.map((m) => (
          <option key={m} value={m}>
            {t(`method.${m}`)}
          </option>
        ))}
      </Select>
      {backdate ? <DatePicker id={`${id}-date`} label={t("money.paidOn")} value={value.paidOn} max={dhakaToday()} onChange={(v) => onChange({ ...value, paidOn: v })} /> : null}
      <Field id={`${id}-note`} label={t("money.note")} optional={t("optional")} value={value.note} maxLength={300} onChange={(e) => onChange({ ...value, note: e.target.value })} />
    </div>
  );
}

/**
 * Record a counter payment on one due (M24-FR-33): amount up to the outstanding, method, receipt. Without a
 * connection (M24 §22), cash for a due in the desk copy can be taken with a temporary slip instead.
 */
export function PayDialog({ gymId, due, canAdjust, title, open, onOpenChange, onDone }: { gymId: string; due: { id: string; outstandingPoisha?: number }; canAdjust: boolean; title?: string; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const t = useTranslations("gm");
  const err = useGymError();
  const toast = useToast();
  const [draft, setDraft] = useState(() => emptyPayment(due.outstandingPoisha));
  const [key, setKey] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string>();
  const [receipt, setReceipt] = useState<{ no: string; url: string } | null>(null);
  const tOff = useTranslations("off.pay");
  const f = useFmt();
  const ask = useConfirm();
  const copy = useDeskCopy(gymId, { fetch: false });
  const waiting = useWaiting(gymId);
  const taker = useTaker();
  const [offlineOffer, setOfflineOffer] = useState(false);
  const [slip, setSlip] = useState<WaitingItem | null>(null);
  const close = (o: boolean) => {
    if (!o) {
      setDraft(emptyPayment(due.outstandingPoisha));
      setKey(newKey());
      setProblem(null);
      setAmountError(undefined);
      setReceipt(null);
      setOfflineOffer(false);
      setSlip(null);
    }
    onOpenChange(o);
  };
  /** The due in the desk copy, when the copy is good and the person at the desk is known. */
  const copyDue = () => (copyUsable(copy, performance.now()) && taker ? (copy.dues?.find((d) => d.id === due.id) ?? null) : null);
  const saveOffline = async () => {
    const body = paymentBody(draft, false);
    const d = copyDue();
    const member = d ? copy?.members.find((m) => m.id === d.memberId) : null;
    if (!body.ok) return setAmountError(t("money.badAmount"));
    if (!d || !member || !copy || !taker) return setProblem(tOff("offer"));
    if (body.payment.amountPoisha > dueLeft(d, waiting)) return setAmountError(t("err.GYM_PAYMENT_EXCEEDS_DUE"));
    const item = newItem({ copy, nowPerf: performance.now(), kind: "cash_fee", member, taker, due: d, amountPoisha: body.payment.amountPoisha, slipNo: newSlipNo() });
    await keepOffline(item);
    setOfflineOffer(false);
    setSlip(item);
  };
  const submit = async () => {
    const body = paymentBody(draft, canAdjust);
    if (!body.ok) return setAmountError(t("money.badAmount"));
    if (due.outstandingPoisha !== undefined && body.payment.amountPoisha > due.outstandingPoisha) return setAmountError(t("err.GYM_PAYMENT_EXCEEDS_DUE"));
    setAmountError(undefined);
    setProblem(null);
    // Asks once the amount is valid, naming the amount and method (tester feedback, 19 Nov 2026).
    if (!(await ask({ kind: "money", title: t("money.recordAsk", { amount: f.taka(body.payment.amountPoisha), method: t(`method.${body.payment.method}`) }), confirmLabel: t("money.record") }))) return;
    setBusy(true);
    try {
      const r = await gymManage.pay(gymId, due.id, body.payment, key);
      setReceipt({ no: r.receipt.receiptNo, url: r.receipt.url });
      toast.show(t("money.recorded", { no: r.receipt.receiptNo }));
      onDone();
    } catch (e) {
      if (isNetworkError(e) && draft.method === "cash" && copyDue()) setOfflineOffer(true);
      else setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={title ?? t("money.collect")}
      footer={
        receipt || slip ? (
          <Button type="button" onClick={() => close(false)}>
            {t("done")}
          </Button>
        ) : (
          <>
            <Button type="button" variant="ghost" onClick={() => close(false)} disabled={busy}>
              {t("cancel")}
            </Button>
            {offlineOffer ? (
              <Button type="button" onClick={() => void saveOffline()} data-testid="pay-offline">
                {tOff("save")}
              </Button>
            ) : (
              <Button type="button" onClick={submit} busy={busy} data-testid="pay-submit">
                {t("money.record")}
              </Button>
            )}
          </>
        )
      }
    >
      <div data-testid="pay-dialog">
        {slip ? (
          <OfflineSlip item={slip} />
        ) : receipt ? (
          <div className="flex flex-col gap-2" data-testid="pay-done">
            <Notice tone="success">{t("money.recorded", { no: receipt.no })}</Notice>
            <ReceiptLink url={receipt.url} label={t("money.openReceipt")} />
          </div>
        ) : (
          <>
            <PaymentFields id="pay" value={draft} onChange={setDraft} backdate={canAdjust} max={due.outstandingPoisha} error={amountError} />
            {offlineOffer ? (
              <Notice tone="warning" className="mt-3">
                {tOff("offer")}
              </Notice>
            ) : null}
            {problem ? (
              <p role="alert" className="mt-3 text-sm text-danger">
                {problem}
              </p>
            ) : null}
          </>
        )}
      </div>
    </Dialog>
  );
}

/** Waive all or part of a due with a reason (fees.adjust, M24-FR-36). */
export function WaiveDialog({ gymId, due, open, onOpenChange, onDone }: { gymId: string; due: { id: string; outstandingPoisha?: number }; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const t = useTranslations("gm");
  const err = useGymError();
  const toast = useToast();
  const f = useFmt();
  const ask = useConfirm();
  const [taka, setTaka] = useState(poishaToTakaText(due.outstandingPoisha ?? null));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const submit = async () => {
    const amountPoisha = takaToPoisha(taka);
    if (amountPoisha === null) return setProblem(t("money.badAmount"));
    if (reason.trim().length < 2) return setProblem(t("money.reasonNeeded"));
    if (!(await ask({ kind: "money", title: t("money.waiveAsk", { amount: f.taka(amountPoisha) }), body: t("money.waiveAskBody"), confirmLabel: t("money.waive") }))) return;
    setBusy(true);
    setProblem(null);
    try {
      await gymManage.waive(gymId, due.id, { amountPoisha, reason: reason.trim() });
      toast.show(t("money.waived"));
      onOpenChange(false);
      onDone();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("money.waive")}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={submit} busy={busy} data-testid="waive-submit">
            {t("money.waive")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field id="waive-amount" label={t("money.amount")} inputMode="decimal" value={taka} onChange={(e) => setTaka(e.target.value)} leading={<span className="text-muted">৳</span>} />
        <Textarea id="waive-reason" label={t("money.reason")} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
