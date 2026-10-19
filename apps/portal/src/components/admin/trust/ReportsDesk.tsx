"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { problemOf } from "@kriraghor/api-client";
import { reportsAdmin, reviewsAdmin, type ReportAction, type ReportRow } from "@/lib/admin/trust";
import { Notice } from "../../ui";
import { AdminSubnav } from "../AdminSubnav";
import { Chip, inputCls } from "../finance/shared";
import { formatDhaka, useAdminMe } from "../useAdminMe";

type SubjectType = "ground" | "booking" | "user" | "review" | "esports_tournament";

/**
 * /admin/reports (M17 FR-17 to FR-19): one row per reported subject, flagged first (enough NID-verified
 * reporters: a review is already hidden, other subjects wait for us), then the oldest. One action
 * resolves every open report of the subject; suspending an account needs manage_users.
 */
export function ReportsDesk() {
  const t = useTranslations("reportsDesk");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready, me } = useAdminMe();
  const [status, setStatus] = useState<"open" | "escalated">("open");
  const [open, setOpen] = useState<ReportRow | null>(null);
  const allowed = Boolean(me && (me.isMaster || me.permissions.includes("resolve_reports" as never)));
  const q = useQuery({ queryKey: ["admin-reports", status], enabled: ready && allowed, queryFn: () => reportsAdmin.list(status) });

  return (
    <>
      <AdminSubnav />
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("intro", { n: q.data?.threshold ?? 3 })}</p>
        {ready && !allowed ? (
          <div className="mt-6 max-w-3xl">
            <Notice tone="error">{t("noAccess")}</Notice>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_480px]">
            <div>
              <div className="flex gap-2" role="tablist">
                {(["open", "escalated"] as const).map((s) => (
                  <button key={s} type="button" role="tab" aria-selected={status === s} onClick={() => setStatus(s)} className={`min-h-11 border-2 px-4 text-sm font-semibold ${status === s ? "border-brand bg-brand text-white" : "border-line"}`}>
                    {t(`view.${s}`)}
                  </button>
                ))}
              </div>
              <ul className="mt-4 divide-y-2 divide-line border-2 border-line" data-testid="reports-queue">
                {(q.data?.items ?? []).map((r) => (
                  <li key={`${r.subjectType}:${r.subjectId}`}>
                    <button type="button" onClick={() => setOpen(r)} className={`flex w-full flex-wrap items-center justify-between gap-3 p-3 text-left hover:bg-surface-2 ${open?.subjectId === r.subjectId ? "bg-surface-2" : ""}`}>
                      <span>
                        <span className="block font-semibold">
                          {t(`subject.${r.subjectType}`)}: {String((r.subject as Record<string, unknown> | null)?.name ?? (r.subject as Record<string, unknown> | null)?.displayName ?? (r.subject as Record<string, unknown> | null)?.text ?? r.subjectId).slice(0, 80)}
                        </span>
                        <span className="block text-xs text-muted">{r.reasons.map((x) => t(`reason.${x}`)).join(", ")}</span>
                      </span>
                      <span className="flex items-center gap-2 text-sm">
                        {r.flagged ? <Chip tone="bad">{t("flagged")}</Chip> : null}
                        <span className="tabular-nums">{t("counts", { reports: r.reports, eligible: r.eligible })}</span>
                        <span className="text-muted">{formatDhaka(String(r.dueAt), locale)}</span>
                      </span>
                    </button>
                  </li>
                ))}
                {!q.isPending && !q.data?.items.length ? <li className="p-4 text-muted">{t("empty")}</li> : null}
              </ul>
            </div>
            <div>{open ? <SubjectPane row={open} onDone={() => (setOpen(null), qc.invalidateQueries({ queryKey: ["admin-reports"] }))} /> : <p className="text-muted">{t("pick")}</p>}</div>
          </div>
        )}
      </div>
    </>
  );
}

