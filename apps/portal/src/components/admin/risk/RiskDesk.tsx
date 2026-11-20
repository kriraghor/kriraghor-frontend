"use client";

import { Suspense, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, PencilSimple } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { Badge, Button, Card, DataTable, Field, Notice, PageTitle, Select, Skeleton, Textarea, cn, useConfirm, type Column } from "@kriraghor/ui/kit";
import { stepUp } from "@/lib/admin/stepUp";
import { MASTER_ACTIONS, SEVERITY_ORDER, riskAdmin, stepUpScope, type RiskActionName, type Severity } from "@/lib/admin/risk";
import { useCursorList } from "@/lib/use-cursor-list";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../../StatusBadge";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka, useAdminMe } from "../useAdminMe";

type Row = Awaited<ReturnType<typeof riskAdmin.flags>>["items"][number];

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
  // The severity filter lives in the URL (useSearchParams), so the desk renders inside Suspense.
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-8 h-40 max-w-[1320px]" />}>
      <Desk />
    </Suspense>
  );
}

function Desk() {
  const t = useTranslations("riskDesk");
  const locale = useLocale();
  const { ready, allowed, isMaster } = useAccess();
  const { values, set } = useUrlFilters({ severity: { default: "", allowed: ["", ...SEVERITY_ORDER] } });
  const severity = values.severity as Severity | "";
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const ov = useQuery({ queryKey: ["risk-overview"], enabled: ready && allowed, queryFn: () => riskAdmin.overview() });
  const fl = useCursorList<Row>(["risk-flags", severity], (cursor) => riskAdmin.flags({ severity: severity || undefined, cursor }), { enabled: ready && allowed });

  const columns: Column<Row>[] = [
    {
      id: "account",
      header: t("col.account"),
      primary: true,
      cell: (f) => (
        <Link href={`/admin/risk/accounts/${f.userId}`} className="font-semibold text-brand-text underline underline-offset-2" data-testid="risk-account-link">
          {(f as { user?: { displayName?: string | null } }).user?.displayName ?? f.userId.slice(0, 8)}
        </Link>
      ),
    },
    {
      id: "rule",
      header: t("col.rule"),
      cell: (f) => (
        <>
          <span className="block font-semibold">{t(`rule.${f.ruleKey}`)}</span>
          <span className="block text-xs text-muted">{f.reasonText}</span>
        </>
      ),
    },
    {
      id: "severity",
      header: t("col.severity"),
      sort: (f) => SEVERITY_ORDER.indexOf(f.severity),
      cell: (f) => (
        <StatusBadge status={f.severity} domain="risk">
          {t(`severity.${f.severity}`)}
        </StatusBadge>
      ),
    },
    { id: "status", header: t("col.status"), hideBelow: "lg", cell: (f) => t(`status.${f.status}`) },
    { id: "seen", header: t("col.seen"), sort: (f) => f.lastSeenAt, cell: (f) => <span className="whitespace-nowrap">{formatDhaka(f.lastSeenAt, locale)}</span> },
  ];

  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
      <PageTitle title={t("title")} description={t("intro")} />
      {ready && !allowed ? (
        <Notice tone="error" className="mt-6 max-w-3xl">
          {t("noAccess")}
        </Notice>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="risk-counts">
            {SEVERITY_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set({ severity: severity === s ? "" : s })}
                aria-pressed={severity === s}
                className={cn("rounded-card border p-4 text-left transition-colors", severity === s ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-line-strong")}
                data-testid={`severity-${s}`}
              >
                <span className="block text-xs font-semibold uppercase tracking-wide text-muted">{t(`severity.${s}`)}</span>
                <span className={cn("mt-1 block font-display text-3xl font-bold tabular", s === "critical" && (ov.data?.counts[s] ?? 0) > 0 && "text-danger")}>{ov.data?.counts[s] ?? "–"}</span>
              </button>
            ))}
          </div>
          <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <DataTable
              label={t("title")}
              testId="risk-flags"
              columns={columns}
              rows={fl.rows}
              rowId={(f) => f.id}
              loading={fl.loading}
              error={fl.error}
              onRetry={fl.retry}
              empty={{ title: t("empty") }}
              hasMore={fl.hasMore}
              onMore={fl.more}
              busy={fl.busy}
              rowTestId="risk-flag"
            />
            <Card>
              <h2 className="font-display text-lg font-bold">{t("rules")}</h2>
              <ul className="mt-2 divide-y divide-line text-sm" data-testid="risk-rules">
                {(ov.data?.rules ?? []).map((r) => (
                  <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span>
                      <span className="block font-semibold">{t(`rule.${r.key}`)}</span>
                      <span className="block text-xs text-muted">
                        {t(`severity.${r.severity}`)} · {r.settingKey ? t("threshold", { value: r.threshold }) : t("presence")} · {t("openCount", { n: r.open })}
                      </span>
                    </span>
                    {isMaster && r.settingKey ? (
                      <Button type="button" variant="secondary" size="sm" icon={<PencilSimple size={16} aria-hidden />} onClick={() => (setEditing({ key: r.settingKey!, value: String(r.threshold) }), setSent(false))}>
                        {t("change")}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {sent ? (
                <Notice tone="success" className="mt-3">
                  {t("proposed")}
                </Notice>
              ) : null}
            </Card>
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
          <Field id="risk-threshold" className="mt-4" label={t("newValue")} inputMode="decimal" value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} />
          <Field id="risk-threshold-reason" className="mt-3" label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </CodeDialog>
      ) : null}
    </div>
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
  const ask = useConfirm();
  const problem = problemOf(take.error) ?? problemOf(undo.error);

  if (ready && !allowed) return <Notice tone="error">{t("noAccess")}</Notice>;
  if (q.isPending) return <Skeleton className="mx-auto mt-10 h-96 max-w-[1320px]" />;
  if (!q.data) return <Notice tone="error">{t("loadFailed")}</Notice>;
  const acc = q.data;
  const choices: RiskActionName[] = ["request_documents", "clear", "suspend", ...(isMaster ? (["freeze_payouts", "ban"] as RiskActionName[]) : [])];
  const scope = stepUpScope(action);
  const ready2 = reason.trim().length >= 10 && (action !== "clear" || Boolean(flagId));

  return (
    <>
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
        <Link href="/admin/risk" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-text hover:underline">
          <ArrowLeft size={16} aria-hidden />
          {t("title")}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold sm:text-4xl">{acc.user.displayName ?? userId.slice(0, 8)}</h1>
          {acc.riskLevel === "none" ? (
            <Badge tone="brand">{t(`level.${acc.riskLevel}`)}</Badge>
          ) : (
            <StatusBadge status={acc.riskLevel} domain="risk">
              {t(`level.${acc.riskLevel}`)}
            </StatusBadge>
          )}
          <span className="text-sm text-muted">
            {t("accountStatus", { status: acc.user.status })} · {t("kyc", { status: acc.user.kycStatus ?? "–" })}
          </span>
        </div>
        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="space-y-6">
            <section>
              <h2 className="font-display text-lg font-bold">{t("flags")}</h2>
              <ul className="mt-2 space-y-2" data-testid="account-flags">
                {acc.flags.map((f) => (
                  <li key={f.id} className={cn("rounded-card border p-3 text-sm transition-colors", flagId === f.id ? "border-brand bg-brand-soft" : "border-line bg-surface")}>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input type="radio" name="flag" checked={flagId === f.id} onChange={() => setFlagId(f.id)} className="mt-1 size-4 accent-[var(--kg-brand)]" />
                      <span className="flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{t(`rule.${f.ruleKey}`)}</span>
                          <StatusBadge status={f.severity} domain="risk">
                            {t(`severity.${f.severity}`)}
                          </StatusBadge>
                          <span className="text-muted">{t(`status.${f.status}`)}</span>
                          {f.escalated ? <span className="text-xs font-semibold text-danger">{t("escalated")}</span> : null}
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
              <h2 className="font-display text-lg font-bold">{t("timeline")}</h2>
              <ol className="mt-2 divide-y divide-line rounded-card border border-line bg-surface px-4 text-sm" data-testid="account-actions">
                {acc.actions.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span>
                      <span className="font-semibold">{t(`action.${x.action}`)}</span> · {t(`role.${x.actorRole}`)} · {formatDhaka(x.createdAt, locale)}
                      <span className="block text-muted">{x.reason}</span>
                    </span>
                    {x.undone ? (
                      <span className="text-xs text-muted">{t("undone")}</span>
                    ) : x.undoable ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={undoReason.trim().length < 10 || ((x.action === "freeze_payouts" || x.action === "ban") && !isMaster)}
                        onClick={async () => {
                          const s = stepUpScope(x.action);
                          if (s) setCodeFor({ kind: "undo", id: x.id, scope: s });
                          else if (await ask({ kind: "save", confirmLabel: t("undo") })) undo.mutate(x.id);
                        }}
                        data-testid="undo-action"
                      >
                        {t("undo")}
                      </Button>
                    ) : null}
                  </li>
                ))}
                {!acc.actions.length ? <li className="py-2.5 text-muted">{t("noActions")}</li> : null}
              </ol>
              {acc.actions.some((x) => x.undoable && !x.undone) ? <Field id="risk-undo-reason" className="mt-3" label={t("undoReason")} value={undoReason} onChange={(e) => setUndoReason(e.target.value)} maxLength={500} /> : null}
            </section>
          </div>
          <aside className="space-y-4">
            <Card className="flex flex-col gap-3">
              <h2 className="font-display text-lg font-bold">{t("takeAction")}</h2>
              <Select id="risk-action" label={t("actionLabel")} value={action} onChange={(e) => setAction(e.target.value as RiskActionName)} data-testid="risk-action">
                {choices.map((c) => (
                  <option key={c} value={c}>
                    {t(`action.${c}`)}
                    {MASTER_ACTIONS.has(c) ? ` (${t("masterOnly")})` : ""}
                  </option>
                ))}
              </Select>
              {action === "suspend" ? <Field id="risk-days" label={t("days")} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /> : null}
              {action === "request_documents" ? (
                <Select id="risk-doc" label={t("docType")} value={docType} onChange={(e) => setDocType(e.target.value as typeof docType)}>
                  {(["nid", "trade_license", "deed_or_lease", "tin"] as const).map((d) => (
                    <option key={d} value={d}>
                      {t(`doc.${d}`)}
                    </option>
                  ))}
                </Select>
              ) : null}
              <Textarea id="risk-reason" label={t("reasonLong")} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} hint={action === "clear" && !flagId ? t("pickFlag") : undefined} />
              {problem ? <Notice tone="error">{t.has(`errors.${problem.code}`) ? t(`errors.${problem.code}`) : problem.title}</Notice> : null}
              <Button
                type="button"
                block
                variant={action === "ban" || action === "freeze_payouts" ? "danger" : "primary"}
                disabled={!ready2}
                busy={take.isPending}
                onClick={async () => {
                  if (scope) setCodeFor({ kind: "act" });
                  else if (await ask({ kind: "save", confirmLabel: t(`do.${action}`), danger: action === "suspend" })) take.mutate();
                }}
                data-testid="take-action"
              >
                {t(`do.${action}`)}
              </Button>
            </Card>
            <Card className="text-sm">
              <h2 className="font-display text-base font-bold">{t("reliability")}</h2>
              <ul className="mt-2 space-y-1">
                {acc.trust.map((s) => (
                  <li key={s.kind} className="flex justify-between gap-3">
                    <span>{t(`trustKind.${s.kind}`)}</span>
                    <span className="tabular">
                      {s.score === null ? "–" : `${s.score}%`} · {t("sample", { n: s.sample })}
                    </span>
                  </li>
                ))}
                {!acc.trust.length ? <li className="text-muted">{t("noScores")}</li> : null}
              </ul>
              <h2 className="mt-4 font-display text-base font-bold">{t("holds")}</h2>
              <ul className="mt-1">
                {acc.holds.map((h) => (
                  <li key={h.id}>{t(`hold.${h.type}`)}</li>
                ))}
                {!acc.holds.length ? <li className="text-muted">{t("noHolds")}</li> : null}
              </ul>
              <h2 className="mt-4 font-display text-base font-bold">{t("documents")}</h2>
              <ul className="mt-1">
                {acc.documentRequests.map((r) => (
                  <li key={r.id}>
                    {t(`doc.${r.docType}`)} · {t(`docStatus.${r.status}`)} · {formatDhaka(r.dueAt, locale)}
                  </li>
                ))}
                {!acc.documentRequests.length ? <li className="text-muted">{t("noDocuments")}</li> : null}
              </ul>
              <h2 className="mt-4 font-display text-base font-bold">{t("metrics")}</h2>
              <ul className="mt-1">
                {acc.metrics.map((m) => (
                  <li key={m.metric} className="flex justify-between gap-3">
                    <span>{t(`metric.${m.metric}`)}</span>
                    <span className="tabular">{m.value}</span>
                  </li>
                ))}
              </ul>
            </Card>
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
