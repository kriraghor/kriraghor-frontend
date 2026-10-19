"use client";

import { useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { problemOf } from "@/lib/api/client";
import { stepUp } from "@/lib/admin/stepUp";
import { finance, formatTaka, parseTaka, type AdminPayment } from "@/lib/admin/finance";
import { Button, Notice } from "../../ui";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka } from "../useAdminMe";
import type { DeskMe } from "./FinanceDesk";
import { Chip, DataTable, Field, inputCls, MoreButton, TONE } from "./shared";

const STATUSES = ["succeeded", "pending", "failed", "partially_refunded", "refunded", "expired", "initiated"] as const;

/** Payments list with a detail panel: attempts, escrow hold, refunds and ledger postings, plus "Refund". */
export function PaymentsTab({ me }: { me: DeskMe }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const [status, setStatus] = useState<(typeof STATUSES)[number] | "">("");
  const [code, setCode] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const q = useInfiniteQuery({
    queryKey: ["finance-payments", status, code],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => finance.payments({ status: status || undefined, code: code.trim() || undefined, cursor: pageParam }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("status")}>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputCls}>
            <option value="">{t("all")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`paymentStatus.${s}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("code")}>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PAY-26-000001" className={`${inputCls} font-mono`} />
        </Field>
      </div>
      <DataTable head={[t("code"), t("what"), t("payer"), t("amount"), t("status"), t("method"), t("when")]} loading={q.isPending} error={q.isError} empty={!items.length} testId="finance-payments">
        {items.map((p) => (
          <tr key={p.id} className={open === p.id ? "bg-surface-2" : undefined}>
            <td className="px-3 py-2 font-mono">
              <button type="button" className="underline" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}>
                {p.code}
              </button>
            </td>
            <td className="px-3 py-2">{p.title}</td>
            <td className="px-3 py-2">{p.payer?.name ?? "–"}</td>
            <td className="px-3 py-2 tabular-nums">{formatTaka(p.amount, locale)}</td>
            <td className="px-3 py-2">
              <Chip tone={TONE[p.status] ?? "muted"}>{t(`paymentStatus.${p.status}`)}</Chip>
            </td>
            <td className="px-3 py-2">{p.methodDisplay ?? "–"}</td>
            <td className="px-3 py-2 whitespace-nowrap">{formatDhaka(p.createdAt, locale)}</td>
          </tr>
        ))}
      </DataTable>
      <MoreButton show={Boolean(q.hasNextPage)} busy={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} />
      {open ? <PaymentDetail id={open} me={me} /> : null}
    </div>
  );
}

function PaymentDetail({ id, me }: { id: string; me: DeskMe }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["finance-payment", id], queryFn: () => finance.payment(id) });
  if (q.isPending) return <div className="mt-6 h-40 animate-pulse bg-surface-2" role="status" aria-label={t("loading")} />;
  if (q.isError || !q.data) return <Notice tone="error">{t("loadFailed")}</Notice>;
  const p = q.data;
  return (
    <section className="mt-6 border-2 border-line-strong bg-surface p-5" aria-labelledby="payment-detail">
      <h2 id="payment-detail" className="text-xl font-extrabold">
        {p.code} · {formatTaka(p.amount, locale)}
      </h2>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted">{t("payer")}</dt>
        <dd>{p.payer?.name ?? "–"}</dd>
        <dt className="text-muted">{t("payee")}</dt>
        <dd>{p.payee?.name ?? "–"}</dd>
        <dt className="text-muted">{t("captured")}</dt>
        <dd className="tabular-nums">{formatTaka(p.captured, locale)}</dd>
        <dt className="text-muted">{t("refunded")}</dt>
        <dd className="tabular-nums">{formatTaka(p.refunded, locale)}</dd>
        <dt className="text-muted">{t("gatewayRef")}</dt>
        <dd className="font-mono">{p.providerTrxId ?? "–"}</dd>
      </dl>

      <h3 className="mt-5 font-bold">{t("attempts")}</h3>
      <ul className="mt-1 text-sm">
        {p.attempts.map((a) => (
          <li key={a.id}>
            {formatDhaka(a.startedAt, locale)} · {a.method ?? "–"} · <Chip tone={TONE[a.status] ?? "muted"}>{a.status}</Chip> {a.failureCode ? `(${a.failureCode})` : ""}
          </li>
        ))}
      </ul>

      {p.hold ? (
        <>
          <h3 className="mt-5 font-bold">{t("hold")}</h3>
          <p className="text-sm">
            <Chip tone={TONE[p.hold.status] ?? "muted"}>{t(`holdStatus.${p.hold.status}`)}</Chip> {t("holdLine", { held: formatTaka(p.hold.held, locale), available: formatTaka(p.hold.available, locale), bps: p.hold.fee.bps / 100 })}
          </p>
        </>
      ) : null}

      <h3 className="mt-5 font-bold">{t("ledger")}</h3>
      <ul className="mt-1 text-sm">
        {p.ledger.map((l) => (
          <li key={l.id} className="font-mono">
            {l.kind} · {formatTaka(l.total, locale)}
          </li>
        ))}
      </ul>

      {p.refunds.length ? (
        <>
          <h3 className="mt-5 font-bold">{t("tabs.refunds")}</h3>
          <ul className="mt-1 text-sm">
            {p.refunds.map((r) => (
              <li key={r.id}>
                {formatTaka(r.amount, locale)} · <Chip tone={TONE[r.status] ?? "muted"}>{t(`refundStatus.${r.status}`)}</Chip> · {r.reasonCode}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {["succeeded", "partially_refunded"].includes(p.status) && (me.isMaster || me.permissions.includes("refund_small")) ? <RefundForm payment={p} me={me} /> : null}
    </section>
  );
}

const REASONS = ["customer_request", "service_not_delivered", "duplicate_payment", "dispute_upheld", "goodwill_gesture"] as const;

function RefundForm({ payment, me }: { payment: AdminPayment; me: DeskMe }) {
  const t = useTranslations("finance");
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<(typeof REASONS)[number]>("customer_request");
  const [text, setText] = useState("");
  const [goodwill, setGoodwill] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [needCode, setNeedCode] = useState(false);
  const poisha = parseTaka(amount);
  const body = poisha ? { paymentId: payment.id, amount: poisha, reasonCode: reason, reasonText: text || undefined, goodwill: goodwill || undefined } : null;

  const done = async (status: string) => {
    setMsg({ tone: "info", text: status === "pending_master" ? t("refundEscalated") : t("refundStarted") });
    setAmount("");
    await Promise.all([qc.invalidateQueries({ queryKey: ["finance-payment", payment.id] }), qc.invalidateQueries({ queryKey: ["finance-refunds"] })]);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body) return;
    setBusy(true);
    setMsg(null);
    try {
      await done((await finance.createRefund(body)).status);
    } catch (err) {
      const p = problemOf(err);
      if (p?.code === "STEP_UP_REQUIRED") setNeedCode(true);
      else setMsg({ tone: "error", text: p?.title ?? t("loadFailed") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 border-t-2 border-line pt-4">
      <h3 className="font-bold">{t("refund")}</h3>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <Field label={t("amountTaka")}>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={`${inputCls} w-36 tabular-nums`} aria-invalid={amount !== "" && !poisha} />
        </Field>
        <Field label={t("reason")}>
          <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className={inputCls}>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`reasons.${r}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("note")}>
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} className={`${inputCls} w-64`} />
        </Field>
        {me.isMaster ? (
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={goodwill} onChange={(e) => setGoodwill(e.target.checked)} className="size-5 accent-brand" />
            {t("goodwill")}
          </label>
        ) : null}
        <Button type="submit" busy={busy} disabled={!body}>
          {t("refund")}
        </Button>
      </div>
      {msg ? (
        <div className="mt-3">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      ) : null}
      {needCode && body ? (
        <CodeDialog
          title={t("refundCodeTitle")}
          help={t("refundCodeHelp")}
          onClose={() => setNeedCode(false)}
          onConfirm={async (code) => {
            const token = await stepUp(code, "refund.large");
            const r = await finance.createRefund(body, token);
            setNeedCode(false);
            await done(r.status);
          }}
        />
      ) : null}
    </form>
  );
}
