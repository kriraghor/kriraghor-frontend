"use client";

import { useEffect, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { stepUp } from "@/lib/admin/stepUp";
import { formatTaka } from "@/lib/admin/finance";
import { actionsFor, FAILURE_REASONS, groupWallet, PAYOUT_STATUSES, payouts, type FailureReason, type Payout, type PayoutStatus, type Reveal } from "@/lib/admin/payouts";
import { problemOf, type Problem } from "@kriraghor/api-client";
import { Notice } from "../../ui";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka } from "../useAdminMe";
import type { DeskMe } from "./FinanceDesk";
import { Chip, DataTable, Field, inputCls, MoreButton } from "./shared";

const PAYOUT_TONE: Record<PayoutStatus, "ok" | "warn" | "bad" | "muted"> = {
  scheduled: "warn",
  needs_approval: "warn",
  on_hold: "bad",
  processing: "warn",
  paid: "ok",
  failed: "bad",
  cancelled: "muted",
};
type CodeAction = "release" | "approve" | "retry" | "reveal";
type FormAction = "markPaid" | "markFailed" | "hold" | "cancel" | "lift";

/**
 * M07 §4.3 Payouts: status tabs with counts, a detail drawer (lines, holds, approvals) and the
 * manual disbursement flow: release → reveal the wallet number (60 s, audited) → send it in the
 * bKash / Nagad merchant app → mark paid with the reference, or failed.
 */
