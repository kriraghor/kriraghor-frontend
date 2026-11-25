"use client";

import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { problemOf } from "@kriraghor/api-client";
import { Button, Checkbox, DataTable, DetailLayout, Field, FilterBar, Notice, Select, Skeleton, type Column } from "@kriraghor/ui/kit";
import { stepUp } from "@/lib/admin/stepUp";
import { finance, formatTaka, parseTaka, type AdminPayment } from "@/lib/admin/finance";
import { useCursorList } from "@/lib/use-cursor-list";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../../StatusBadge";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka } from "../useAdminMe";
import type { DeskMe } from "./FinanceDesk";

type Row = Awaited<ReturnType<typeof finance.payments>>["items"][number];

const STATUSES = ["succeeded", "pending", "failed", "partially_refunded", "refunded", "expired", "initiated"] as const;

/** Payments list with a detail pane (?id=): attempts, escrow hold, refunds and ledger postings, plus "Refund". */
export function PaymentsTab({ me }: { me: DeskMe }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const { values, set, clear, params } = useUrlFilters({ status: { default: "", allowed: ["", ...STATUSES] }, code: { default: "" } });
  const status = values.status as AdminPayment["status"] | "";
  const code = values.code;
  const open = params.get("id");
  const list = useCursorList<Row>(["finance-payments", status, code], (cursor) => finance.payments({ status: status || undefined, code: code.trim() || undefined, cursor }));
  const detail = useQuery({ queryKey: ["finance-payment", open], enabled: Boolean(open), queryFn: () => finance.payment(open as string) });

  const columns: Column<Row>[] = [
    { id: "code", header: t("code"), primary: true, sort: (p) => p.code, cell: (p) => <span className="font-mono">{p.code}</span> },
    { id: "what", header: t("what"), cell: (p) => p.title },
    { id: "payer", header: t("payer"), hideBelow: "lg", sort: (p) => p.payer?.name, cell: (p) => p.payer?.name ?? "–" },
    { id: "amount", header: t("amount"), align: "end", sort: (p) => p.amount, cell: (p) => formatTaka(p.amount, locale) },
    { id: "status", header: t("status"), sort: (p) => p.status, cell: (p) => <StatusBadge status={p.status}>{t(`paymentStatus.${p.status}`)}</StatusBadge> },
    { id: "method", header: t("method"), hideBelow: "xl", cell: (p) => p.methodDisplay ?? "–" },
    { id: "when", header: t("when"), sort: (p) => p.createdAt, cell: (p) => <span className="whitespace-nowrap">{formatDhaka(p.createdAt, locale)}</span> },
  ];

  const p = detail.data && detail.data.id === open ? detail.data : null;

  return (
    <div className="mt-6 flex flex-col gap-4">
      <FilterBar
        search={{ value: code, onChange: (v) => set({ code: v }), label: t("code"), placeholder: "PAY-26-000001" }}
        selects={[
          {
            id: "status",
            label: t("status"),
            value: status,
            onChange: (v) => set({ status: v }),
            anyLabel: t("all"),
            options: STATUSES.map((s) => ({ value: s, label: t(`paymentStatus.${s}`) })),
          },
        ]}
        onClear={clear}
      />
      <DetailLayout
        open={Boolean(open)}
        onClose={() => set({ id: null })}
        title={p ? `${p.code} · ${formatTaka(p.amount, locale)}` : t("loading")}
        testId="payment-detail"
        pane={
          detail.isError ? (
            <Notice tone="error">{t("loadFailed")}</Notice>
          ) : p ? (
            <PaymentDetail payment={p} me={me} />
          ) : (
            <div role="status" aria-label={t("loading")} className="flex flex-col gap-2">
              <Skeleton className="h-6" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          )
        }
      >
        <DataTable
          label={t("tabs.payments")}
          testId="finance-payments"
          columns={columns}
          rows={list.rows}
          rowId={(r) => r.id}
          loading={list.loading}
          error={list.error}
          onRetry={list.retry}
          empty={{ title: t("empty") }}
          hasMore={list.hasMore}
          total={list.total}
          onMore={list.more}
          busy={list.busy}
          selectedId={open}
          onRowClick={(r) => set({ id: open === r.id ? null : r.id })}
        />
      </DetailLayout>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <div className="mt-2 text-sm">{children}</div>
    </section>
  );
}

