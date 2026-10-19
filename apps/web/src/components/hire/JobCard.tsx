"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { problemOf } from "@/lib/api/client";
import { newKey } from "@/lib/bookings";
import { hire, jobTone, TONE, WITHDRAW_REASONS, type CancelPlan, type Job } from "@/lib/hire";
import { formatTaka } from "@/lib/payments";
import { Button, Notice } from "../ui";

type Open = null | "cancel" | "no-show" | "problem" | "complete" | "withdraw";

/**
 * One job (a match or a session) with the actions the server says are open now (`can`):
 * - the manager confirms the work (releases the money), cancels with the fee shown first (§6.6), or
 *   reports a no-show or a problem (an M17 case; the money stays held until our team decides);
 * - the pro checks in, starts, marks complete (a note, the result for a match) or withdraws (the
 *   manager gets everything back).
 */
export function JobCard({ job: j, side, onChange }: { job: Job; side: "hirer" | "pro"; onChange: () => unknown }) {
  const t = useTranslations("hire");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [reason, setReason] = useState<(typeof WITHDRAW_REASONS)[number]>("not_available");
  const [plan, setPlan] = useState<CancelPlan | null>(null);
  const [key] = useState(newKey);
  const done = () => {
    setOpen(null);
    setText("");
    return onChange();
  };
  const act = useMutation({
    mutationFn: async (what: "confirm" | "cancel" | "checkIn" | "start" | "complete" | "withdraw") => {
      if (what === "confirm") return hire.confirm(j.id);
      if (what === "cancel") return hire.cancel(j.id);
      if (what === "checkIn") return hire.checkIn(j.id);
      if (what === "start") return hire.start(j.id);
      if (what === "complete") return hire.complete(j.id, result, text);
      return hire.withdrawJob(j.id, reason);
    },
    onSuccess: done,
  });
  const preview = useMutation({ mutationFn: () => hire.cancelPreview(j.id), onSuccess: (p) => (setPlan(p), setOpen("cancel")) });
  const report = useMutation({
    mutationFn: (kind: "no-show" | "problem") => hire.dispute(j.id, kind, text, key),
    onSuccess: (r) => (r.dispute?.code ? router.push(`/me/disputes/${r.dispute.code}`) : done()),
  });
  const err = [act, preview, report].map((m) => (m.error ? problemOf(m.error) : null)).find(Boolean);
  const can = j.can ?? {};
  const when = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso)) : "");
  const money = (n: number) => formatTaka(n, locale);
  const ghost = "min-h-12 border-2 border-line px-4 font-bold hover:border-brand disabled:opacity-50";

  return (
    <article className="border-2 border-line" data-testid="hire-job">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-line px-4 py-3">
        <div>
          <p className="font-extrabold">
            {when(j.start)}
            {j.format ? ` · ${j.format}` : ""}
            {j.night ? ` · ${t("night")}` : ""}
          </p>
          <p className="text-xs text-muted">
            {j.code} · {j.venue.text}
          </p>
        </div>
        <span className={`border-2 px-2 py-0.5 text-sm font-bold ${TONE[jobTone(j.status)]}`} data-testid="hire-job-status">
          {t(`jobStatus.${j.status}`)}
          {j.late ? ` · ${t("late")}` : ""}
        </span>
      </header>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-4 py-3 text-sm">
        <dt className="text-muted">{t("quote")}</dt>
        <dd className="font-bold tabular-nums">{money(j.money.quote)}</dd>
        {side === "pro" ? (
          <>
            <dt className="text-muted">{t("youGet")}</dt>
            <dd className="tabular-nums">{money(j.money.net)}</dd>
          </>
        ) : null}
        {j.money.refunded ? (
          <>
            <dt className="text-muted">{t("refunded")}</dt>
            <dd className="tabular-nums" data-testid="hire-job-refunded">
              {money(j.money.refunded)}
            </dd>
          </>
        ) : null}
        {j.money.cancelFee ? (
          <>
            <dt className="text-muted">{t("cancelFee")}</dt>
            <dd className="tabular-nums">{money(j.money.cancelFee)}</dd>
          </>
        ) : null}
        {j.result ? (
          <>
            <dt className="text-muted">{t("result")}</dt>
            <dd>{j.result}</dd>
          </>
        ) : null}
        {j.status === "completed_marked" && j.releaseAt ? (
          <>
            <dt className="text-muted">{t("releasesOn")}</dt>
            <dd>{when(j.releaseAt)}</dd>
          </>
        ) : null}
      </dl>
      <div className="flex flex-wrap gap-3 border-t-2 border-line px-4 py-3 empty:hidden">
        {can.checkIn ? (
          <Button busy={act.isPending} onClick={() => act.mutate("checkIn")} data-testid="hire-check-in">
            {t("checkIn")}
          </Button>
        ) : null}
        {can.start ? (
          <Button busy={act.isPending} onClick={() => act.mutate("start")} data-testid="hire-start">
            {t("start")}
          </Button>
        ) : null}
        {can.complete && open !== "complete" ? (
          <Button onClick={() => setOpen("complete")} data-testid="hire-complete">
            {t("markComplete")}
          </Button>
        ) : null}
        {can.confirm ? (
          <Button busy={act.isPending} onClick={() => act.mutate("confirm")} data-testid="hire-confirm">
            {t("confirmWork", { amount: money(j.money.quote) })}
          </Button>
        ) : null}
        {can.problem && open !== "problem" ? (
          <button type="button" className={ghost} onClick={() => setOpen("problem")} data-testid="hire-problem">
            {t("reportProblem")}
          </button>
        ) : null}
        {can.noShow && open !== "no-show" ? (
          <button type="button" className={ghost} onClick={() => setOpen("no-show")} data-testid="hire-no-show">
            {t("reportNoShow")}
          </button>
        ) : null}
        {can.cancel && open !== "cancel" ? (
          <button type="button" disabled={preview.isPending} className="min-h-12 border-2 border-danger px-4 font-bold text-danger disabled:opacity-50" onClick={() => preview.mutate()} data-testid="hire-cancel">
            {t("cancelJob")}
          </button>
        ) : null}
        {can.withdraw && open !== "withdraw" ? (
          <button type="button" className="min-h-12 border-2 border-danger px-4 font-bold text-danger" onClick={() => setOpen("withdraw")} data-testid="hire-withdraw-job">
            {t("withdrawJob")}
          </button>
        ) : null}
        {j.disputeId ? (
          <Link href="/me/disputes" className="inline-flex min-h-12 items-center font-semibold text-brand underline">
            {t("seeCase")}
          </Link>
        ) : null}
      </div>

      {open === "cancel" && plan ? (
        <div className="flex flex-col gap-3 border-t-2 border-line px-4 py-4" data-testid="hire-cancel-plan">
          <p className="font-semibold">{plan.cancelFee ? t(`cancelTier.${plan.tier}`, { pct: plan.pct, fee: money(plan.cancelFee), refund: money(plan.refund) }) : t("cancelFree", { refund: money(plan.refund) })}</p>
          <div className="flex gap-3">
            <button type="button" disabled={act.isPending} className="min-h-12 border-2 border-danger bg-danger px-4 font-bold text-white disabled:opacity-50" onClick={() => act.mutate("cancel")} data-testid="hire-cancel-confirm">
              {t("cancelConfirm")}
            </button>
            <button type="button" className={ghost} onClick={() => setOpen(null)}>
              {t("keep")}
            </button>
          </div>
        </div>
      ) : null}
      {open === "complete" ? (
        <form
          className="flex flex-col gap-3 border-t-2 border-line px-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            act.mutate("complete");
          }}
        >
          {j.format ? (
            <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
              {t("resultLabel")}
              <input value={result} onChange={(e) => setResult(e.target.value)} maxLength={120} placeholder={t("resultHint")} className="min-h-12 border-2 border-line bg-surface px-3 text-base text-ink" data-testid="hire-result" />
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            {t("workNote")}
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={3} className="border-2 border-line bg-surface p-3 text-base text-ink" />
          </label>
          <p className="text-sm text-muted">{t("completeNote")}</p>
          <div>
            <Button busy={act.isPending} data-testid="hire-complete-send">
              {t("markComplete")}
            </Button>
          </div>
        </form>
      ) : null}
      {open === "withdraw" ? (
        <form
          className="flex flex-col gap-3 border-t-2 border-line px-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            act.mutate("withdraw");
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            {t("withdrawWhy")}
            <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className="min-h-12 border-2 border-line bg-surface px-3 text-base text-ink">
              {WITHDRAW_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`withdrawReason.${r}`)}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-muted">{t("withdrawNote")}</p>
          <div>
            <button type="submit" disabled={act.isPending} className="min-h-12 border-2 border-danger bg-danger px-4 font-bold text-white disabled:opacity-50">
              {t("withdrawJob")}
            </button>
          </div>
        </form>
      ) : null}
      {open === "no-show" || open === "problem" ? (
        <form
          className="flex flex-col gap-3 border-t-2 border-line px-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            report.mutate(open);
          }}
        >
          <label htmlFor={`hd-${j.id}`} className="font-semibold">
            {open === "no-show" ? t("noShowWhat") : t("problemWhat")}
          </label>
          <textarea id={`hd-${j.id}`} value={text} onChange={(e) => setText(e.target.value)} minLength={10} maxLength={2000} required rows={4} className="border-2 border-line bg-surface p-3" data-testid="hire-dispute-text" />
          <p className="text-sm text-muted">{t("disputeNote")}</p>
          <div>
            <Button busy={report.isPending} data-testid="hire-dispute-send">
              {t("sendReport")}
            </Button>
          </div>
        </form>
      ) : null}
      {err ? (
        <div className="px-4 pb-4">
          <Notice tone="error">{err.code === "TOO_EARLY" ? t("tooEarly") : (err.title ?? t("failed"))}</Notice>
        </div>
      ) : null}
    </article>
  );
}