export function PayoutsTab({ me, openId }: { me: DeskMe; openId?: string | null }) {
  const t = useTranslations("payouts");
  const locale = useLocale();
  const qc = useQueryClient();
  const [status, setStatus] = useState<PayoutStatus>("scheduled");
  const [selected, setSelected] = useState<string | null>(openId ?? null);
  const canRelease = me.isMaster || me.permissions.includes("release_payouts");

  const q = useInfiniteQuery({
    queryKey: ["payouts", status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => payouts.list({ status, cursor: pageParam }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const counts = q.data?.pages[0]?.counts ?? {};

  return (
    <div className="mt-6">
      <div role="tablist" aria-label={t("statusTabs")} className="flex flex-wrap gap-2">
        {PAYOUT_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={status === s}
            onClick={() => setStatus(s)}
            className={`min-h-11 border-2 px-3 text-sm font-bold ${status === s ? "border-brand bg-surface text-ink" : "border-line text-muted"}`}
          >
            {t(`status.${s}`)} <span className="tabular-nums">({counts[s] ?? 0})</span>
          </button>
        ))}
      </div>
      <DataTable head={[t("payout"), t("payee"), t("account"), t("gross"), t("deductions"), t("amount"), t("statusLabel"), t("created")]} loading={q.isPending} error={q.isError} empty={!items.length} testId="payouts-table">
        {items.map((p) => (
          <tr key={p.id} className="cursor-pointer hover:bg-surface-2" onClick={() => setSelected(p.id)}>
            <td className="px-3 py-2">
              <button type="button" className="font-mono font-semibold underline" onClick={() => setSelected(p.id)}>
                {p.code}
              </button>
              {p.kind === "refund" ? <span className="block text-xs text-muted">{t("refundPayout")}</span> : null}
            </td>
            <td className="px-3 py-2">{p.payee.name ?? "–"}</td>
            <td className="px-3 py-2 font-mono text-xs">{p.account ? p.account.masked : <span className="text-danger">{t("noAccount")}</span>}</td>
            <td className="px-3 py-2 tabular-nums">{formatTaka(p.gross, locale)}</td>
            <td className="px-3 py-2 tabular-nums">{formatTaka(p.deductions + p.netting, locale)}</td>
            <td className="px-3 py-2 font-bold tabular-nums">{formatTaka(p.amount, locale)}</td>
            <td className="px-3 py-2">
              <Chip tone={PAYOUT_TONE[p.status]}>{t(`status.${p.status}`)}</Chip>
            </td>
            <td className="px-3 py-2 whitespace-nowrap">{formatDhaka(p.createdAt, locale)}</td>
          </tr>
        ))}
      </DataTable>
      <MoreButton show={Boolean(q.hasNextPage)} busy={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} />
      {selected ? (
        <PayoutDrawer
          id={selected}
          me={me}
          canRelease={canRelease}
          onClose={() => setSelected(null)}
          onChanged={async () => {
            await qc.invalidateQueries({ queryKey: ["payouts"] });
            await qc.invalidateQueries({ queryKey: ["payout", selected] });
          }}
        />
      ) : null}
    </div>
  );
}

function PayoutDrawer({ id, me, canRelease, onClose, onChanged }: { id: string; me: DeskMe; canRelease: boolean; onClose: () => void; onChanged: () => Promise<void> }) {
  const t = useTranslations("payouts");
  const locale = useLocale();
  const d = useQuery({ queryKey: ["payout", id], queryFn: () => payouts.get(id) });
  const [codeAction, setCodeAction] = useState<CodeAction | null>(null);
  const [form, setForm] = useState<FormAction | null>(null);
  const [revealed, setRevealed] = useState<Reveal | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !codeAction && !form && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [codeAction, form, onClose]);

  const p = d.data;
  const actions = p ? actionsFor(p, { isMaster: me.isMaster, canRelease }) : [];
  const activeHolds = p?.holds.filter((h) => !h.liftedAt) ?? [];

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-labelledby="payout-title" className="h-full w-full max-w-xl overflow-y-auto border-l-2 border-line-strong bg-surface p-6" data-testid="payout-drawer">
        <div className="flex items-start justify-between gap-4">
          <h2 id="payout-title" className="text-2xl font-extrabold">
            {p ? p.code : t("loading")}
          </h2>
          <button type="button" onClick={onClose} className="min-h-11 border-2 border-line px-3 font-semibold">
            {t("close")}
          </button>
        </div>
        {d.isError ? <Notice tone="error">{t("loadFailed")}</Notice> : null}
        {p ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Chip tone={PAYOUT_TONE[p.status]}>{t(`status.${p.status}`)}</Chip>
              <span className="text-3xl font-extrabold tabular-nums">{formatTaka(p.amount, locale)}</span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">{t("payee")}</dt>
              <dd>{p.payee.name ?? "–"}</dd>
              <dt className="text-muted">{t("account")}</dt>
              <dd className="font-mono">{p.account ? `${p.account.masked} (${t(`accountStatus.${p.account.status}`)})` : t("noAccount")}</dd>
              <dt className="text-muted">{t("threshold")}</dt>
              <dd className="tabular-nums">{formatTaka(p.threshold, locale)}</dd>
              {p.providerRef ? (
                <>
                  <dt className="text-muted">{t("reference")}</dt>
                  <dd className="font-mono">{p.providerRef}</dd>
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
              <dd className="tabular-nums">{p.reveals}</dd>
            </dl>

            {revealed ? <RevealPanel reveal={revealed} onDone={() => setRevealed(null)} /> : null}

            {actions.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {actions.map((a) => (
                  <button
                    key={a}
                    type="button"
                    data-testid={`payout-${a}`}
                    className={`min-h-11 border-2 px-4 font-semibold ${["release", "approve", "markPaid", "reveal", "retry"].includes(a) ? "border-brand" : "border-line"}`}
                    onClick={() => (["release", "approve", "retry", "reveal"].includes(a) ? setCodeAction(a as CodeAction) : setForm(a as FormAction))}
                  >
                    {a === "approve" ? t("approveStep", { step: p.approvals.length + 1 }) : t(`actions.${a}`)}
                  </button>
                ))}
              </div>
            ) : null}

            {activeHolds.length ? (
              <section className="mt-6">
                <h3 className="font-bold">{t("holds")}</h3>
                <ul className="mt-2 space-y-2">
                  {activeHolds.map((h) => (
                    <li key={h.id} className="border-2 border-danger p-3 text-sm">
                      <span className="font-bold">{t(`holdType.${h.type}`)}</span>
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
              <section className="mt-6">
                <h3 className="font-bold">{t("approvals")}</h3>
                <ol className="mt-2 space-y-1 text-sm">
                  {p.approvals.map((a) => (
                    <li key={a.step}>{t("approvalLine", { step: a.step, name: a.name ?? "–", when: formatDhaka(a.at, locale) })}</li>
                  ))}
                </ol>
              </section>
            ) : null}

            <section className="mt-6">
              <h3 className="font-bold">{t("lines")}</h3>
              <table className="mt-2 w-full text-left text-sm">
                <thead className="text-xs uppercase text-muted">
                  <tr>
                    <th scope="col" className="py-1">{t("line")}</th>
                    <th scope="col" className="py-1 text-right">{t("gross")}</th>
                    <th scope="col" className="py-1 text-right">{t("fee")}</th>
                    <th scope="col" className="py-1 text-right">{t("net")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {p.items.filter((i) => i.status === "included").map((i) => (
                    <tr key={i.id}>
                      <td className="py-1">{i.description}</td>
                      <td className="py-1 text-right tabular-nums">{formatTaka(i.gross, locale)}</td>
                      <td className="py-1 text-right tabular-nums">{formatTaka(i.fee, locale)}</td>
                      <td className="py-1 text-right tabular-nums">{formatTaka(i.net, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        ) : null}

        {p && codeAction ? (
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
        {p && form ? <ActionForm action={form} payoutId={p.id} onClose={() => setForm(null)} onDone={async () => { setForm(null); setRevealed(null); await onChanged(); }} /> : null}
      </aside>
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
    <div className="mt-5 border-2 border-amber-500 p-4" role="status" data-testid="payout-reveal">
      <p className="text-sm font-semibold text-muted">{t("sendTo", { type: reveal.type === "bkash" ? "bKash" : "Nagad", amount: formatTaka(reveal.amount, locale) })}</p>
      <p className="mt-1 font-mono text-3xl font-extrabold tracking-wider">{groupWallet(reveal.number)}</p>
      <p className="mt-1 font-semibold">{reveal.accountName}</p>
      <p className="mt-2 text-xs text-muted">{t("revealHides", { seconds: left })}</p>
      <button type="button" className="mt-2 min-h-11 border-2 border-line px-3 text-sm font-semibold" onClick={onDone}>
        {t("hideNow")}
      </button>
    </div>
  );
}

function LiftHold({ payoutId, holdId, onDone }: { payoutId: string; holdId: string; onDone: () => Promise<void> }) {
  const t = useTranslations("payouts");
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="mt-2 min-h-11 border-2 border-line px-3 text-sm font-semibold" onClick={() => setOpen(true)}>
        {t("actions.lift")}
      </button>
    );
  return <ActionForm action="lift" payoutId={payoutId} holdId={holdId} onClose={() => setOpen(false)} onDone={async () => { setOpen(false); await onDone(); }} />;
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

  return (
    <form onSubmit={submit} className="mt-4 border-2 border-line p-4" aria-label={t(`actions.${action}`)}>
      <h3 className="font-bold">{t(`actions.${action}`)}</h3>
      {action === "markFailed" ? (
        <Field label={t("failureLabel")}>
          <select value={reason} onChange={(e) => setReason(e.target.value as FailureReason)} className={inputCls}>
            {FAILURE_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`failureReason.${r}`)}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {action === "hold" ? (
        <Field label={t("holdScope")}>
          <select value={scope} onChange={(e) => setScope(e.target.value as "payout" | "payee")} className={inputCls}>
            <option value="payout">{t("holdScopePayout")}</option>
            <option value="payee">{t("holdScopePayee")}</option>
          </select>
        </Field>
      ) : null}
      <div className="mt-3">
        <Field label={t(`formLabel.${action}`)}>
          <input value={text} onChange={(e) => setText(e.target.value)} required={action !== "markFailed"} minLength={action === "markPaid" ? 4 : 3} maxLength={action === "markPaid" ? 120 : 300} className={inputCls} />
        </Field>
      </div>
      {problem ? (
        <div className="mt-3">
          <Notice tone="error">{problem.title}</Notice>
        </div>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="min-h-11 border-2 border-line px-4 font-semibold" onClick={onClose} disabled={busy}>
          {t("cancelForm")}
        </button>
        <button type="submit" className="min-h-11 border-2 border-brand bg-brand px-4 font-semibold text-white disabled:opacity-50" disabled={busy}>
          {t(`submit.${action}`)}
        </button>
      </div>
    </form>
  );
}

export type { Payout };