function PaymentDetail({ payment: p, me }: { payment: AdminPayment; me: DeskMe }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={p.status}>{t(`paymentStatus.${p.status}`)}</StatusBadge>
        <span className="text-sm text-muted">{p.title}</span>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-sm">
        <dt className="text-muted">{t("payer")}</dt>
        <dd>{p.payer?.name ?? "–"}</dd>
        <dt className="text-muted">{t("payee")}</dt>
        <dd>{p.payee?.name ?? "–"}</dd>
        <dt className="text-muted">{t("captured")}</dt>
        <dd className="tabular">{formatTaka(p.captured, locale)}</dd>
        <dt className="text-muted">{t("refunded")}</dt>
        <dd className="tabular">{formatTaka(p.refunded, locale)}</dd>
        <dt className="text-muted">{t("gatewayRef")}</dt>
        <dd className="break-all font-mono">{p.providerTrxId ?? "–"}</dd>
      </dl>

      <Section title={t("attempts")}>
        <ul className="flex flex-col gap-1.5">
          {p.attempts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2">
              <span>{formatDhaka(a.startedAt, locale)}</span>
              <span className="text-muted">{a.method ?? "–"}</span>
              <StatusBadge status={a.status}>{a.status}</StatusBadge>
              {a.failureCode ? <span className="font-mono text-xs text-danger">{a.failureCode}</span> : null}
            </li>
          ))}
        </ul>
      </Section>

      {p.hold ? (
        <Section title={t("hold")}>
          <p className="flex flex-wrap items-center gap-2">
            <StatusBadge status={p.hold.status}>{t(`holdStatus.${p.hold.status}`)}</StatusBadge>
            <span>{t("holdLine", { held: formatTaka(p.hold.held, locale), available: formatTaka(p.hold.available, locale), bps: p.hold.fee.bps / 100 })}</span>
          </p>
        </Section>
      ) : null}

      <Section title={t("ledger")}>
        <ul className="flex flex-col gap-1">
          {p.ledger.map((l) => (
            <li key={l.id} className="flex justify-between gap-3">
              <span className="font-mono">{l.kind}</span>
              <span className="tabular">{formatTaka(l.total, locale)}</span>
            </li>
          ))}
        </ul>
      </Section>

      {p.refunds.length ? (
        <Section title={t("tabs.refunds")}>
          <ul className="flex flex-col gap-1.5">
            {p.refunds.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <span className="tabular">{formatTaka(r.amount, locale)}</span>
                <StatusBadge status={r.status}>{t(`refundStatus.${r.status}`)}</StatusBadge>
                <span className="text-muted">{t.has(`reasons.${r.reasonCode}`) ? t(`reasons.${r.reasonCode}`) : r.reasonCode}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {["succeeded", "partially_refunded"].includes(p.status) && (me.isMaster || me.permissions.includes("refund_small")) ? <RefundForm payment={p} me={me} /> : null}
    </div>
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
    <>
      <form onSubmit={submit} className="flex flex-col gap-4 border-t border-line pt-4">
        <h3 className="font-display text-lg font-bold">{t("refund")}</h3>
        <Field
          id="refund-amount"
          label={t("amountTaka")}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          inputClassName="tabular"
          aria-invalid={amount !== "" && !poisha}
        />
        <Select id="refund-reason" label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {t(`reasons.${r}`)}
            </option>
          ))}
        </Select>
        <Field id="refund-text" label={t("note")} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
        {me.isMaster ? <Checkbox id="refund-goodwill" label={t("goodwill")} checked={goodwill} onChange={(e) => setGoodwill(e.target.checked)} /> : null}
        <div>
          <Button type="submit" busy={busy} disabled={!body} confirm={{ kind: "money", title: t("ask.refund"), confirmLabel: t("refund") }}>
            {t("refund")}
          </Button>
        </div>
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      </form>
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
    </>
  );
}