function SubjectPane({ row, onDone }: { row: ReportRow; onDone: () => void }) {
  const t = useTranslations("reportsDesk");
  const locale = useLocale();
  const type = row.subjectType as SubjectType;
  const q = useQuery({ queryKey: ["admin-report-subject", type, row.subjectId], queryFn: () => reportsAdmin.subject(type, row.subjectId) });
  const [note, setNote] = useState("");
  const resolve = useMutation({ mutationFn: (action: ReportAction) => reportsAdmin.resolve({ subjectType: type, subjectId: row.subjectId, action, note: note.trim() }), onSuccess: onDone });
  const escalate = useMutation({ mutationFn: () => reportsAdmin.escalate({ subjectType: type, subjectId: row.subjectId, note: note.trim() }), onSuccess: onDone });
  const problem = problemOf(resolve.error) ?? problemOf(escalate.error);
  if (q.isPending) return <div className="h-64 animate-pulse bg-surface-2" />;
  if (!q.data) return <Notice tone="error">{t("loadFailed")}</Notice>;
  const s = (q.data.subject ?? {}) as Record<string, unknown>;

  return (
    <div className="border-2 border-line-strong p-4" data-testid="report-subject">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{t(`subject.${type}`)}</p>
      <p className="text-lg font-extrabold">{String(s.name ?? s.displayName ?? s.code ?? s.title ?? "")}</p>
      {s.text ? <p className="mt-1 whitespace-pre-line border-l-4 border-line pl-3 text-sm">{String(s.text)}</p> : null}
      {s.status ? <p className="mt-1 text-sm text-muted">{t("subjectStatus", { status: String(s.status) })}</p> : null}
      <h2 className="mt-4 text-sm font-bold uppercase tracking-wide text-muted">{t("reports")}</h2>
      <ul className="mt-1 max-h-64 space-y-2 overflow-y-auto text-sm">
        {q.data.items.map((r) => {
          const x = r as { code: string; reasonCode: string; note: string | null; eligible: boolean; status: string; reporter: { displayName: string | null }; createdAt: string };
          return (
            <li key={x.code} className="border-b border-line pb-2">
              <span className="font-semibold">{t(`reason.${x.reasonCode}`)}</span> · {x.reporter.displayName ?? "–"} · {formatDhaka(x.createdAt, locale)} {x.eligible ? <Chip tone="ok">{t("eligible")}</Chip> : null}
              {x.note ? <p className="text-muted">{x.note}</p> : null}
            </li>
          );
        })}
      </ul>
      <label htmlFor="report-note" className="mt-4 block text-sm font-semibold text-muted">
        {t("note")}
      </label>
      <textarea id="report-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} className={`${inputCls} mt-1 w-full py-2`} />
      {problem ? <Notice tone="error">{problem.title}</Notice> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {q.data.actions.map((a) => (
          <button key={a} type="button" disabled={note.trim().length < 2 || resolve.isPending} onClick={() => resolve.mutate(a as ReportAction)} className={`min-h-11 px-3 text-sm font-bold disabled:opacity-50 ${a === "no_violation" ? "border-2 border-line" : "bg-brand text-white"}`} data-testid={`resolve-${a}`}>
            {t(`action.${a}`)}
          </button>
        ))}
        {row.reports && !q.data.items.every((r) => (r as { status: string }).status === "escalated") ? (
          <button type="button" disabled={note.trim().length < 2 || escalate.isPending} onClick={() => escalate.mutate()} className="min-h-11 border-2 border-line-strong px-3 text-sm font-semibold disabled:opacity-50">
            {t("escalate")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** /admin/reviews (M17 FR-26): reviews waiting for a check (links, phone numbers), hidden ones, and published. */
export function ReviewsDesk() {
  const t = useTranslations("reviewsDesk");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready, me } = useAdminMe();
  const [status, setStatus] = useState<"held" | "hidden" | "published">("held");
  const [reason, setReason] = useState<Record<string, string>>({});
  const allowed = Boolean(me && (me.isMaster || me.permissions.includes("resolve_reports" as never)));
  const q = useQuery({ queryKey: ["admin-reviews", status], enabled: ready && allowed, queryFn: () => reviewsAdmin.list(status) });
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "hide" | "restore" | "publish" }) => (action === "hide" ? reviewsAdmin.hide(id, reason[id] ?? "") : action === "restore" ? reviewsAdmin.restore(id) : reviewsAdmin.publish(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reviews"] }),
  });

  return (
    <>
      <AdminSubnav />
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>
        {ready && !allowed ? (
          <div className="mt-6 max-w-3xl">
            <Notice tone="error">{t("noAccess")}</Notice>
          </div>
        ) : (
          <>
            <div className="mt-6 flex gap-2" role="tablist">
              {(["held", "hidden", "published"] as const).map((s) => (
                <button key={s} type="button" role="tab" aria-selected={status === s} onClick={() => setStatus(s)} className={`min-h-11 border-2 px-4 text-sm font-semibold ${status === s ? "border-brand bg-brand text-white" : "border-line"}`}>
                  {t(`view.${s}`)}
                </button>
              ))}
            </div>
            {act.error ? <Notice tone="error">{problemOf(act.error)?.title}</Notice> : null}
            <ul className="mt-4 divide-y-2 divide-line border-2 border-line" data-testid="reviews-queue">
              {(q.data?.items ?? []).map((r) => (
                <li key={r.id} className="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_auto]">
                  <div>
                    <p className="text-sm">
                      <span className="font-bold">{"★".repeat(r.stars)}</span> · {r.author.displayName ?? "–"} · {formatDhaka(r.createdAt, locale)}
                      {r.heldReason ? <span className="ml-2 text-xs font-bold text-muted">{t(`held.${r.heldReason}`)}</span> : null}
                    </p>
                    {r.text ? <p className="mt-1 max-w-[65ch] whitespace-pre-line">{r.text}</p> : null}
                    {r.hiddenReason ? <p className="mt-1 text-sm text-danger">{t("hiddenFor", { reason: String(r.hiddenReason) })}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    {status === "held" ? (
                      <button type="button" onClick={() => act.mutate({ id: r.id, action: "publish" })} className="min-h-11 bg-brand px-3 text-sm font-bold text-white" data-testid="publish-review">
                        {t("publish")}
                      </button>
                    ) : null}
                    {status === "hidden" ? (
                      <button type="button" onClick={() => act.mutate({ id: r.id, action: "restore" })} className="min-h-11 border-2 border-line px-3 text-sm font-semibold">
                        {t("restore")}
                      </button>
                    ) : (
                      <span className="flex gap-2">
                        <input value={reason[r.id] ?? ""} onChange={(e) => setReason({ ...reason, [r.id]: e.target.value })} placeholder={t("reason")} aria-label={t("reason")} className={inputCls} />
                        <button type="button" disabled={(reason[r.id] ?? "").trim().length < 2} onClick={() => act.mutate({ id: r.id, action: "hide" })} className="min-h-11 border-2 border-danger px-3 text-sm font-semibold text-danger disabled:opacity-50">
                          {t("hide")}
                        </button>
                      </span>
                    )}
                  </div>
                </li>
              ))}
              {!q.isPending && !q.data?.items.length ? <li className="p-4 text-muted">{t("empty")}</li> : null}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
