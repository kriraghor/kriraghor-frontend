"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { newKey } from "@/lib/bookings";
import { orders, STEPS, stepIndex, statusTone, type OrderResult, type SubOrder } from "@/lib/orders";
import { formatTaka } from "@/lib/payments";
import { MePanel } from "../MePanel";
import { RateSourceButtons } from "@kriraghor/ui/trust";
import { Button, Notice } from "@kriraghor/ui/primitives";
import { TONE } from "./MyOrders";
import { BackLink, useConfirm } from "@kriraghor/ui/kit";

/**
 * /me/orders/[code] (M13 FR-13, FR-14): each shop's part of the order with its progress, the items,
 * the courier and tracking number, the deadlines, and what the buyer can do now: pay an unpaid order,
 * cancel (before the shop accepts, or once shipping is late), confirm received, or report it not
 * received (an M17 dispute: the money stays held until our team decides).
 */
export function OrderView({ code }: { code: string }) {
  const t = useTranslations("orders");
  const locale = useLocale();
  const { status } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["order", code], queryFn: () => orders.one(code), enabled: status === "signed_in", retry: false });
  const set = (r: OrderResult) => {
    qc.setQueryData(["order", code], r);
    void qc.invalidateQueries({ queryKey: ["my-orders"] });
  };
  const pay = useMutation({ mutationFn: () => orders.pay(code), onSuccess: (r) => r.payment && window.location.assign(r.payment.payUrl) });
  const when = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso)) : "");
  const money = (n: number) => formatTaka(n, locale);

  if (status === "signed_out") return <MePanel />;
  if (q.isPending) return <div className="rounded-control mx-auto mt-10 h-64 max-w-[1100px] kg-shimmer bg-surface-2" />;
  if (q.isError || !q.data)
    return (
      <section className="mx-auto max-w-[1100px] px-5 py-10">
        <Notice tone="error">{t("orderNotFound")}</Notice>
      </section>
    );
  const { order, payment } = q.data;
  return (
    <section className="mx-auto max-w-[1100px] px-5 py-10" data-testid="order">
      <BackLink href="/me/orders">{t("myOrders")}</BackLink>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-extrabold">{t("orderTitle", { code: order.code })}</h1>
        <span className="text-lg font-bold">{money(order.money.total)}</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {t("shipToLine", { name: order.shipTo.name, line: order.shipTo.line, last4: order.shipTo.phoneLast4 })}
      </p>
      {payment ? (
        <div className="rounded-card mt-4 flex flex-wrap items-center gap-3 border border-warning p-4">
          <p className="font-semibold">{t("unpaid", { time: when(order.payBy) })}</p>
          <Button busy={pay.isPending} onClick={() => pay.mutate()} data-testid="pay-order">
            {t("payTotal", { total: money(order.money.total) })}
          </Button>
        </div>
      ) : null}
      <div className="mt-6 flex flex-col gap-6">
        {order.subOrders.map((s) => (
          <SubOrderCard key={s.id} s={s} when={when} money={money} onChange={set} />
        ))}
      </div>
    </section>
  );
}

