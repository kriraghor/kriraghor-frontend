"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { hire, minutesLeft, requestTone, TONE, type RequestResult } from "@/lib/hire";
import { formatTaka } from "@/lib/payments";
import { MePanel } from "../MePanel";
import { Button, Notice } from "../ui";
import { JobCard } from "./JobCard";
import { Thread } from "./Thread";

type QuotedLine = { start: string; format: string | null; venueText: string; total: number };

/**
 * /me/hire/[code] (M11 FR-23 to FR-36), for either party:
 * - the request and its quote;
 * - the pay link with its deadline while accepted and unpaid;
 * - the other party's phone once paid;
 * - each job with the actions open now (the manager: confirm, cancel with the fee, no-show,
 *   problem; the pro: check in, start, mark complete, withdraw);
 * - the message thread (contact details are refused until paid).
 */
export function HireRequestView({ code }: { code: string }) {
  const t = useTranslations("hire");
  const locale = useLocale();
  const { status } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["hire-request", code], queryFn: () => hire.one(code), enabled: status === "signed_in", retry: false, refetchInterval: 30_000 });
  const set = (r: RequestResult) => {
    qc.setQueryData(["hire-request", code], r);
    void qc.invalidateQueries({ queryKey: ["my-hires"] });
  };
  const refresh = () => qc.invalidateQueries({ queryKey: ["hire-request", code] });
  const pay = useMutation({ mutationFn: () => hire.pay(q.data!.request.id), onSuccess: (r) => r.payment && window.location.assign(r.payment.payUrl) });
  const withdraw = useMutation({ mutationFn: () => hire.withdrawRequest(q.data!.request.id), onSuccess: set });
  const when = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso)) : "");
  const money = (n: number) => formatTaka(n, locale);
  const err = [pay, withdraw].map((m) => (m.error ? problemOf(m.error) : null)).find(Boolean);

  if (status === "signed_out") return <MePanel />;
  if (q.isPending) return <div className="mx-auto mt-10 h-64 max-w-[1100px] animate-pulse bg-surface-2" />;
  if (q.isError || !q.data)
    return (
      <section className="mx-auto max-w-[1100px] px-5 py-10">
        <Notice tone="error">{t("requestNotFound")}</Notice>
      </section>
    );
  const { request: r, payment } = q.data;
  const hirer = r.role === "hirer";
  const name = (x: { nameEn: string; nameBn: string }) => (locale === "bn" ? x.nameBn : x.nameEn);

  return (
    <section className="mx-auto max-w-[1100px] px-5 py-10" data-testid="hire-request">
      <Link href={hirer ? "/me/hire" : "/pro/requests"} className="text-sm font-semibold text-brand underline">
        ← {hirer ? t("myHires") : t("desk.requests")}
      </Link>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">{t("requestTitle", { code: r.code })}</h1>
          <p className="mt-1 text-sm text-muted">
            {name(r.profile.role)} · {r.profile.headline}
          </p>
        </div>
        <span className={`border-2 px-2 py-0.5 text-sm font-bold ${TONE[requestTone(r.status)]}`} data-testid="hire-request-status">
          {t(`requestStatus.${r.status}`)}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted">{hirer ? t("pro") : t("manager")}</dt>
        <dd className="font-semibold">{r.other.name}</dd>
        <dt className="text-muted">{t("phone")}</dt>
        <dd data-testid="hire-other-phone">{r.other.phone ? <a href={`tel:${r.other.phone}`} className="font-semibold underline">{r.other.phone}</a> : <span className="text-muted">{t("phoneHidden")}</span>}</dd>
        <dt className="text-muted">{t("total")}</dt>
        <dd className="font-bold tabular-nums">{money(r.money.total)}</dd>
        {!hirer && r.money.net !== null ? (
          <>
            <dt className="text-muted">{t("youGet")}</dt>
            <dd className="tabular-nums">{t("netOfFee", { net: money(r.money.net), fee: money(r.money.fee ?? 0) })}</dd>
          </>
        ) : null}
        {r.status === "pending" && r.replyBy ? (
          <>
            <dt className="text-muted">{t("replyBy")}</dt>
            <dd>{when(r.replyBy)}</dd>
          </>
        ) : null}
        {r.note ? (
          <>
            <dt className="text-muted">{t("note")}</dt>
            <dd className="whitespace-pre-line">{r.note}</dd>
          </>
        ) : null}
        {r.declineReason ? (
          <>
            <dt className="text-muted">{t("declined")}</dt>
            <dd>{t(`declineReason.${r.declineReason}`)}</dd>
          </>
        ) : null}
      </dl>
      {payment ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-2 border-amber-400 p-4" data-testid="hire-pay-box">
          <p className="font-semibold">{t("accepted", { time: when(r.payBy), min: minutesLeft(r.payBy) })}</p>
          <Button busy={pay.isPending} onClick={() => pay.mutate()} data-testid="hire-pay">
            {t("payTotal", { total: money(r.money.total) })}
          </Button>
        </div>
      ) : null}
      {hirer && ["pending", "accepted_unpaid"].includes(r.status) ? (
        <button type="button" disabled={withdraw.isPending} onClick={() => withdraw.mutate()} className="mt-4 min-h-12 border-2 border-danger px-4 font-bold text-danger disabled:opacity-50" data-testid="hire-withdraw-request">
          {t("withdrawRequest")}
        </button>
      ) : null}
      {err ? (
        <div className="mt-3">
          <Notice tone="error">{err.title ?? t("failed")}</Notice>
        </div>
      ) : null}
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-extrabold">{r.unit === "match" ? t("matches") : t("sessions")}</h2>
          {r.jobs.length ? (
            r.jobs.map((j) => <JobCard key={j.id} job={j} side={hirer ? "hirer" : "pro"} onChange={refresh} />)
          ) : (
            <ul className="divide-y-2 divide-line border-2 border-line" data-testid="hire-quote-lines">
              {((r.quote as { lines?: QuotedLine[] }).lines ?? []).map((l) => (
                <li key={l.start} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span>
                    <strong>{when(l.start)}</strong> {l.format ? `· ${l.format}` : ""} · {l.venueText}
                  </span>
                  <span className="font-bold tabular-nums">{money(l.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Thread requestId={r.id} />
      </div>
    </section>
  );
}
