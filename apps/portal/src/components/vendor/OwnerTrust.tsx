"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { problemOf } from "@kriraghor/api-client";
import { formatTaka } from "@/lib/admin/finance";
import { EVIDENCE_TYPES, ownerTrust } from "@/lib/vendor/trust";
import { Notice } from "@kriraghor/ui/primitives";
import { Chip, inputCls } from "../admin/finance/shared";
import { formatDhaka } from "../admin/useAdminMe";

const TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = { awaiting_response: "bad", under_review: "warn", escalated: "warn", resolved: "ok", withdrawn: "muted" };

/**
 * /vendor/disputes (M17 FR-06): cases members opened about the owner's bookings. A case waits for the
 * owner's side (disputes.respondent_hours), then our team decides; while it is open the money stays
 * in escrow. /vendor/disputes/[code] opens one.
 */
export function OwnerDisputes({ initial }: { initial?: string }) {
  const t = useTranslations("vendorTrust");
  const locale = useLocale();
  const [open, setOpen] = useState<string | null>(initial ?? null);
  const q = useQuery({ queryKey: ["owner-disputes"], queryFn: () => ownerTrust.cases() });

  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
      <h1 className="text-3xl font-extrabold">{t("disputesTitle")}</h1>
      <p className="mt-2 max-w-3xl text-muted">{t("disputesIntro")}</p>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px]">
        <ul className="divide-y-2 divide-line border-2 border-line self-start" data-testid="owner-disputes">
          {(q.data?.items ?? []).map((d) => (
            <li key={d.code}>
              <button type="button" onClick={() => setOpen(d.code)} className={`flex w-full flex-wrap items-center justify-between gap-3 p-3 text-left hover:bg-surface-2 ${open === d.code ? "bg-surface-2" : ""}`}>
                <span>
                  <span className="block font-semibold">{t(`category.${d.category}`)}</span>
                  <span className="block font-mono text-xs text-muted">
                    {d.code} · {d.sourceRef} · {formatDhaka(String(d.createdAt), locale)}
                  </span>
                </span>
                <Chip tone={TONE[d.status] ?? "muted"}>{t(`status.${d.status}`)}</Chip>
              </button>
            </li>
          ))}
          {!q.isPending && !q.data?.items.length ? <li className="p-4 text-muted">{t("noDisputes")}</li> : null}
        </ul>
        <div>{open ? <OwnerCase code={open} /> : <p className="text-muted">{t("pick")}</p>}</div>
      </div>
    </div>
  );
}

