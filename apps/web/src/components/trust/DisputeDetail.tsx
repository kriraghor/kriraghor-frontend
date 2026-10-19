"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { problemOf } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { whenLabel } from "@/lib/bookings";
import { formatTaka } from "@/lib/payments";
import { disputes, evidenceTypeOk, type PartyCase } from "@/lib/trust";
import { Notice } from "../ui";

/**
 * /me/disputes/[code] (M17 FR-05 to FR-08): what the case is about and what is held, both sides'
 * statements and files in order, adding a statement or a file while it is open, the other side's
 * answer, withdrawing, and the decision with the money it moved.
 */
export function DisputeDetail({ code }: { code: string }) {
  const t = useTranslations("trust");
  const locale = useLocale();
  const { status } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["dispute", code], queryFn: () => disputes.get(code), enabled: status === "signed_in" });
  const refresh = (data: PartyCase) => qc.setQueryData(["dispute", code], data);
  const [text, setText] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const say = useMutation({ mutationFn: () => (q.data?.can.respond ? disputes.respond(code, text.trim()) : disputes.statement(code, text.trim())), onSuccess: (d) => (refresh(d), setText("")) });
  const upload = useMutation({ mutationFn: (f: File) => disputes.upload(code, f), onSuccess: () => qc.invalidateQueries({ queryKey: ["dispute", code] }) });
  const withdraw = useMutation({ mutationFn: () => disputes.withdraw(code), onSuccess: (d) => (refresh(d), setWithdrawing(false)) });
  const money = (n: number | null | undefined) => formatTaka(n ?? 0, locale);
  const err = (e: unknown) => {
    const p = problemOf(e);
    return p ? (t.has(`errors.${p.code}`) ? t(`errors.${p.code}`) : p.title) : t("errors.generic");
  };

  if (status === "signed_out")
    return (
      <Shell>
        <Notice>
          {t("signedOut")}{" "}
          <Link href={`/sign-in?next=/me/disputes/${code}`} className="underline">
            {t("signIn")}
          </Link>
        </Notice>
      </Shell>
    );
  if (q.isPending) return <Shell>{<div className="h-64 animate-pulse bg-surface-2" role="status" aria-label={t("loading")} />}</Shell>;
  if (q.isError || !q.data)
    return (
      <Shell>
        <Notice tone="error">{t("notFound")}</Notice>
      </Shell>
    );
  const { dispute: d, source, evidence, can, role } = q.data;
  const src = source as { code?: string; groundName?: string; shopName?: string; start?: string; id?: string } | null;

  return (
    <Shell>
      <Link href="/me/disputes" className="text-sm font-semibold text-brand underline">
        ← {t("myDisputes")}
      </Link>
      <p className="mt-4 font-mono text-sm text-muted">{d.code}</p>
      <h1 className="text-3xl font-extrabold">{t(`category.${d.category}`)}</h1>
      {src?.groundName ? (
        <p className="mt-1 text-muted">
          {src.groundName}
          {src.start ? ` · ${whenLabel(src.start, locale)}` : ""}
          {src.code && src.id && role === "claimant" ? (
            <>
              {" · "}
              <Link href={`/me/bookings/${src.id}`} className="underline">
                {src.code}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      <p className="mt-3 inline-block border-2 border-line px-3 py-1 text-sm font-bold" data-testid="dispute-status">
        {t(`status.${d.status}`)}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-y-2 border-line py-4 text-sm">
        {d.money ? (
          <>
            <dt className="text-muted">{t("held")}</dt>
            <dd className="text-right font-bold tabular-nums">{money(d.held)}</dd>
          </>
        ) : (
          <dd className="col-span-2 text-muted">{t("findingsOnly")}</dd>
        )}
        {d.status === "awaiting_response" && d.respondentDueAt ? (
          <>
            <dt className="text-muted">{t("answerBy")}</dt>
            <dd className="text-right font-bold">{whenLabel(d.respondentDueAt as string, locale)}</dd>
          </>
        ) : null}
        {d.status === "resolved" ? (
          <>
            <dt className="text-muted">{t("decision")}</dt>
            <dd className="text-right font-bold" data-testid="dispute-outcome">
              {t(`outcome.${d.outcome}`)}
            </dd>
            {d.money ? (
              <>
                <dt className="text-muted">{t("refund")}</dt>
                <dd className="text-right font-bold tabular-nums" data-testid="dispute-refund">
                  {money(d.refund)}
                </dd>
              </>
            ) : null}
          </>
        ) : null}
      </dl>
      {d.status === "resolved" && d.decisionReason ? <p className="mt-3 max-w-[65ch] text-sm">{d.decisionReason}</p> : null}

      <h2 className="mt-8 text-xl font-extrabold">{t("timeline")}</h2>
      <ol className="mt-3 space-y-3" data-testid="dispute-timeline">
        {evidence.map((e) => (
          <li key={e.id} className={`border-l-4 pl-3 ${e.party === "claimant" ? "border-brand" : e.party === "respondent" ? "border-info" : "border-line"}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              {t(`party.${e.mine ? "you" : e.party}`)} · {whenLabel(e.createdAt, locale)}
            </p>
            {e.kind === "statement" && e.text ? <p className="mt-1 max-w-[65ch] whitespace-pre-line">{e.text}</p> : null}
            {e.kind === "file" && e.file ? (
              <button type="button" onClick={() => disputes.openFile(code, e.id)} className="mt-1 text-sm font-semibold text-brand underline">
                {t("openFile", { kind: e.file.mime === "application/pdf" ? "PDF" : t("photo") })}
              </button>
            ) : null}
            {e.kind === "system" ? <p className="mt-1 text-sm text-muted">{t(`system.${((e.systemRef as { type?: string } | null)?.type ?? "snapshot")}`)}</p> : null}
            {e.hidden ? <p className="mt-1 text-sm text-muted">{t("hiddenItem")}</p> : null}
          </li>
        ))}
      </ol>

      {can.addEvidence ? (
        <div className="mt-8 space-y-4 border-2 border-line p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              say.mutate();
            }}
            className="space-y-2"
          >
            <label htmlFor="add-statement" className="font-bold">
              {can.respond ? t("yourSide") : t("addStatement")}
            </label>
            <textarea id="add-statement" required minLength={2} maxLength={2000} rows={4} value={text} onChange={(e) => setText(e.target.value)} className="w-full glass-card px-3 py-2" />
            {say.error ? <Notice tone="error">{err(say.error)}</Notice> : null}
            <button type="submit" disabled={say.isPending || text.trim().length < 2} className="inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white disabled:opacity-50" data-testid="send-statement">
              {can.respond ? t("sendAnswer") : t("send")}
            </button>
          </form>
          <div>
            <p className="font-bold">{t("addFile")}</p>
            <p className="text-sm text-muted">{t("fileHint", { left: can.filesLeft })}</p>
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="sr-only"
              id="evidence-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                if (!evidenceTypeOk(f)) return setFileProblem(t("errors.FILE_TYPE"));
                setFileProblem(null);
                upload.mutate(f);
              }}
            />
            <label htmlFor="evidence-file" className={`mt-2 inline-flex min-h-12 cursor-pointer items-center border-2 border-line-strong px-5 font-semibold ${can.filesLeft ? "" : "pointer-events-none opacity-50"}`} data-testid="add-file">
              {upload.isPending ? t("uploading") : t("chooseFile")}
            </label>
            {fileProblem ? <Notice tone="error">{fileProblem}</Notice> : null}
            {upload.error ? <Notice tone="error">{err(upload.error)}</Notice> : null}
          </div>
        </div>
      ) : null}

      {can.withdraw ? (
        <div className="mt-6">
          {!withdrawing ? (
            <button type="button" onClick={() => setWithdrawing(true)} className="inline-flex min-h-12 items-center border-2 border-danger px-5 font-bold text-danger" data-testid="withdraw">
              {t("withdraw")}
            </button>
          ) : (
            <div className="border-2 border-danger p-4" role="alertdialog" aria-labelledby="withdraw-title">
              <p id="withdraw-title" className="font-bold">
                {t("withdrawTitle")}
              </p>
              <p className="mt-2 text-sm">{d.money ? t("withdrawMoney") : t("withdrawFindings")}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => withdraw.mutate()} disabled={withdraw.isPending} className="inline-flex min-h-12 items-center bg-danger px-5 font-bold text-white disabled:opacity-50" data-testid="confirm-withdraw">
                  {t("confirmWithdraw")}
                </button>
                <button type="button" onClick={() => setWithdrawing(false)} className="inline-flex min-h-12 items-center border-2 border-line px-5 font-semibold">
                  {t("keepOpen")}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto max-w-2xl px-5 pb-16 pt-8">{children}</section>;
}
