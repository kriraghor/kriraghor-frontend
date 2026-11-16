"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { consentLine, kyc, type Reveal } from "@/lib/admin/kyc";
import { formatDhaka } from "../useAdminMe";
import { problemOf } from "@kriraghor/api-client";
import { Notice } from "@kriraghor/ui/primitives";
import { Field, inputCls } from "../finance/shared";

/**
 * The `document` panel on the Moderation desk (M02): legal name, date of birth, the masked number
 * (reveal with a reason for 60 s, critical audit) and the files (each view audited). Checks, the
 * rubric and the decision are the desk's (M05).
 */
export function DocumentPanel({ documentId }: { documentId: string }) {
  const t = useTranslations("kyc");
  const locale = useLocale();
  const d = useQuery({ queryKey: ["kyc-doc", documentId], queryFn: () => kyc.get(documentId) });
  if (d.isPending) return <div className="rounded-card mt-4 h-40 kg-shimmer bg-surface-2" />;
  if (d.isError) return <Notice tone="error">{t("loadFailed")}</Notice>;
  const doc = d.data;
  const fields = doc.fields as Record<string, unknown> & { legalName?: string; dob?: string; numberMasked: string | null };
  // Business documents (ground owners, M09): the typed fields; the number stays masked, no reveal.
  const business = doc.docType !== "nid";
  const extra = business ? Object.entries(fields).filter(([k, v]) => !["numberMasked", "role"].includes(k) && v !== null && v !== undefined) : [];
  return (
    <div data-testid="kyc-review">
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {business ? (
          <>
            <dt className="text-muted">{t("docType")}</dt>
            <dd className="font-semibold">{t(`docTypes.${doc.docType}`)}</dd>
            {extra.map(([k, v]) => (
              <span key={k} className="contents">
                <dt className="text-muted">{t.has(`businessField.${k}`) ? t(`businessField.${k}`) : k}</dt>
                <dd className="font-semibold">{String(v)}</dd>
              </span>
            ))}
            {fields.numberMasked ? (
              <>
                <dt className="text-muted">{t("number")}</dt>
                <dd className="font-mono">{fields.numberMasked}</dd>
              </>
            ) : null}
          </>
        ) : (
          <>
            <dt className="text-muted">{t("legalName")}</dt>
            <dd className="font-semibold">{fields.legalName}</dd>
            <dt className="text-muted">{t("dob")}</dt>
            <dd>{fields.dob}</dd>
            <dt className="text-muted">{t("number")}</dt>
            <dd>
              <RevealNid id={documentId} masked={fields.numberMasked ?? ""} />
            </dd>
          </>
        )}
        <dt className="text-muted">{t("phone")}</dt>
        <dd>{doc.user.phoneVerified ? t("phoneOk") : t("phoneMissing")}</dd>
        {/* M02-FR-05 (25 Oct 2026): the consent version the member ticked, and when. */}
        <dt className="text-muted">{t("consent")}</dt>
        <dd data-testid="kyc-consent">{consentLine(doc.consent, (iso) => formatDhaka(iso, locale)) ?? <span className="text-muted">{t("consentNone")}</span>}</dd>
      </dl>
      <h3 className="mt-5 font-bold">{t("files")}</h3>
      <p className="text-xs text-muted">{t("filesAudited")}</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        {doc.files.map((f) => (
          <FileView key={f.id} docId={documentId} fileId={f.id} slot={f.slot} mime={f.mime} purged={f.purged} />
        ))}
      </div>
    </div>
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
        <button type="button" className="rounded-control min-h-9 border border-line-strong/60 px-2 text-xs font-semibold" onClick={() => setAsking(true)}>
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
      <button type="submit" className="rounded-control min-h-11 border border-brand px-3 text-sm font-semibold">
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
  useEffect(
    () => () => {
      if (ref.current) URL.revokeObjectURL(ref.current);
    },
    []
  );

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
    <div className="rounded-control flex min-h-40 flex-col items-center justify-center gap-2 border border-line-strong/60 p-2 text-center text-sm">
      <span className="font-bold">{t(`slot.${slot}`)}</span>
      {purged ? (
        <span className="text-xs text-muted">{t("purged")}</span>
      ) : url && mime !== "application/pdf" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={t(`slot.${slot}`)} className="max-h-60 w-full object-contain" data-testid={`kyc-file-${slot}`} />
      ) : (
        <button type="button" disabled={busy} onClick={() => void show()} className="rounded-control min-h-11 border border-line-strong/60 px-3 font-semibold disabled:opacity-50">
          {mime === "application/pdf" ? t("openPdf") : t("show")}
        </button>
      )}
      {failed ? <span className="text-xs text-danger">{t("fileFailed")}</span> : null}
    </div>
  );
}
