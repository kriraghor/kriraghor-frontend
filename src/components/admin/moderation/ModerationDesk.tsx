"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { decisionProblem, hardFailures, HEARTBEAT_MS, moderation, QUEUE_POLL_MS, QUEUE_STATUSES, type Claimed, type Decision, type Detail, type Status } from "@/lib/admin/moderation";
import { stepUp } from "@/lib/admin/stepUp";
import { problemOf, type Problem } from "@/lib/api/client";
import { Notice } from "../../ui";
import { AdminSubnav } from "../AdminSubnav";
import { CodeDialog } from "../CodeDialog";
import { DocumentPanel } from "../kyc/DocumentPanel";
import { formatDhaka, useAdminMe } from "../useAdminMe";
import { Chip, DataTable, Field, inputCls } from "../finance/shared";

const STATUS_TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = { pending_review: "warn", approved: "ok", changes_requested: "bad", rejected: "bad", withdrawn: "muted", superseded: "muted" };
const SLA_TONE = { ok: "ok", warn: "warn", overdue: "bad" } as const;
const REVIEW_PERMISSIONS = ["approve_documents", "approve_listings"];

/**
 * /admin/moderation (M05 lite): one queue for every kind the reviewer may see (documents first),
 * oldest deadline first. Claim an item to review it: the lock is kept by a heartbeat while the pane
 * is open, rubric ticks are stored on the server, and the decision needs a reason for anything but
 * approve. Masters may approve over a failing check (step-up, Q46) and reopen a decision.
 */
