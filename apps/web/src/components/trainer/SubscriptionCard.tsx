"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { problemOf } from "@kriraghor/api-client";
import { dayLabel, newKey } from "@/lib/bookings";
import { subscriptionTone, TONE, trainer, type Subscription } from "@/lib/trainer";
import { formatTaka } from "@/lib/payments";
import { Notice } from "@kriraghor/ui/primitives";

/**
 * A trainer subscription (M20 §6): the month it is in, when the next payment is due, pay, cancel and
 * "report a problem". Shown to the trainer on /pro/plans (their subscribers); the member's own list
 * is on gym.kriraghor.com/me/subscriptions (a copy of this card lives there).
 */
export function SubscriptionCard({ s }: { s: Subscription }) {
  const t = useTranslations("gym");
  const locale = useLocale();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [statement, setStatement] = useState("");
  const [key] = useState(newKey);
  const done = () => qc.invalidateQueries({ queryKey: ["my-subscriptions"] });
  const renew = useMutation({ mutationFn: () => trainer.renew(s.id), onSuccess: (r) => (r.payment ? window.location.assign(r.payment.payUrl) : done()) });
  const cancel = useMutation({ mutationFn: () => trainer.cancelSubscription(s.id), onSuccess: () => (setConfirm(false), done()) });
  const problem = useMutation({ mutationFn: () => trainer.problem(s.id, statement.trim(), key), onSuccess: () => (setReporting(false), done()) });
  const err = [renew.error, cancel.error, problem.error].map(problemOf).find(Boolean) ?? null;
  const money = (n: number) => formatTaka(n, locale);
  const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso)) : "");
  const cur = s.current;
  const due = s.next?.status === "pending_payment" ? s.next : cur?.status === "pending_payment" ? cur : null;

  return (
    <li className="border-2 border-line p-4" data-testid="my-sub">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted">{s.code}</span>
          <span className="block text-lg font-extrabold">
            {s.title} · {s.other.name ?? "–"}
          </span>
          <span className="block text-sm text-muted">
            {t("perMonth", { price: money(s.price) })} · {s.sessionsPerMonth ? t("sessions", { n: s.sessionsPerMonth }) : t("sessionsAgreed")}
          </span>
        </span>
        <span className={`border-2 px-2 py-0.5 text-sm font-bold ${TONE[subscriptionTone(s.phase)]}`} data-testid="my-sub-phase">
          {t(`phase.${s.phase}`)}
        </span>
      </div>
      {cur ? (
        <p className="mt-2 text-sm">
          {t("thisMonth", { from: dayLabel(cur.periodStart, locale), to: dayLabel(cur.periodEnd, locale) })}
          {s.paidThrough ? ` · ${t("paidThrough", { date: dayLabel(s.paidThrough, locale) })}` : ""}
          {!s.renew ? ` · ${t("endsAtMonthEnd")}` : ""}
        </p>
      ) : null}
      {due?.payBy ? <p className="mt-1 text-sm font-semibold">{t("payBy", { when: when(due.payBy), price: money(due.price) })}</p> : null}

      <div className="mt-3 flex flex-wrap gap-3">
        {s.can.pay ? (
          s.payment ? (
            <a href={s.payment.payUrl} className="inline-flex min-h-11 items-center bg-brand px-4 font-bold text-white hover:bg-brand-hover" data-testid="my-sub-pay">
              {t("payMonth", { price: money(due?.price ?? s.price) })}
            </a>
          ) : (
            <button type="button" onClick={() => renew.mutate()} disabled={renew.isPending} className="min-h-11 bg-brand px-4 font-bold text-white hover:bg-brand-hover disabled:opacity-50" data-testid="my-sub-renew">
              {t("payMonth", { price: money(s.price) })}
            </button>
          )
        ) : null}
        {s.can.cancel && !confirm ? (
          <button type="button" onClick={() => setConfirm(true)} className="min-h-11 border-2 border-line px-4 font-bold hover:border-danger" data-testid="my-sub-cancel">
            {t("cancelSubscription")}
          </button>
        ) : null}
        {s.can.problem && !reporting ? (
          <button type="button" onClick={() => setReporting(true)} className="min-h-11 border-2 border-line px-4 font-bold" data-testid="my-sub-problem">
            {t("reportProblem")}
          </button>
        ) : null}
        {cur?.disputeId ? <span className="self-center text-sm font-semibold text-danger">{t("inDispute")}</span> : null}
      </div>

      {confirm ? (
        <div className="mt-3 border-2 border-danger p-3">
          <p className="font-semibold">{s.can.refundOnCancel ? t("cancelRefund", { price: money(cur?.price ?? s.price) }) : t("cancelAtEnd")}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => cancel.mutate()} disabled={cancel.isPending} className="min-h-11 bg-danger px-4 font-bold text-white disabled:opacity-50" data-testid="my-sub-cancel-yes">
              {t("cancelYes")}
            </button>
            <button type="button" onClick={() => setConfirm(false)} className="min-h-11 border-2 border-line px-4 font-bold">
              {t("keepSubscription")}
            </button>
          </div>
        </div>
      ) : null}
      {reporting ? (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            problem.mutate();
          }}
        >
          <label htmlFor={`problem-${s.id}`} className="text-sm font-semibold">
            {t("problemLabel")}
          </label>
          <textarea id={`problem-${s.id}`} value={statement} onChange={(e) => setStatement(e.target.value)} minLength={10} maxLength={2000} required rows={4} className="glass-card p-2" />
          <p className="text-sm text-muted">{t("problemHint")}</p>
          <div className="flex gap-2">
            <button type="submit" disabled={problem.isPending || statement.trim().length < 10} className="min-h-11 bg-brand px-4 font-bold text-white disabled:opacity-50">
              {t("sendProblem")}
            </button>
            <button type="button" onClick={() => setReporting(false)} className="min-h-11 border-2 border-line px-4 font-bold">
              {t("close")}
            </button>
          </div>
        </form>
      ) : null}
      {err ? (
        <div className="mt-3">
          <Notice tone="error">{t.has(`err.${err.code}`) ? t(`err.${err.code}`) : err.title}</Notice>
        </div>
      ) : null}
    </li>
  );
}
