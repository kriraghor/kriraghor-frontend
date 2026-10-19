"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { problemOf, type Problem } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ACCEPT, fileProblem, getVerification, MAX_UPLOAD_BYTES, nidLooksValid, SLOTS, submitNid, uploadFile, type Slot, type VerificationItem } from "@/lib/kyc";
import { risk } from "@/lib/trust";
import { Button, Notice } from "../ui";

const BADGE_CLS = { fully_verified: "border-brand text-brand", documents_in_review: "border-amber-500 text-ink", verification_needed: "border-danger text-danger" } as const;
const STATUS_CLS: Record<string, string> = { approved: "text-brand", in_review: "text-ink", changes_requested: "text-danger", rejected: "text-danger", missing: "text-muted" };

/**
 * /account/verification (M02 §4): the member checklist with its badge, and the NID form: legal name,
 * number, date of birth, front, back and a selfie holding the NID. Approval by the Kriraghor team
 * unlocks booking, buying, hiring, selling and withdrawing winnings.
 */
export function VerificationPage() {
  const t = useTranslations("kyc");
  const locale = useLocale();
  const { status } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["verification", locale], enabled: status === "signed_in", queryFn: () => getVerification(locale) });
  const [editing, setEditing] = useState(false);

  const asked = useQuery({ queryKey: ["document-requests"], enabled: status === "signed_in", queryFn: () => risk.documentRequests() });
  const open = (asked.data?.items ?? []).filter((r) => r.status === "open" || r.status === "overdue");
  const nid = q.data?.items.find((i) => i.key === "nid");
  // M18-FR-07: an open request for a new NID lets a verified member send it again.
  const canSubmit = nid && (["missing", "changes_requested", "rejected", "withdrawn"].includes(nid.status) || open.some((r) => r.docType === "nid"));

  return (
    <section className="mx-auto max-w-2xl px-5 pb-16 pt-8">
      <h1 className="text-3xl font-extrabold">{t("title")}</h1>
      <p className="mt-2 text-muted">{t("intro")}</p>
      {open.length ? (
        <div className="mt-4 border-l-4 border-danger bg-surface-2 p-3" role="status" data-testid="document-requests">
          <p className="font-bold">{t("requested.title")}</p>
          <ul className="mt-1 text-sm">
            {open.map((r) => (
              <li key={r.id}>
                {t("requested.item", { doc: t(`requested.doc.${r.docType}`), when: new Date(r.dueAt).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" }) })}
                {r.status === "overdue" ? ` · ${t("requested.overdue")}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {status === "signed_out" ? (
        <div className="mt-6">
          <Notice>
            {t("signedOut")}{" "}
            <Link href="/sign-in?next=/account/verification" className="underline">
              {t("signIn")}
            </Link>
          </Notice>
        </div>
      ) : q.isPending ? (
        <div className="mt-6 h-40 animate-pulse bg-surface-2" role="status" aria-label={t("loading")} />
      ) : q.isError ? (
        <div className="mt-6">
          <Notice tone="error">{t("loadFailed")}</Notice>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3" data-testid="kyc-badge">
            <span className={`border-2 px-3 py-1 text-sm font-bold ${BADGE_CLS[q.data.badge]}`}>{t(`badge.${q.data.badge}`)}</span>
            <span className="text-sm text-muted">{t("progress", { approved: q.data.progress.approved, total: q.data.progress.total })}</span>
          </div>
          <ul className="mt-6 divide-y-2 divide-line border-y-2 border-line" data-testid="kyc-items">
            {q.data.items.map((i) => (
              <ItemRow key={i.key} item={i} />
            ))}
          </ul>
          {canSubmit && !editing ? (
            <button type="button" onClick={() => setEditing(true)} className="mt-6 min-h-12 border-2 border-ink px-5 font-bold" data-testid="start-nid">
              {nid.status === "missing" ? t("start") : t("again")}
            </button>
          ) : null}
          {editing ? (
            <NidForm
              onCancel={() => setEditing(false)}
              onDone={async () => {
                setEditing(false);
                await qc.invalidateQueries({ queryKey: ["verification"] });
              }}
            />
          ) : null}
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="font-bold">{t("unlocks")}</h2>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {q.data.unlocks.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-bold">{t("limits")}</h2>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {q.data.limits.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function ItemRow({ item }: { item: VerificationItem }) {
  const t = useTranslations("kyc");
  const d = item.document;
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-bold">{item.label}</span>
        <span className={`ml-auto text-sm font-semibold ${STATUS_CLS[item.status] ?? "text-muted"}`}>{t(`status.${item.status}`)}</span>
      </div>
      {item.why ? <p className="mt-1 text-sm text-muted">{item.why}</p> : null}
      {d ? <p className="mt-1 font-mono text-sm">{d.numberMasked}</p> : null}
      {d && (d.status === "changes_requested" || d.status === "rejected") ? (
        <div className="mt-2">
          <Notice tone="error">
            {t.has(`reason.${d.reasonCode}`) ? t(`reason.${d.reasonCode}`) : t("reason.other")}
            {d.reasonText ? `: ${d.reasonText}` : ""}
          </Notice>
        </div>
      ) : null}
    </li>
  );
}

type Upload = { file: File; preview: string | null; id: string | null; error: string | null; busy: boolean };

function NidForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => Promise<void> }) {
  const t = useTranslations("kyc");
  const [legalName, setLegalName] = useState("");
  const [number, setNumber] = useState("");
  const [dob, setDob] = useState("");
  const [consent, setConsent] = useState(false);
  const [uploads, setUploads] = useState<Partial<Record<Slot, Upload>>>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  // Object URLs are released when a preview is replaced, and all of them when the form closes.
  const previews = useRef(new Map<Slot, string>());
  useEffect(() => {
    const map = previews.current;
    return () => map.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  async function pick(slot: Slot, file: File | undefined) {
    if (!file) return;
    const bad = fileProblem(file, MAX_UPLOAD_BYTES);
    const old = previews.current.get(slot);
    if (old) URL.revokeObjectURL(old);
    const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    if (preview) previews.current.set(slot, preview);
    else previews.current.delete(slot);
    if (bad) {
      setUploads((u) => ({ ...u, [slot]: { file, preview, id: null, error: t(`fileError.${bad}`), busy: false } }));
      return;
    }
    setUploads((u) => ({ ...u, [slot]: { file, preview, id: null, error: null, busy: true } }));
    try {
      const r = await uploadFile(slot, file);
      setUploads((u) => ({ ...u, [slot]: { file, preview, id: r.fileId, error: null, busy: false } }));
    } catch (err) {
      setUploads((u) => ({ ...u, [slot]: { file, preview, id: null, error: problemOf(err)?.title ?? t("uploadFailed"), busy: false } }));
    }
  }

  const ready = SLOTS.every((s) => uploads[s]?.id) && legalName.trim().length >= 3 && nidLooksValid(number) && dob && consent;

  return (
    <form
      className="mt-6 space-y-5 border-2 border-line-strong p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setProblem(null);
        try {
          await submitNid({ legalName: legalName.trim(), number, dob }, { front: uploads.front!.id!, back: uploads.back!.id!, selfie: uploads.selfie!.id! });
          await onDone();
        } catch (err) {
          setProblem(problemOf(err) ?? { code: "UNKNOWN", title: t("failed"), status: 0 });
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block">
        <span className="text-sm font-semibold text-muted">{t("legalName")}</span>
        <input value={legalName} onChange={(e) => setLegalName(e.target.value)} autoComplete="name" minLength={3} maxLength={120} className="mt-1 min-h-12 w-full border-2 border-line bg-surface px-3 text-base" required />
        <span className="text-xs text-muted">{t("legalNameHelp")}</span>
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-muted">{t("number")}</span>
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={number.length > 0 && !nidLooksValid(number)}
          aria-describedby="nid-help"
          className="mt-1 min-h-12 w-full border-2 border-line bg-surface px-3 font-mono text-lg"
          required
        />
        <span id="nid-help" className={`text-xs ${number.length > 0 && !nidLooksValid(number) ? "text-danger" : "text-muted"}`}>
          {t("numberHelp")}
        </span>
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-muted">{t("dob")}</span>
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="mt-1 min-h-12 border-2 border-line bg-surface px-3 text-base" required />
      </label>
      <fieldset>
        <legend className="text-sm font-semibold text-muted">{t("files")}</legend>
        <p className="text-xs text-muted">{t("filesHelp")}</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {SLOTS.map((slot) => {
            const u = uploads[slot];
            return (
              <label key={slot} className={`flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-3 text-center text-sm ${u?.id ? "border-brand" : u?.error ? "border-danger" : "border-line"}`}>
                <span className="font-bold">{t(`slot.${slot}`)}</span>
                {u?.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.preview} alt={t(`slot.${slot}`)} className="h-20 w-full object-contain" />
                ) : u ? (
                  <span className="text-xs">{u.file.name}</span>
                ) : (
                  <span className="text-xs text-muted">{t("choose")}</span>
                )}
                <span className={`text-xs ${u?.error ? "text-danger" : "text-muted"}`} role={u?.error ? "alert" : undefined}>
                  {u?.busy ? t("uploading") : u?.error ?? (u?.id ? t("uploaded") : "")}
                </span>
                <input type="file" accept={ACCEPT} className="sr-only" data-testid={`file-${slot}`} onChange={(e) => void pick(slot, e.target.files?.[0])} />
              </label>
            );
          })}
        </div>
      </fieldset>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5" required />
        <span>{t("consent")}</span>
      </label>
      {problem ? <Notice tone="error">{problem.title}</Notice> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" busy={busy} disabled={!ready}>
          {t("submit")}
        </Button>
        <button type="button" onClick={onCancel} className="min-h-12 border-2 border-line px-5 font-semibold" disabled={busy}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
