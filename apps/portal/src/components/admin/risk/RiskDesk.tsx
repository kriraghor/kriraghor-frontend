"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { stepUp } from "@/lib/admin/stepUp";
import { MASTER_ACTIONS, SEVERITY_ORDER, riskAdmin, stepUpScope, type RiskActionName, type Severity } from "@/lib/admin/risk";
import { Notice } from "@kriraghor/ui/primitives";
import { CodeDialog } from "../CodeDialog";
import { Chip, inputCls } from "../finance/shared";
import { formatDhaka, useAdminMe } from "../useAdminMe";

const TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = { critical: "bad", high: "bad", medium: "warn", info: "muted" };

function useAccess() {
  const { ready, me } = useAdminMe();
  const allowed = Boolean(me && (me.isMaster || me.permissions.includes("manage_users" as never)));
  return { ready, allowed, isMaster: Boolean(me?.isMaster) };
}

/**
 * /admin/risk (M18 §4): open flags by severity, critical first, and the rules with their live
 * thresholds. Masters change a threshold through an M03 change request (step-up settings.write);
 * every account re-evaluates when it applies. Flags never act on their own (Q101): a person opens the
 * account and decides.
 */
export function RiskDesk() {
  const t = useTranslations("riskDesk");
  const locale = useLocale();
  const { ready, allowed, isMaster } = useAccess();
  const [severity, setSeverity] = useState<Severity | "">("");
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const ov = useQuery({ queryKey: ["risk-overview"], enabled: ready && allowed, queryFn: () => riskAdmin.overview() });
  const fl = useQuery({ queryKey: ["risk-flags", severity], enabled: ready && allowed, queryFn: () => riskAdmin.flags({ severity: severity || undefined }) });

  return (
    <>
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>
        {ready && !allowed ? (
          <div className="mt-6 max-w-3xl">
            <Notice tone="error">{t("noAccess")}</Notice>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="risk-counts">
              {SEVERITY_ORDER.map((s) => (
                <button key={s} type="button" onClick={() => setSeverity(severity === s ? "" : s)} aria-pressed={severity === s} className={`border-2 p-4 text-left ${severity === s ? "border-brand" : "border-line"}`}>
                  <span className="block text-xs font-bold uppercase tracking-wide text-muted">{t(`severity.${s}`)}</span>
                  <span className="block text-3xl font-extrabold tabular-nums">{ov.data?.counts[s] ?? "–"}</span>
                </button>
              ))}
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="overflow-x-auto border-2 border-line">
                <table className="w-full min-w-[720px] text-sm" data-testid="risk-flags">
                  <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2">{t("col.account")}</th>
                      <th className="px-3 py-2">{t("col.rule")}</th>
                      <th className="px-3 py-2">{t("col.severity")}</th>
                      <th className="px-3 py-2">{t("col.status")}</th>
                      <th className="px-3 py-2">{t("col.seen")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(fl.data?.items ?? []).map((f) => (
                      <tr key={f.id} className="border-t border-line hover:bg-surface-2">
                        <td className="px-3 py-2">
                          <Link href={`/admin/risk/accounts/${f.userId}`} className="font-semibold text-brand underline" data-testid="risk-account-link">
                            {(f as { user?: { displayName?: string | null } }).user?.displayName ?? f.userId.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <span className="block font-semibold">{t(`rule.${f.ruleKey}`)}</span>
                          <span className="block text-xs text-muted">{f.reasonText}</span>
                        </td>
                        <td className="px-3 py-2">
                          <Chip tone={TONE[f.severity] ?? "muted"}>{t(`severity.${f.severity}`)}</Chip>
                        </td>
                        <td className="px-3 py-2">{t(`status.${f.status}`)}</td>
                        <td className="px-3 py-2">{formatDhaka(f.lastSeenAt, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!fl.isPending && !fl.data?.items.length ? <p className="p-4 text-muted">{t("empty")}</p> : null}
              </div>
              <div className="border-2 border-line p-4">
                <h2 className="font-extrabold">{t("rules")}</h2>
                <ul className="mt-2 divide-y divide-line text-sm" data-testid="risk-rules">
                  {(ov.data?.rules ?? []).map((r) => (
                    <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>
                        <span className="block font-semibold">{t(`rule.${r.key}`)}</span>
                        <span className="block text-xs text-muted">
                          {t(`severity.${r.severity}`)} · {r.settingKey ? t("threshold", { value: r.threshold }) : t("presence")} · {t("openCount", { n: r.open })}
                        </span>
                      </span>
                      {isMaster && r.settingKey ? (
                        <button type="button" onClick={() => (setEditing({ key: r.settingKey!, value: String(r.threshold) }), setSent(false))} className="min-h-11 border-2 border-line px-3 text-xs font-semibold">
                          {t("change")}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {sent ? <Notice>{t("proposed")}</Notice> : null}
              </div>
            </div>
          </>
        )}
        {editing ? (
          <CodeDialog
            title={t("changeTitle", { key: editing.key })}
            help={t("changeHelp")}
            onClose={() => setEditing(null)}
            onConfirm={async (c) => {
              const value = Number(editing.value);
              if (!Number.isFinite(value) || reason.trim().length < 5) throw { code: "VALIDATION_FAILED", title: t("changeInvalid"), status: 422 };
              const token = await stepUp(c, "settings.write");
              await riskAdmin.thresholds([{ key: editing.key, to: value }], reason.trim(), token);
              setEditing(null);
              setSent(true);
            }}
          >
            <label htmlFor="risk-threshold" className="mt-4 block text-sm font-semibold text-muted">
              {t("newValue")}
            </label>
            <input id="risk-threshold" inputMode="decimal" value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} className={`${inputCls} mt-1 w-full`} />
            <label htmlFor="risk-threshold-reason" className="mt-3 block text-sm font-semibold text-muted">
              {t("reason")}
            </label>
            <input id="risk-threshold-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className={`${inputCls} mt-1 w-full`} />
          </CodeDialog>
        ) : null}
      </div>
    </>
  );
}

/**
 * /admin/risk/accounts/[userId] (M18 §4): the account's flags with their values and reasons, the actions
 * timeline with Undo, reliability, payout holds and document requests, and the action buttons. Each
 * action needs a reason; freezes and bans are a master's, confirmed with an authenticator code.
 */
export function RiskAccountView({ userId }: { userId: string }) {
  const t = useTranslations("riskDesk");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready, allowed, isMaster } = useAccess();
  const q = useQuery({ queryKey: ["risk-account", userId], enabled: ready && allowed, queryFn: () => riskAdmin.account(userId) });
  const [flagId, setFlagId] = useState<string | undefined>(undefined);
  const [action, setAction] = useState<RiskActionName>("request_documents");
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("7");
  const [docType, setDocType] = useState<"nid" | "trade_license" | "deed_or_lease" | "tin">("nid");
  const [codeFor, setCodeFor] = useState<{ kind: "act" } | { kind: "undo"; id: string; scope: "risk.manage" | "user.ban" } | null>(null);
  const [undoReason, setUndoReason] = useState("");
  const refresh = () => (qc.invalidateQueries({ queryKey: ["risk-account", userId] }), qc.invalidateQueries({ queryKey: ["risk-flags"] }), qc.invalidateQueries({ queryKey: ["risk-overview"] }));
  const body = () => ({ action, flagId, reason: reason.trim(), params: action === "suspend" ? { days: Number(days) } : action === "request_documents" ? { docType } : {} });
  const take = useMutation({ mutationFn: () => riskAdmin.act(userId, body()), onSuccess: () => (setReason(""), refresh()) });
  const undo = useMutation({ mutationFn: (id: string) => riskAdmin.undo(id, undoReason.trim()), onSuccess: () => (setUndoReason(""), refresh()) });
  const problem = problemOf(take.error) ?? problemOf(undo.error);

  if (ready && !allowed) return <Notice tone="error">{t("noAccess")}</Notice>;
  if (q.isPending) return <div className="mx-auto mt-10 h-96 max-w-[1320px] animate-pulse bg-surface-2" />;
  if (!q.data) return <Notice tone="error">{t("loadFailed")}</Notice>;
  const acc = q.data;
  const choices: RiskActionName[] = ["request_documents", "clear", "suspend", ...(isMaster ? (["freeze_payouts", "ban"] as RiskActionName[]) : [])];
  const scope = stepUpScope(action);
  const ready2 = reason.trim().length >= 10 && (action !== "clear" || Boolean(flagId));

  return (
    <>
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
        <Link href="/admin/risk" className="text-sm font-semibold text-brand underline">
          ← {t("title")}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold">{acc.user.displayName ?? userId.slice(0, 8)}</h1>
          <Chip tone={TONE[acc.riskLevel] ?? "ok"}>{t(`level.${acc.riskLevel}`)}</Chip>
          <span className="text-sm text-muted">
            {t("accountStatus", { status: acc.user.status })} · {t("kyc", { status: acc.user.kycStatus ?? "–" })}
          </span>
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="space-y-6">
            <section>
              <h2 className="text-lg font-extrabold">{t("flags")}</h2>
              <ul className="mt-2 space-y-2" data-testid="account-flags">
                {acc.flags.map((f) => (
                  <li key={f.id} className={`border-2 p-3 text-sm ${flagId === f.id ? "border-brand" : "border-line"}`}>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input type="radio" name="flag" checked={flagId === f.id} onChange={() => setFlagId(f.id)} className="mt-1" />
                      <span className="flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">{t(`rule.${f.ruleKey}`)}</span>
                          <Chip tone={TONE[f.severity] ?? "muted"}>{t(`severity.${f.severity}`)}</Chip>
                          <span className="text-muted">{t(`status.${f.status}`)}</span>
                          {f.escalated ? <span className="text-xs font-bold text-danger">{t("escalated")}</span> : null}
                        </span>
                        <span className="block text-muted">{f.reasonText}</span>
                        <span className="block text-xs text-muted">{t("seen", { first: formatDhaka(f.firstSeenAt, locale), last: formatDhaka(f.lastSeenAt, locale) })}</span>
                      </span>
                    </label>
                  </li>
                ))}
                {!acc.flags.length ? <li className="text-muted">{t("noFlags")}</li> : null}
              </ul>
            </section>
            <section>
              <h2 className="text-lg font-extrabold">{t("timeline")}</h2>
              <ol className="mt-2 divide-y divide-line border-y-2 border-line text-sm" data-testid="account-actions">
                {acc.actions.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-semibold">{t(`action.${x.action}`)}</span> · {t(`role.${x.actorRole}`)} · {formatDhaka(x.createdAt, locale)}
                      <span className="block text-muted">{x.reason}</span>
                    </span>
                    {x.undone ? (
                      <span className="text-xs text-muted">{t("undone")}</span>
                    ) : x.undoable ? (
                      <button
                        type="button"
                        disabled={undoReason.trim().length < 10 || ((x.action === "freeze_payouts" || x.action === "ban") && !isMaster)}
                        onClick={() => {
                          const s = stepUpScope(x.action);
                          if (s) setCodeFor({ kind: "undo", id: x.id, scope: s });
                          else undo.mutate(x.id);
                        }}
                        className="min-h-11 border-2 border-line px-3 text-xs font-semibold disabled:opacity-50"
                        data-testid="undo-action"
                      >
                        {t("undo")}
                      </button>
                    ) : null}
                  </li>
                ))}
                {!acc.actions.length ? <li className="py-2 text-muted">{t("noActions")}</li> : null}
              </ol>
              {acc.actions.some((x) => x.undoable && !x.undone) ? (
                <input value={undoReason} onChange={(e) => setUndoReason(e.target.value)} placeholder={t("undoReason")} aria-label={t("undoReason")} maxLength={500} className={`${inputCls} mt-2 w-full`} />
              ) : null}
            </section>
          </div>
          <aside className="space-y-4">
            <div className="border-2 border-line-strong p-4">
              <h2 className="font-extrabold">{t("takeAction")}</h2>
              <label htmlFor="risk-action" className="mt-3 block text-sm font-semibold text-muted">
                {t("actionLabel")}
              </label>
              <select id="risk-action" value={action} onChange={(e) => setAction(e.target.value as RiskActionName)} className={`${inputCls} mt-1 w-full`} data-testid="risk-action">
                {choices.map((c) => (
                  <option key={c} value={c}>
                    {t(`action.${c}`)}
                    {MASTER_ACTIONS.has(c) ? ` (${t("masterOnly")})` : ""}
                  </option>
                ))}
              </select>
              {action === "suspend" ? (
                <>
                  <label htmlFor="risk-days" className="mt-3 block text-sm font-semibold text-muted">
                    {t("days")}
                  </label>
                  <input id="risk-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className={`${inputCls} mt-1 w-full`} />
                </>
              ) : null}
              {action === "request_documents" ? (
                <>
                  <label htmlFor="risk-doc" className="mt-3 block text-sm font-semibold text-muted">
                    {t("docType")}
                  </label>
                  <select id="risk-doc" value={docType} onChange={(e) => setDocType(e.target.value as typeof docType)} className={`${inputCls} mt-1 w-full`}>
                    {(["nid", "trade_license", "deed_or_lease", "tin"] as const).map((d) => (
                      <option key={d} value={d}>
                        {t(`doc.${d}`)}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
              <label htmlFor="risk-reason" className="mt-3 block text-sm font-semibold text-muted">
                {t("reasonLong")}
              </label>
              <textarea id="risk-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className="mt-1 w-full border-2 border-line bg-surface px-3 py-2" />
              {action === "clear" && !flagId ? <p className="mt-1 text-sm text-muted">{t("pickFlag")}</p> : null}
              {problem ? <Notice tone="error">{t.has(`errors.${problem.code}`) ? t(`errors.${problem.code}`) : problem.title}</Notice> : null}
              <button
                type="button"
                disabled={!ready2 || take.isPending}
                onClick={() => (scope ? setCodeFor({ kind: "act" }) : take.mutate())}
                className={`mt-3 min-h-11 w-full px-4 font-bold text-white disabled:opacity-50 ${action === "ban" || action === "freeze_payouts" ? "bg-danger" : "bg-brand"}`}
                data-testid="take-action"
              >
                {t(`do.${action}`)}
              </button>
            </div>
            <div className="border-2 border-line p-4 text-sm">
              <h2 className="font-extrabold">{t("reliability")}</h2>
              <ul className="mt-2 space-y-1">
                {acc.trust.map((s) => (
                  <li key={s.kind} className="flex justify-between">
                    <span>{t(`trustKind.${s.kind}`)}</span>
                    <span className="tabular-nums">{s.score === null ? "–" : `${s.score}%`} · {t("sample", { n: s.sample })}</span>
                  </li>
                ))}
                {!acc.trust.length ? <li className="text-muted">{t("noScores")}</li> : null}
              </ul>
              <h2 className="mt-4 font-extrabold">{t("holds")}</h2>
              <ul className="mt-1">
                {acc.holds.map((h) => (
                  <li key={h.id}>{t(`hold.${h.type}`)}</li>
                ))}
                {!acc.holds.length ? <li className="text-muted">{t("noHolds")}</li> : null}
              </ul>
              <h2 className="mt-4 font-extrabold">{t("documents")}</h2>
              <ul className="mt-1">
                {acc.documentRequests.map((r) => (
                  <li key={r.id}>
                    {t(`doc.${r.docType}`)} · {t(`docStatus.${r.status}`)} · {formatDhaka(r.dueAt, locale)}
                  </li>
                ))}
                {!acc.documentRequests.length ? <li className="text-muted">{t("noDocuments")}</li> : null}
              </ul>
              <h2 className="mt-4 font-extrabold">{t("metrics")}</h2>
              <ul className="mt-1">
                {acc.metrics.map((m) => (
                  <li key={m.metric} className="flex justify-between">
                    <span>{t(`metric.${m.metric}`)}</span>
                    <span className="tabular-nums">{m.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
        {codeFor ? (
          <CodeDialog
            title={codeFor.kind === "act" ? t(`do.${action}`) : t("undo")}
            help={t("codeHelp")}
            onClose={() => setCodeFor(null)}
            onConfirm={async (c) => {
              if (codeFor.kind === "act") {
                const token = await stepUp(c, scope!);
                await riskAdmin.act(userId, body(), token);
                setReason("");
              } else {
                const token = await stepUp(c, codeFor.scope);
                await riskAdmin.undo(codeFor.id, undoReason.trim(), token);
                setUndoReason("");
              }
              setCodeFor(null);
              refresh();
            }}
          />
        ) : null}
      </div>
    </>
  );
}
