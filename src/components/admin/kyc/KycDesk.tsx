"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { decisionProblem, kyc, QUEUE_STATUSES, REASONS, RUBRIC, type Decision, type DocStatus, type Reason, type Reveal, type Rubric } from "@/lib/admin/kyc";
import { problemOf, type Problem } from "@/lib/api/client";
import { Notice } from "../../ui";
import { AdminSubnav } from "../AdminSubnav";
import { formatDhaka, useAdminMe } from "../useAdminMe";
import { Chip, DataTable, Field, inputCls } from "../finance/shared";

const TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = { in_review: "warn", approved: "ok", changes_requested: "bad", rejected: "bad", withdrawn: "muted", superseded: "muted" };

/**
 * /admin/kyc (M02 lite, until M05's queue): NID documents waiting for review. The panel shows the
 * legal name and DOB, the masked number (reveal with a reason, 60 s), the automatic checks and the
 * files (each view audited); the reviewer ticks the rubric and decides.
 */
export function KycDesk() {
  const t = useTranslations("kyc");
  const locale = useLocale();
  const params = useSearchParams();
  const { ready, me } = useAdminMe();
  const qc = useQueryClient();
  const [status, setStatus] = useState<DocStatus>("in_review");
  const [selected, setSelected] = useState<string | null>(params.get("id"));
  const canReview = Boolean(me && (me.isMaster || me.permissions.includes("approve_documents")));
  const q = useQuery({ queryKey: ["kyc-queue", status], enabled: canReview, queryFn: () => kyc.queue(status) });
  const items = q.data?.items ?? [];

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
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div>
              <div role="tablist" aria-label={t("queue")} className="flex flex-wrap gap-2">
                {QUEUE_STATUSES.map((s) => (
                  <button key={s} type="button" role="tab" aria-selected={status === s} onClick={() => setStatus(s)} className={`min-h-11 border-2 px-3 text-sm font-bold ${status === s ? "border-brand text-ink" : "border-line text-muted"}`}>
                    {t(`status.${s}`)} <span className="tabular-nums">({q.data?.counts[s] ?? 0})</span>
                  </button>
                ))}
              </div>
              <DataTable head={[t("member"), t("number"), t("checks"), t("submitted")]} loading={q.isPending} error={q.isError} empty={!items.length} testId="kyc-queue">
                {items.map((d) => (
                  <tr key={d.id} className={`cursor-pointer hover:bg-surface-2 ${selected === d.id ? "bg-surface-2" : ""}`} onClick={() => setSelected(d.id)}>
                    <td className="px-3 py-2">
                      <button type="button" className="font-semibold underline" onClick={() => setSelected(d.id)}>
                        {d.user.displayName ?? "–"}
                      </button>
                      <span className="block text-xs text-muted">v{d.version}</span>
                    </td>
                    <td className="px-3 py-2 font-mono">{d.numberMasked}</td>
                    <td className="px-3 py-2">{d.failedChecks.length ? <Chip tone="bad">{d.failedChecks.map((c) => t(`check.${c}`)).join(", ")}</Chip> : <Chip tone="ok">{t("allChecksOk")}</Chip>}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDhaka(d.submittedAt, locale)}</td>
                  </tr>
                ))}
              </DataTable>
            </div>
            <div>{selected ? <ReviewPanel key={selected} id={selected} onDecided={() => void qc.invalidateQueries({ queryKey: ["kyc-queue"] })} /> : <p className="text-muted">{t("pick")}</p>}</div>
          </div>
        )}
      </div>
    </>
  );
}