function SubOrderCard({ s, when, money, onChange }: { s: SubOrder; when: (iso: string | null | undefined) => string; money: (n: number) => string; onChange: (r: OrderResult) => void }) {
  const t = useTranslations("orders");
  const locale = useLocale();
  const router = useRouter();
  const [reporting, setReporting] = useState(false);
  const [statement, setStatement] = useState("");
  const ask = useConfirm();
  const a = useTranslations("ask");
  const cancel = useMutation({ mutationFn: () => orders.cancel(s.id), onSuccess: onChange });
  const received = useMutation({ mutationFn: () => orders.received(s.id), onSuccess: onChange });
  const report = useMutation({ mutationFn: () => orders.notReceived(s.id, statement, newKey()), onSuccess: (r: { dispute?: { code?: string } }) => r.dispute?.code && router.push(`/me/disputes/${r.dispute.code}`) });
  const err = [cancel, received, report].map((m) => (m.error ? problemOf(m.error) : null)).find(Boolean);
  const step = stepIndex(s.status);
  const label = (l: { variantLabelEn: string; variantLabelBn: string }) => (locale === "bn" ? l.variantLabelBn : l.variantLabelEn);

  return (
    <article className="rounded-card border border-line" data-testid="sub-order">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-line px-4 py-3">
        <div>
          <p className="font-extrabold">{s.shop?.name}</p>
          <p className="text-xs text-muted">{s.code}</p>
        </div>
        <span className={`rounded-pill border px-2 py-0.5 text-sm font-bold ${TONE[statusTone(s.status)]}`} data-testid="sub-status">
          {t(`status.${s.status}`)}
        </span>
      </header>
      {step >= 0 ? (
        <ol className="grid grid-cols-5 gap-1 px-4 pt-4 text-center text-xs font-semibold" aria-label={t("progress")}>
          {STEPS.map((k, i) => (
            <li key={k} className={`border-t-4 pt-1 ${i <= step ? "border-brand text-ink" : "border-line text-muted"}`} aria-current={i === step ? "step" : undefined}>
              {t(`status.${k}`)}
            </li>
          ))}
        </ol>
      ) : null}
      <ul className="divide-y-2 divide-line px-4">
        {s.items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-3">
            {i.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={i.photoUrl} alt="" className="h-14 w-14 object-cover" />
            ) : (
              <div className="h-14 w-14 bg-surface-2" />
            )}
            <span className="min-w-0 flex-1">
              {i.qty} × {i.title} {label(i)}
            </span>
            <span className="font-semibold">{money(i.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t-2 border-line px-4 py-3 text-sm">
        <dt className="text-muted">{t("delivery")}</dt>
        <dd>{money(s.money.delivery)}</dd>
        <dt className="text-muted">{t("total")}</dt>
        <dd className="font-bold">{money(s.money.total)}</dd>
        {s.money.refunded ? (
          <>
            <dt className="text-muted">{t("refunded")}</dt>
            <dd data-testid="sub-refunded">{money(s.money.refunded)}</dd>
          </>
        ) : null}
        {s.status === "placed" && s.acceptBy ? (
          <>
            <dt className="text-muted">{t("acceptBy")}</dt>
            <dd>{when(s.acceptBy)}</dd>
          </>
        ) : null}
        {s.status === "accepted" && s.shipBy ? (
          <>
            <dt className="text-muted">{t("shipBy")}</dt>
            <dd>{when(s.shipBy)}</dd>
          </>
        ) : null}
        {s.courier ? (
          <>
            <dt className="text-muted">{t("courier")}</dt>
            <dd data-testid="sub-tracking">
              {s.courier.name} · {s.courier.trackingNo}
            </dd>
          </>
        ) : null}
        {s.status === "delivered" && s.completeBy ? (
          <>
            <dt className="text-muted">{t("completesOn")}</dt>
            <dd>{when(s.completeBy)}</dd>
          </>
        ) : null}
        {s.cancelReason ? (
          <>
            <dt className="text-muted">{t("reason")}</dt>
            <dd>{t.has(`reasons.${s.cancelReason}`) ? t(`reasons.${s.cancelReason}`) : s.cancelReason}</dd>
          </>
        ) : null}
      </dl>
      <div className="flex flex-wrap gap-3 border-t-2 border-line px-4 py-3">
        {s.can.received ? (
          <Button busy={received.isPending} confirm={{ kind: "money", title: a("orderReceived"), body: a("orderReceivedBody"), confirmLabel: t("received") }} onClick={() => received.mutate()} data-testid="received">
            {t("received")}
          </Button>
        ) : null}
        {s.can.notReceived && !reporting ? (
          <button type="button" onClick={() => setReporting(true)} className="rounded-control min-h-12 border border-line-strong/60 px-4 font-bold hover:border-brand" data-testid="not-received">
            {t("notReceived")}
          </button>
        ) : null}
        {s.can.cancel ? (
          <button type="button" disabled={cancel.isPending} onClick={() => void ask({ kind: "remove", title: a("cancelOrder"), confirmLabel: a("yesCancel") }).then((ok) => ok && cancel.mutate())} className="rounded-control min-h-12 border border-danger px-4 font-bold text-danger disabled:opacity-50" data-testid="cancel-sub">
            {s.status === "accepted" ? t("cancelLate") : t("cancel")}
          </button>
        ) : null}
        {s.disputeId ? (
          <Link href="/me/disputes" className="inline-flex min-h-12 items-center font-semibold text-brand underline">
            {t("seeCase")}
          </Link>
        ) : null}
        {/* M17-FR-30: rate the shop once this part is completed (shown while it waits for a rating). */}
        {s.status === "completed" ? <RateSourceButtons sourceType="sub_order" sourceIds={[s.id]} /> : null}
      </div>
      {reporting ? (
        <form
          className="flex flex-col gap-3 border-t-2 border-line px-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            report.mutate();
          }}
        >
          <label htmlFor={`nr-${s.id}`} className="font-semibold">
            {t("notReceivedWhat")}
          </label>
          <textarea id={`nr-${s.id}`} value={statement} onChange={(e) => setStatement(e.target.value)} minLength={10} maxLength={2000} required rows={4} className="surface-card p-3" data-testid="not-received-text" />
          <p className="text-sm text-muted">{t("notReceivedNote", { closes: when(s.notReceivedClosesAt) || t("untilResolved") })}</p>
          <div>
            <Button busy={report.isPending} confirm={{ kind: "send", title: a("sendReport") }} data-testid="not-received-send">
              {t("sendReport")}
            </Button>
          </div>
        </form>
      ) : null}
      {err ? (
        <div className="px-4 pb-4">
          <Notice tone="error">{err.code === "CANCEL_NOT_YET" ? t("cancelNotYet") : (err.title ?? t("failed"))}</Notice>
        </div>
      ) : null}
    </article>
  );
}
