"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { Button, DataTable, DetailLayout, Field, FilterBar, Notice, Select, Skeleton, type Column } from "@kriraghor/ui/kit";
import { stepUp } from "@/lib/admin/stepUp";
import { formatTaka } from "@/lib/admin/finance";
import { actionsFor, FAILURE_REASONS, groupWallet, PAYOUT_STATUSES, payouts, type FailureReason, type Payout, type PayoutDetail as Detail, type PayoutStatus, type Reveal } from "@/lib/admin/payouts";
import { useCursorList } from "@/lib/use-cursor-list";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../../StatusBadge";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka } from "../useAdminMe";
import type { DeskMe } from "./FinanceDesk";

type Page = Awaited<ReturnType<typeof payouts.list>>;
type Row = Page["items"][number];
type Line = Detail["items"][number];
type CodeAction = "release" | "approve" | "retry" | "reveal";
type FormAction = "markPaid" | "markFailed" | "hold" | "cancel" | "lift";

/**
 * M07 §4.3 Payouts: status chips with counts, a detail pane (lines, holds, approvals; ?id= so
 * notification links open it) and the manual disbursement flow: release → reveal the wallet number
 * (60 s, audited) → send it in the bKash / Nagad merchant app → mark paid with the reference, or failed.
 */
export function PayoutsTab({ me }: { me: DeskMe }) {
  const t = useTranslations("payouts");
  const tf = useTranslations("finance");
  const locale = useLocale();
  const qc = useQueryClient();
  const { values, set, params } = useUrlFilters({ status: { default: "scheduled", allowed: PAYOUT_STATUSES } });
  const status = values.status as PayoutStatus;
  const selected = params.get("id");
  const canRelease = me.isMaster || me.permissions.includes("release_payouts");

  const list = useCursorList<Row, Page>(["payouts", status], (cursor) => payouts.list({ status, cursor }));
  const counts = (list.counts ?? {}) as Partial<Record<PayoutStatus, number>>;
  const d = useQuery({ queryKey: ["payout", selected], enabled: Boolean(selected), queryFn: () => payouts.get(selected as string) });
  const p = d.data && d.data.id === selected ? d.data : null;

  const columns: Column<Row>[] = [
    {
      id: "payout",
      header: t("payout"),
      primary: true,
      sort: (r) => r.code,
      cell: (r) => (
        <>
          <span className="font-mono font-semibold">{r.code}</span>
          {r.kind === "refund" ? <span className="block text-xs font-normal text-muted">{t("refundPayout")}</span> : null}
        </>
      ),
    },
    { id: "payee", header: t("payee"), sort: (r) => r.payee.name, cell: (r) => r.payee.name ?? "–" },
    { id: "account", header: t("account"), hideBelow: "lg", cell: (r) => (r.account ? <span className="font-mono text-xs">{r.account.masked}</span> : <span className="text-danger">{t("noAccount")}</span>) },
    { id: "gross", header: t("gross"), align: "end", hideBelow: "xl", sort: (r) => r.gross, cell: (r) => formatTaka(r.gross, locale) },
    { id: "deductions", header: t("deductions"), align: "end", hideBelow: "xl", sort: (r) => r.deductions + r.netting, cell: (r) => formatTaka(r.deductions + r.netting, locale) },
    { id: "amount", header: t("amount"), align: "end", sort: (r) => r.amount, cell: (r) => <span className="font-semibold">{formatTaka(r.amount, locale)}</span> },
    { id: "status", header: t("statusLabel"), cell: (r) => <StatusBadge status={r.status} domain="payout">{t(`status.${r.status}`)}</StatusBadge> },
    { id: "created", header: t("created"), sort: (r) => r.createdAt, cell: (r) => <span className="whitespace-nowrap">{formatDhaka(r.createdAt, locale)}</span> },
  ];

  return (
    <div className="mt-6 flex flex-col gap-4">
      <FilterBar
        chips={{
          label: t("statusTabs"),
          value: status,
          onChange: (v) => set({ status: v }),
          options: PAYOUT_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`), count: counts[s] ?? 0 })),
        }}
      />
      <DetailLayout
        open={Boolean(selected)}
        onClose={() => set({ id: null })}
        title={p ? p.code : t("loading")}
        width={520}
        testId="payout-drawer"
        pane={
          d.isError ? (
            <Notice tone="error">{t("loadFailed")}</Notice>
          ) : p ? (
            <PayoutDetail
              key={p.id}
              payout={p}
              me={me}
              canRelease={canRelease}
              onChanged={async () => {
                await qc.invalidateQueries({ queryKey: ["payouts"] });
                await qc.invalidateQueries({ queryKey: ["payout", selected] });
              }}
            />
          ) : (
            <div role="status" aria-label={t("loading")} className="flex flex-col gap-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </div>
          )
        }
      >
        <DataTable
          label={t("statusTabs")}
          testId="payouts-table"
          columns={columns}
          rows={list.rows}
          rowId={(r) => r.id}
          loading={list.loading}
          error={list.error}
          onRetry={list.retry}
          empty={{ title: tf("empty") }}
          hasMore={list.hasMore}
          onMore={list.more}
          busy={list.busy}
          selectedId={selected}
          onRowClick={(r) => set({ id: r.id })}
        />
      </DetailLayout>
    </div>
  );
}

function PayoutDetail({ payout: p, me, canRelease, onChanged }: { payout: Detail; me: DeskMe; canRelease: boolean; onChanged: () => Promise<void> }) {
  const t = useTranslations("payouts");
  const tf = useTranslations("finance");
  const locale = useLocale();
  const [codeAction, setCodeAction] = useState<CodeAction | null>(null);
  const [form, setForm] = useState<FormAction | null>(null);
  const [revealed, setRevealed] = useState<Reveal | null>(null);

  const actions = actionsFor(p, { isMaster: me.isMaster, canRelease });
  const activeHolds = p.holds.filter((h) => !h.liftedAt);
  const lines = p.items.filter((i) => i.status === "included");
  const lineColumns: Column<Line>[] = [
    { id: "line", header: t("line"), primary: true, cell: (i) => i.description },
    { id: "gross", header: t("gross"), align: "end", cell: (i) => formatTaka(i.gross, locale) },
    { id: "fee", header: t("fee"), align: "end", cell: (i) => formatTaka(i.fee, locale) },
    { id: "net", header: t("net"), align: "end", cell: (i) => formatTaka(i.net, locale) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={p.status} domain="payout">
          {t(`status.${p.status}`)}
        </StatusBadge>
        <span className="font-display text-3xl font-bold tabular">{formatTaka(p.amount, locale)}</span>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-sm">
        <dt className="text-muted">{t("payee")}</dt>
        <dd>{p.payee.name ?? "–"}</dd>
        <dt className="text-muted">{t("account")}</dt>
        <dd className="font-mono">{p.account ? `${p.account.masked} (${t(`accountStatus.${p.account.status}`)})` : t("noAccount")}</dd>
        <dt className="text-muted">{t("threshold")}</dt>
        <dd className="tabular">{formatTaka(p.threshold, locale)}</dd>
        {p.providerRef ? (
          <>
            <dt className="text-muted">{t("reference")}</dt>
            <dd className="break-all font-mono">{p.providerRef}</dd>
          </>
        ) : null}
        {p.failureCode ? (
          <>
            <dt className="text-muted">{t("failure")}</dt>
            <dd className="text-danger">
              {t(`failureReason.${p.failureCode as FailureReason}`)}
              {p.failureNote ? `: ${p.failureNote}` : ""}
            </dd>
          </>
        ) : null}
        <dt className="text-muted">{t("reveals")}</dt>
        <dd className="tabular">{p.reveals}</dd>
      </dl>

      {revealed ? <RevealPanel reveal={revealed} onDone={() => setRevealed(null)} /> : null}

      {actions.length ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button
              key={a}
              type="button"
              size="sm"
              data-testid={`payout-${a}`}
              variant={["release", "approve", "markPaid", "reveal", "retry"].includes(a) ? "primary" : a === "cancel" ? "danger" : "secondary"}
              onClick={() => (["release", "approve", "retry", "reveal"].includes(a) ? setCodeAction(a as CodeAction) : setForm(a as FormAction))}
            >
              {a === "approve" ? t("approveStep", { step: p.approvals.length + 1 }) : t(`actions.${a}`)}
            </Button>
          ))}
        </div>
      ) : null}

      {form ? (
        <ActionForm
          action={form}
          payoutId={p.id}
          onClose={() => setForm(null)}
          onDone={async () => {
            setForm(null);
            setRevealed(null);
            await onChanged();
          }}
        />
      ) : null}

      {activeHolds.length ? (
        <section className="border-t border-line pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("holds")}</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {activeHolds.map((h) => (
              <li key={h.id} className="rounded-control border border-danger/30 bg-danger-soft/40 p-3 text-sm">
                <span className="font-semibold">{t(`holdType.${h.type}`)}</span>
                {h.reason ? <span className="block">{h.reason}</span> : null}
                {h.until ? <span className="block text-muted">{t("until", { when: formatDhaka(h.until, locale) })}</span> : null}
                {h.type === "manual" && canRelease ? (
                  <LiftHold payoutId={p.id} holdId={h.id} onDone={onChanged} />
                ) : h.type === "risk_freeze" ? (
                  <span className="block text-muted">{t("riskHoldHint")}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {p.approvals.length ? (
        <section className="border-t border-line pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("approvals")}</h3>
          <ol className="mt-2 flex flex-col gap-1 text-sm">
            {p.approvals.map((a) => (
              <li key={a.step}>{t("approvalLine", { step: a.step, name: a.name ?? "–", when: formatDhaka(a.at, locale) })}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="border-t border-line pt-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{t("lines")}</h3>
        <DataTable label={t("lines")} columns={lineColumns} rows={lines} rowId={(i) => i.id} empty={{ title: tf("empty") }} />
      </section>

      {codeAction ? (
        <CodeDialog
          title={t(`confirm.${codeAction}`, { code: p.code, amount: formatTaka(p.amount, locale) })}
          help={t(`confirmHelp.${codeAction}`, { account: p.account?.masked ?? "–" })}
          onClose={() => setCodeAction(null)}
          onConfirm={async (code) => {
            const token = await stepUp(code, "payout.approve");
            if (codeAction === "reveal") setRevealed(await payouts.reveal(p.id, token));
            else if (codeAction === "release") await payouts.release(p.id, token);
            else if (codeAction === "approve") await payouts.approve(p.id, token);
            else await payouts.retry(p.id, token);
            setCodeAction(null);
            await onChanged();
          }}
        />
      ) : null}
    </div>
  );
}

/** The full number for 60 seconds, then gone (kept in memory only, never cached or stored). */
function RevealPanel({ reveal, onDone }: { reveal: Reveal; onDone: () => void }) {
  const t = useTranslations("payouts");
  const locale = useLocale();
  const [left, setLeft] = useState(reveal.showForSeconds);
  useEffect(() => {
    const timer = window.setInterval(() => setLeft((s) => s - 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (left <= 0) onDone();
  }, [left, onDone]);
  return (
    <div className="rounded-card border border-warning/40 bg-warning-soft p-4" role="status" data-testid="payout-reveal">
      <p className="text-sm font-semibold text-muted">{t("sendTo", { type: reveal.type === "bkash" ? "bKash" : "Nagad", amount: formatTaka(reveal.amount, locale) })}</p>
      <p className="mt-1 font-mono text-3xl font-bold tracking-wider">{groupWallet(reveal.number)}</p>
      <p className="mt-1 font-semibold">{reveal.accountName}</p>
      <p className="mt-2 text-xs text-muted">{t("revealHides", { seconds: left })}</p>
      <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={onDone}>
        {t("hideNow")}
      </Button>
    </div>
  );
}

function LiftHold({ payoutId, holdId, onDone }: { payoutId: string; holdId: string; onDone: () => Promise<void> }) {
  const t = useTranslations("payouts");
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => setOpen(true)}>
        {t("actions.lift")}
      </Button>
    );
  return (
    <ActionForm
      action="lift"
      payoutId={payoutId}
      holdId={holdId}
      onClose={() => setOpen(false)}
      onDone={async () => {
        setOpen(false);
        await onDone();
      }}
    />
  );
}

/** Mark paid (reference), mark failed (reason), hold, cancel and lift: each with a reason, no code needed. */
function ActionForm({ action, payoutId, holdId, onClose, onDone }: { action: FormAction; payoutId: string; holdId?: string; onClose: () => void; onDone: () => Promise<void> }) {
  const t = useTranslations("payouts");
  const [text, setText] = useState("");
  const [reason, setReason] = useState<FailureReason>("invalid_wallet");
  const [scope, setScope] = useState<"payout" | "payee">("payout");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const v = text.trim();
      if (action === "markPaid") await payouts.markPaid(payoutId, { reference: v });
      else if (action === "markFailed") await payouts.markFailed(payoutId, { reason, note: v || undefined });
      else if (action === "hold") await payouts.hold(payoutId, { reason: v, scope });
      else if (action === "cancel") await payouts.cancel(payoutId, v);
      else await payouts.liftHold(payoutId, { holdId: holdId as string, reason: v });
      await onDone();
    } catch (err) {
      setProblem(problemOf(err) ?? { code: "UNKNOWN", title: "Something went wrong", status: 0 });
    } finally {
      setBusy(false);
    }
  }

  const id = `payout-${action}`;
  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-4 rounded-card border border-line bg-surface p-4" aria-label={t(`actions.${action}`)}>
      <h3 className="font-display text-base font-bold">{t(`actions.${action}`)}</h3>
      {action === "markFailed" ? (
        <Select id={`${id}-reason`} label={t("failureLabel")} value={reason} onChange={(e) => setReason(e.target.value as FailureReason)}>
          {FAILURE_REASONS.map((r) => (
            <option key={r} value={r}>
              {t(`failureReason.${r}`)}
            </option>
          ))}
        </Select>
      ) : null}
      {action === "hold" ? (
        <Select id={`${id}-scope`} label={t("holdScope")} value={scope} onChange={(e) => setScope(e.target.value as "payout" | "payee")}>
          <option value="payout">{t("holdScopePayout")}</option>
          <option value="payee">{t("holdScopePayee")}</option>
        </Select>
      ) : null}
      <Field
        id={`${id}-text`}
        label={t(`formLabel.${action}`)}
        value={text}
        onChange={(e) => setText(e.target.value)}
        required={action !== "markFailed"}
        minLength={action === "markPaid" ? 4 : 3}
        maxLength={action === "markPaid" ? 120 : 300}
      />
      {problem ? <Notice tone="error">{problem.title}</Notice> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
          {t("cancelForm")}
        </Button>
        <Button type="submit" variant={action === "cancel" ? "danger" : "primary"} busy={busy}>
          {t(`submit.${action}`)}
        </Button>
      </div>
    </form>
  );
}

export type { Payout };