function ReviewPanel({ id, onDecided }: { id: string; onDecided: () => void }) {
  const t = useTranslations("kyc");
  const locale = useLocale();
  const qc = useQueryClient();
  const d = useQuery({ queryKey: ["kyc-doc", id], queryFn: () => kyc.get(id) });
  const [rubric, setRubric] = useState<Rubric>({ nameMatches: false, readable: false, notExpired: false });
  const [reason, setReason] = useState<Reason | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  if (d.isPending) return <div className="h-60 animate-pulse bg-surface-2" />;
  if (d.isError) return <Notice tone="error">{t("loadFailed")}</Notice>;
  const doc = d.data;
  const blockingFailed = doc.checks.some((c) => c.blocks && !c.ok);
  const open = doc.status === "in_review";

  async function act(decision: Decision) {
    const local = decisionProblem(decision, { rubric, reason, blockingFailed });
    if (local) {
      setProblem({ code: local, title: t(`problem.${local}`), status: 0 });
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await kyc.decide(id, decision === "approve" ? { decision, rubric } : { decision, reasonCode: reason as Reason, note: note.trim() || undefined });
      await qc.invalidateQueries({ queryKey: ["kyc-doc", id] });
      onDecided();
    } catch (err) {
      setProblem(problemOf(err) ?? { code: "UNKNOWN", title: t("failed"), status: 0 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-2 border-line bg-surface p-5" aria-labelledby="kyc-review-title" data-testid="kyc-review">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="kyc-review-title" className="text-xl font-extrabold">
          {doc.user.displayName ?? "–"}
        </h2>
        <Chip tone={TONE[doc.status] ?? "muted"}>{t(`status.${doc.status}`)}</Chip>
        <span className="text-sm text-muted">v{doc.version}</span>
      </div>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">{t("legalName")}</dt>
        <dd className="font-semibold">{doc.fields.legalName}</dd>
        <dt className="text-muted">{t("dob")}</dt>
        <dd>{doc.fields.dob}</dd>
        <dt className="text-muted">{t("number")}</dt>
        <dd>
          <RevealNid id={id} masked={doc.fields.numberMasked} />
        </dd>
        <dt className="text-muted">{t("phone")}</dt>
        <dd>{doc.user.phoneVerified ? t("phoneOk") : t("phoneMissing")}</dd>
      </dl>

      <h3 className="mt-5 font-bold">{t("checks")}</h3>
      <ul className="mt-2 space-y-1 text-sm">
        {doc.checks.map((c) => (
          <li key={c.key} className="flex flex-wrap gap-2">
            <Chip tone={c.ok ? "ok" : c.blocks ? "bad" : "warn"}>{c.ok ? t("ok") : c.blocks ? t("blocks") : t("warning")}</Chip>
            <span>{t(`check.${c.key}`)}</span>
            {c.detail ? <span className="text-muted">({c.detail})</span> : null}
          </li>
        ))}
      </ul>

      <h3 className="mt-5 font-bold">{t("files")}</h3>
      <p className="text-xs text-muted">{t("filesAudited")}</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        {doc.files.map((f) => (
          <FileView key={f.id} docId={id} fileId={f.id} slot={f.slot} mime={f.mime} purged={f.purged} />
        ))}
      </div>

      {open ? (
        <div className="mt-6 border-t-2 border-line pt-4">
          <fieldset>
            <legend className="font-bold">{t("rubric")}</legend>
            {RUBRIC.map((k) => (
              <label key={k} className="mt-2 flex min-h-11 items-center gap-2">
                <input type="checkbox" className="h-5 w-5" checked={rubric[k]} onChange={(e) => setRubric((r) => ({ ...r, [k]: e.target.checked }))} />
                <span>{t(`rubricItem.${k}`)}</span>
              </label>
            ))}
          </fieldset>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label={t("reasonLabel")}>
              <select value={reason} onChange={(e) => setReason(e.target.value as Reason | "")} className={inputCls}>
                <option value="">{t("chooseReason")}</option>
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`reason.${r}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("note")}>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={inputCls} />
            </Field>
          </div>
          {problem ? (
            <div className="mt-3">
              <Notice tone="error">{problem.title}</Notice>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void act("approve")} className="min-h-11 border-2 border-brand px-4 font-semibold disabled:opacity-50" data-testid="kyc-approve">
              {t("approve")}
            </button>
            <button type="button" disabled={busy} onClick={() => void act("changes_requested")} className="min-h-11 border-2 border-line px-4 font-semibold disabled:opacity-50">
              {t("askChanges")}
            </button>
            <button type="button" disabled={busy} onClick={() => void act("reject")} className="min-h-11 border-2 border-danger px-4 font-semibold text-danger disabled:opacity-50">
              {t("reject")}
            </button>
          </div>
        </div>
      ) : doc.reasonCode ? (
        <p className="mt-5 text-sm">
          {t(`reason.${doc.reasonCode as Reason}`)}
          {doc.reasonText ? `: ${doc.reasonText}` : ""}
        </p>
      ) : null}

      <h3 className="mt-6 font-bold">{t("history")}</h3>
      <ol className="mt-2 space-y-1 text-sm">
        {doc.history.map((h) => (
          <li key={h.id}>
            v{h.version} · {t(`status.${h.status}`)} · {formatDhaka(h.submittedAt, locale)}
            {h.reasonCode ? ` · ${t(`reason.${h.reasonCode as Reason}`)}` : ""}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The masked number; the full number for 60 seconds after giving a reason (audited, critical). */
function RevealNid({ id, masked }: { id: string; masked: string }) {
  const t = useTranslations("kyc");
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [shown, setShown] = useState<Reveal | null>(null);
  const [left, setLeft] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!shown) return undefined;
    const tick = window.setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    const hide = window.setTimeout(() => setShown(null), shown.showForSeconds * 1000);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(hide);
    };
  }, [shown]);

  if (shown)
    return (
      <span role="status" data-testid="kyc-nid-revealed">
        <span className="font-mono text-lg font-bold">{shown.number}</span> <span className="text-xs text-muted">{t("hidesIn", { seconds: left })}</span>
      </span>
    );
  if (!asking)
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-mono">{masked}</span>
        <button type="button" className="min-h-9 border-2 border-line px-2 text-xs font-semibold" onClick={() => setAsking(true)}>
          {t("reveal")}
        </button>
      </span>
    );
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setProblem(null);
        try {
          const r = await kyc.reveal(id, reason.trim());
          setShown(r);
          setLeft(r.showForSeconds);
          setAsking(false);
          setReason("");
        } catch (err) {
          setProblem(problemOf(err)?.title ?? t("failed"));
        }
      }}
    >
      <Field label={t("revealReason")}>
        <input value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={300} required className={inputCls} />
      </Field>
      <button type="submit" className="min-h-11 border-2 border-brand px-3 text-sm font-semibold">
        {t("revealConfirm")}
      </button>
      {problem ? <span className="text-sm text-danger">{problem}</span> : null}
    </form>
  );
}

/** One file, fetched only when the reviewer asks (each fetch is an audited view). */
function FileView({ docId, fileId, slot, mime, purged }: { docId: string; fileId: string; slot: string; mime: string; purged: boolean }) {
  const t = useTranslations("kyc");
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<string | null>(null);
  useEffect(() => () => {
    if (ref.current) URL.revokeObjectURL(ref.current);
  }, []);

  async function show() {
    setBusy(true);
    setFailed(false);
    try {
      const blob = await kyc.file(docId, fileId);
      const u = URL.createObjectURL(blob);
      ref.current = u;
      setUrl(u);
      if (mime === "application/pdf") window.open(u, "_blank", "noopener");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 border-2 border-line p-2 text-center text-sm">
      <span className="font-bold">{t(`slot.${slot}`)}</span>
      {purged ? (
        <span className="text-xs text-muted">{t("purged")}</span>
      ) : url && mime !== "application/pdf" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={t(`slot.${slot}`)} className="max-h-60 w-full object-contain" data-testid={`kyc-file-${slot}`} />
      ) : (
        <button type="button" disabled={busy} onClick={() => void show()} className="min-h-11 border-2 border-line px-3 font-semibold disabled:opacity-50">
          {mime === "application/pdf" ? t("openPdf") : t("show")}
        </button>
      )}
      {failed ? <span className="text-xs text-danger">{t("fileFailed")}</span> : null}
    </div>
  );
}