export function ModerationDesk() {
  const t = useTranslations("moderation");
  const locale = useLocale();
  const params = useSearchParams();
  const { ready, me } = useAdminMe();
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("pending_review");
  const [kind, setKind] = useState(params.get("kind") ?? "");
  const [claimed, setClaimed] = useState<Claimed | "">("");
  const [overdue, setOverdue] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(params.get("id"));
  const canReview = Boolean(me && (me.isMaster || me.permissions.some((p) => REVIEW_PERMISSIONS.includes(p))));

  const query = { status, ...(kind ? { kind } : {}), ...(claimed ? { claimed } : {}), ...(overdue ? { overdue: "true" as const } : {}), ...(search.trim() ? { q: search.trim() } : {}) };
  const q = useQuery({ queryKey: ["mod-queue", query], enabled: canReview, refetchInterval: QUEUE_POLL_MS, queryFn: () => moderation.queue(query) });
  const stats = useQuery({ queryKey: ["mod-stats"], enabled: canReview, refetchInterval: QUEUE_POLL_MS, queryFn: () => moderation.stats() });
  const items = q.data?.items ?? [];
  const refresh = () => void qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith("mod-") });

  return (
    <>
      <AdminSubnav />
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>
        {ready && !canReview ? (
          <div className="mt-6 max-w-3xl">
            <Notice tone="error">{t("noAccess")}</Notice>
          </div>
        ) : (
          <>
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="mod-stats">
              {(["inQueue", "overdue", "claimedByYou", "decidedToday"] as const).map((k) => (
                <div key={k} className="border-2 border-line bg-surface px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t(`kpi.${k}`)}</dt>
                  <dd className={`mt-1 text-2xl font-extrabold tabular-nums ${k === "overdue" && (stats.data?.overdue ?? 0) > 0 ? "text-danger" : ""}`}>{stats.data ? stats.data[k] : "–"}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
              <div>
                <div role="tablist" aria-label={t("queue")} className="flex flex-wrap gap-2">
                  {QUEUE_STATUSES.map((s) => (
                    <button key={s} type="button" role="tab" aria-selected={status === s} onClick={() => setStatus(s)} className={`min-h-11 border-2 px-3 text-sm font-bold ${status === s ? "border-brand text-ink" : "border-line text-muted"}`}>
                      {t(`status.${s}`)}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <Field label={t("kindLabel")}>
                    <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
                      <option value="">{t("allKinds")}</option>
                      <option value="document">{t("kind.document")}</option>
                    </select>
                  </Field>
                  {status === "pending_review" ? (
                    <>
                      <Field label={t("lockLabel")}>
                        <select value={claimed} onChange={(e) => setClaimed(e.target.value as Claimed | "")} className={inputCls}>
                          <option value="">{t("lockAny")}</option>
                          <option value="none">{t("lockNone")}</option>
                          <option value="me">{t("lockMe")}</option>
                          <option value="others">{t("lockOthers")}</option>
                        </select>
                      </Field>
                      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" className="h-5 w-5" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} />
                        {t("overdueOnly")}
                      </label>
                    </>
                  ) : null}
                  <Field label={t("search")}>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} maxLength={80} className={inputCls} />
                  </Field>
                </div>
                <DataTable head={[t("item"), t("submittedBy"), status === "pending_review" ? t("deadline") : t("decided"), t("lock")]} loading={q.isPending} error={q.isError} empty={!items.length} testId="mod-queue">
                  {items.map((s) => (
                    <tr key={s.id} className={`cursor-pointer hover:bg-surface-2 ${selected === s.id ? "bg-surface-2" : ""}`} onClick={() => setSelected(s.id)}>
                      <td className="px-3 py-2">
                        <button type="button" className="text-left font-semibold underline" onClick={() => setSelected(s.id)}>
                          {s.title}
                        </button>
                        <span className="block text-xs text-muted">
                          {t(`kind.${s.kind}`)} · v{s.version}
                        </span>
                      </td>
                      <td className="px-3 py-2">{s.submittedBy.name ?? "–"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {s.sla ? (
                          <>
                            <Chip tone={SLA_TONE[s.sla]}>{t(`sla.${s.sla}`)}</Chip>
                            <span className="block text-xs text-muted">{formatDhaka(s.slaDueAt, locale)}</span>
                          </>
                        ) : (
                          <span>{formatDhaka(s.decidedAt, locale)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{s.claim ? <Chip tone={s.claim.mine ? "ok" : "muted"}>{s.claim.mine ? t("lockedByYou") : (s.claim.name ?? t("someone"))}</Chip> : <span className="text-muted">–</span>}</td>
                    </tr>
                  ))}
                </DataTable>
              </div>
              <div>{selected ? <ReviewPane key={selected} id={selected} isMaster={Boolean(me?.isMaster)} onChanged={refresh} /> : <p className="text-muted">{t("pick")}</p>}</div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function ReviewPane({ id, isMaster, onChanged }: { id: string; isMaster: boolean; onChanged: () => void }) {
  const t = useTranslations("moderation");
  const tk = useTranslations("kyc");
  const locale = useLocale();
  const qc = useQueryClient();
  const d = useQuery({ queryKey: ["mod-detail", id], queryFn: () => moderation.get(id) });
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const [reasonCode, setReasonCode] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [override, setOverride] = useState("");
  const [dialog, setDialog] = useState<"override" | "reopen" | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const mine = Boolean(d.data?.claim?.mine);

  // Keep the lock while the pane is open (moderation.heartbeat_sec); tell the reviewer when it is gone.
  useEffect(() => {
    if (!mine) return undefined;
    const beat = window.setInterval(() => {
      moderation.heartbeat(id).catch((err) => {
        setProblem(problemOf(err) ?? { code: "CLAIM_EXPIRED", title: t("lockLost"), status: 409 });
        void qc.invalidateQueries({ queryKey: ["mod-detail", id] });
      });
    }, HEARTBEAT_MS);
    return () => window.clearInterval(beat);
  }, [mine, id, qc, t]);

  if (d.isPending) return <div className="h-60 animate-pulse bg-surface-2" />;
  if (d.isError) return <Notice tone="error">{t("loadFailed")}</Notice>;
  const s = d.data;
  const open = s.status === "pending_review";
  const failing = hardFailures(s.checks);
  const missing = (s.rubric?.items ?? []).map((i) => i.key).filter((k) => !s.ticks.includes(k));
  const reason = s.reasons.find((r) => r.code === reasonCode) ?? null;
  const label = (r: { labelEn: string; labelBn: string }) => (locale === "bn" ? r.labelBn : r.labelEn);
  const checkLabel = (key: string) => (tk.has(`check.${key}`) ? tk(`check.${key}`) : key);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setProblem(null);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["mod-detail", id] });
      onChanged();
    } catch (err) {
      setProblem(problemOf(err) ?? { code: "UNKNOWN", title: t("failed"), status: 0 });
    } finally {
      setBusy(false);
    }
  }

  async function tick(key: string, on: boolean) {
    const ticks = on ? [...s.ticks, key] : s.ticks.filter((k) => k !== key);
    qc.setQueryData<Detail>(["mod-detail", id], { ...s, ticks });
    try {
      await moderation.ticks(id, ticks);
    } catch (err) {
      setProblem(problemOf(err) ?? { code: "UNKNOWN", title: t("failed"), status: 0 });
      await qc.invalidateQueries({ queryKey: ["mod-detail", id] });
    }
  }

  function decide(decision: Decision) {
    const local = decisionProblem(decision, { missing, failing, reason, reasonText, override: decision === "approve" ? override : "" });
    if (local) {
      setProblem({ code: local, title: t(`problem.${local}`), status: 0 });
      return;
    }
    if (decision === "approve" && failing.length) {
      setDialog("override");
      return;
    }
    void run(() => moderation.decide(id, decision === "approve" ? { decision } : { decision, reasonCode, reasonText: reasonText.trim() || undefined }));
  }

  return (
    <section className="border-2 border-line bg-surface p-5" aria-labelledby="mod-review-title" data-testid="mod-review">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="mod-review-title" className="text-xl font-extrabold">
          {s.title}
        </h2>
        <Chip tone={STATUS_TONE[s.status] ?? "muted"}>{t(`status.${s.status}`)}</Chip>
        <span className="text-sm text-muted">
          {t(`kind.${s.kind}`)} · v{s.version} · {s.submittedBy.name ?? "–"}
        </span>
      </div>

      {open ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          {mine ? (
            <>
              <Chip tone="ok">{t("lockedByYou")}</Chip>
              <span className="text-muted">{t("lockUntil", { time: formatDhaka(s.claim?.expiresAt, locale) })}</span>
              <button type="button" disabled={busy} onClick={() => void run(() => moderation.release(id))} className="min-h-11 border-2 border-line px-3 font-semibold disabled:opacity-50">
                {t("release")}
              </button>
            </>
          ) : s.claim ? (
            <>
              <Chip tone="muted">{t("lockedBy", { name: s.claim.name ?? t("someone") })}</Chip>
              {isMaster ? (
                <button type="button" disabled={busy} onClick={() => void run(() => moderation.release(id, true))} className="min-h-11 border-2 border-danger px-3 font-semibold text-danger disabled:opacity-50">
                  {t("forceRelease")}
                </button>
              ) : null}
            </>
          ) : (
            <button type="button" disabled={busy} onClick={() => void run(() => moderation.claim(id))} className="min-h-11 border-2 border-brand px-4 font-semibold disabled:opacity-50" data-testid="mod-claim">
              {t("claim")}
            </button>
          )}
        </div>
      ) : null}

      <h3 className="mt-5 font-bold">{t("checks")}</h3>
      <ul className="mt-2 space-y-1 text-sm">
        {s.checks.map((c) => (
          <li key={c.key} className="flex flex-wrap gap-2">
            <Chip tone={c.result === "pass" ? "ok" : c.result === "fail" ? "bad" : "warn"}>{t(`result.${c.result}`)}</Chip>
            <span>{checkLabel(c.key)}</span>
            {c.severity === "hard" && c.result === "fail" ? <span className="font-semibold text-danger">{t("blocksApproval")}</span> : null}
            {c.detail ? <span className="text-muted">({c.detail})</span> : null}
          </li>
        ))}
      </ul>

      {s.kind === "document" && typeof s.payload.documentId === "string" ? <DocumentPanel documentId={s.payload.documentId} /> : null}

      {open && mine ? (
        <div className="mt-6 border-t-2 border-line pt-4">
          <fieldset>
            <legend className="font-bold">{t("rubric")}</legend>
            {(s.rubric?.items ?? []).map((i) => (
              <label key={i.key} className="mt-2 flex min-h-11 items-center gap-2">
                <input type="checkbox" className="h-5 w-5" checked={s.ticks.includes(i.key)} onChange={(e) => void tick(i.key, e.target.checked)} />
                <span>{label(i)}</span>
              </label>
            ))}
          </fieldset>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label={t("reasonLabel")}>
              <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className={inputCls}>
                <option value="">{t("chooseReason")}</option>
                {s.reasons.map((r) => (
                  <option key={r.code} value={r.code}>
                    {label(r)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={reason?.requiresText ? t("noteRequired") : t("note")}>
              <input value={reasonText} onChange={(e) => setReasonText(e.target.value)} maxLength={500} className={inputCls} />
            </Field>
          </div>
          {failing.length && isMaster ? (
            <div className="mt-4">
              <Field label={t("overrideLabel")}>
                <input value={override} onChange={(e) => setOverride(e.target.value)} maxLength={500} className={inputCls} />
              </Field>
              <p className="mt-1 text-xs text-muted">{t("overrideHelp")}</p>
            </div>
          ) : null}
          {problem ? (
            <div className="mt-3">
              <Notice tone="error">{problem.title}</Notice>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => decide("approve")} className="min-h-11 border-2 border-brand px-4 font-semibold disabled:opacity-50" data-testid="mod-approve">
              {failing.length && isMaster ? t("approveOverride") : t("approve")}
            </button>
            <button type="button" disabled={busy} onClick={() => decide("request_changes")} className="min-h-11 border-2 border-line px-4 font-semibold disabled:opacity-50">
              {t("askChanges")}
            </button>
            <button type="button" disabled={busy} onClick={() => decide("reject")} className="min-h-11 border-2 border-danger px-4 font-semibold text-danger disabled:opacity-50">
              {t("reject")}
            </button>
          </div>
        </div>
      ) : (
        <>
          {problem ? (
            <div className="mt-3">
              <Notice tone="error">{problem.title}</Notice>
            </div>
          ) : null}
          {!open ? (
            <div className="mt-5 text-sm">
              {s.decidedBy ? <p>{t("decidedBy", { name: s.decidedBy.name ?? "–", time: formatDhaka(s.decidedAt, locale) })}</p> : null}
              {s.reasonCode ? (
                <p className="mt-1">
                  {label(s.reasons.find((r) => r.code === s.reasonCode) ?? { labelEn: s.reasonCode, labelBn: s.reasonCode })}
                  {s.reasonText ? `: ${s.reasonText}` : ""}
                </p>
              ) : null}
              {s.override ? <p className="mt-1 font-semibold text-danger">{t("overridden", { name: s.override.by ?? "–", reason: s.override.reason ?? "" })}</p> : null}
              {s.status === "approved" ? <p className="mt-1 text-muted">{s.appliedAt ? t("applied") : t("notApplied")}</p> : null}
              {isMaster && (s.status === "approved" || s.status === "rejected") ? (
                <button type="button" onClick={() => setDialog("reopen")} className="mt-3 min-h-11 border-2 border-line px-4 font-semibold">
                  {t("reopen")}
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <h3 className="mt-6 font-bold">{t("history")}</h3>
      <ol className="mt-2 space-y-1 text-sm">
        {s.history.map((h) => (
          <li key={h.id}>
            v{h.version} · {t(`status.${h.status}`)} · {formatDhaka(h.submittedAt, locale)}
            {h.decidedBy ? ` · ${h.decidedBy}` : ""}
          </li>
        ))}
      </ol>

      {dialog === "override" ? (
        <CodeDialog
          title={t("overrideTitle")}
          help={t("overrideDialogHelp", { checks: failing.map(checkLabel).join(", ") })}
          onClose={() => setDialog(null)}
          onConfirm={async (code) => {
            const token = await stepUp(code, "moderation.override");
            await moderation.decide(id, { decision: "approve", override: override.trim() }, token);
            setDialog(null);
            await qc.invalidateQueries({ queryKey: ["mod-detail", id] });
            onChanged();
          }}
        />
      ) : null}
      {dialog === "reopen" ? (
        <CodeDialog
          title={t("reopenTitle")}
          help={t("reopenHelp")}
          onClose={() => setDialog(null)}
          onConfirm={async (code) => {
            if (reopenReason.trim().length < 3) throw { code: "VALIDATION_FAILED", title: t("reasonNeeded"), status: 422 };
            const token = await stepUp(code, "moderation.override");
            await moderation.reopen(id, reopenReason.trim(), token);
            setDialog(null);
            setReopenReason("");
            await qc.invalidateQueries({ queryKey: ["mod-detail", id] });
            onChanged();
          }}
        >
          <label htmlFor="reopen-reason" className="mt-4 block text-sm font-semibold text-muted">
            {t("reopenReason")}
          </label>
          <input id="reopen-reason" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} maxLength={500} className={`${inputCls} mt-1 w-full`} />
        </CodeDialog>
      ) : null}
    </section>
  );
}