function OwnerCase({ code }: { code: string }) {
  const t = useTranslations("vendorTrust");
  const locale = useLocale();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["owner-dispute", code], queryFn: () => ownerTrust.get(code) });
  const [text, setText] = useState("");
  const [fileErr, setFileErr] = useState<string | null>(null);
  const refresh = () => (qc.invalidateQueries({ queryKey: ["owner-dispute", code] }), qc.invalidateQueries({ queryKey: ["owner-disputes"] }));
  const say = useMutation({ mutationFn: () => (q.data?.can.respond ? ownerTrust.respond(code, text.trim()) : ownerTrust.statement(code, text.trim())), onSuccess: () => (setText(""), refresh()) });
  const upload = useMutation({ mutationFn: (f: File) => ownerTrust.upload(code, f), onSuccess: refresh });
  if (q.isPending) return <div className="h-64 animate-pulse bg-surface-2" />;
  if (!q.data) return <Notice tone="error">{t("loadFailed")}</Notice>;
  const { dispute: d, evidence, can, source } = q.data;
  const src = (source ?? {}) as Record<string, unknown>;
  const problem = problemOf(say.error) ?? problemOf(upload.error);

  return (
    <div className="border-2 border-line-strong p-4" data-testid="owner-case">
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="font-mono">{d.code}</span>
        <span className="border border-line px-2 py-0.5 font-semibold text-ink" data-testid="owner-case-status">
          {t(`status.${d.status}`)}
        </span>
      </p>
      <p className="text-lg font-extrabold">{t(`category.${d.category}`)}</p>
      <p className="text-sm text-muted">
        {String(src.groundName ?? src.shopName ?? "")} {src.start ? `· ${formatDhaka(String(src.start), locale)}` : ""} · {d.sourceRef}
      </p>
      <p className="mt-2 text-sm">{d.money ? t("heldLine", { amount: formatTaka(d.held, locale) }) : t("findingsLine")}</p>
      {d.status === "awaiting_response" && d.respondentDueAt ? <Notice tone="error">{t("answerBy", { when: formatDhaka(String(d.respondentDueAt), locale) })}</Notice> : null}
      {d.status === "resolved" ? <Notice>{t("decided", { outcome: t(`outcome.${d.outcome}`), refund: formatTaka(d.refund ?? 0, locale) })}</Notice> : null}
      <ol className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {evidence.map((e) => (
          <li key={e.id} className={`border-l-4 pl-3 text-sm ${e.party === "respondent" ? "border-brand" : "border-line"}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              {t(`party.${e.party}`)} · {formatDhaka(e.createdAt, locale)}
            </p>
            {e.text ? <p className="whitespace-pre-line">{e.text}</p> : null}
            {e.file ? (
              <button type="button" onClick={() => ownerTrust.openFile(code, e.id)} className="font-semibold text-brand underline">
                {t("openFile")}
              </button>
            ) : null}
          </li>
        ))}
      </ol>
      {can.addEvidence ? (
        <form
          className="mt-4 space-y-2 border-t-2 border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            say.mutate();
          }}
        >
          <label htmlFor="owner-side" className="font-bold">
            {can.respond ? t("yourSide") : t("addMore")}
          </label>
          <textarea id="owner-side" value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={2000} className="w-full border-2 border-line bg-surface px-3 py-2" />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={text.trim().length < 2 || say.isPending} className="min-h-11 bg-brand px-4 font-bold text-white disabled:opacity-50" data-testid="owner-respond">
              {can.respond ? t("sendSide") : t("send")}
            </button>
            <label className={`inline-flex min-h-11 cursor-pointer items-center border-2 border-line px-4 font-semibold ${can.filesLeft ? "" : "pointer-events-none opacity-50"}`}>
              {upload.isPending ? t("uploading") : t("addFile", { left: can.filesLeft })}
              <input
                type="file"
                className="sr-only"
                accept={EVIDENCE_TYPES.join(",")}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (!EVIDENCE_TYPES.includes(f.type)) return setFileErr(t("fileType"));
                  setFileErr(null);
                  upload.mutate(f);
                }}
              />
            </label>
          </div>
          {fileErr ? <Notice tone="error">{fileErr}</Notice> : null}
          {problem ? <Notice tone="error">{problem.title}</Notice> : null}
        </form>
      ) : null}
    </div>
  );
}

/** /vendor/reviews (M17 FR-25): members' ratings of the owner's grounds; one reply each, editable. */
export function OwnerReviews() {
  const t = useTranslations("vendorTrust");
  const locale = useLocale();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["owner-reviews"], queryFn: () => ownerTrust.reviews() });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const reply = useMutation({ mutationFn: (id: string) => ownerTrust.reply(id, (draft[id] ?? "").trim()), onSuccess: () => qc.invalidateQueries({ queryKey: ["owner-reviews"] }) });

  return (
    <div className="mx-auto max-w-[960px] px-5 pb-16 pt-8">
      <h1 className="text-3xl font-extrabold">{t("reviewsTitle")}</h1>
      <p className="mt-2 text-muted">{t("reviewsIntro")}</p>
      {reply.error ? <Notice tone="error">{problemOf(reply.error)?.title}</Notice> : null}
      <ul className="mt-6 divide-y-2 divide-line border-y-2 border-line" data-testid="owner-reviews">
        {(q.data?.items ?? []).map((r) => (
          <li key={r.id} className="py-4">
            <p className="text-sm">
              <span className="font-bold text-brand">{"★".repeat(r.stars)}</span>
              <span className="text-muted">{"★".repeat(5 - r.stars)}</span> · {r.author.displayName ?? "–"} · {formatDhaka(r.createdAt, locale)}
            </p>
            {r.text ? <p className="mt-1 max-w-[65ch] whitespace-pre-line">{r.text}</p> : null}
            {r.reply ? <p className="mt-2 border-l-4 border-line pl-3 text-sm text-muted">{r.reply.text}</p> : null}
            <div className="mt-2 flex gap-2">
              <input value={draft[r.id] ?? ""} onChange={(e) => setDraft({ ...draft, [r.id]: e.target.value })} placeholder={r.reply ? t("editReply") : t("writeReply")} aria-label={t("writeReply")} maxLength={1000} className={`${inputCls} flex-1`} />
              <button type="button" disabled={(draft[r.id] ?? "").trim().length < 2 || reply.isPending} onClick={() => reply.mutate(r.id)} className="min-h-11 bg-brand px-4 font-bold text-white disabled:opacity-50" data-testid="send-reply">
                {t("reply")}
              </button>
            </div>
          </li>
        ))}
        {!q.isPending && !q.data?.items.length ? <li className="py-4 text-muted">{t("noReviews")}</li> : null}
      </ul>
      <p className="mt-4 text-sm">
        <Link href="/vendor/venues" className="font-semibold text-brand underline">
          {t("toGrounds")}
        </Link>
      </p>
    </div>
  );
}
