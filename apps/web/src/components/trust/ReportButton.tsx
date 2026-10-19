"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { REPORT_REASONS, reports, type ReportReason, type SubjectType } from "@/lib/trust";
import { Notice } from "@kriraghor/ui/primitives";

/**
 * "Report" (M17 FR-15): a reason and an optional note. Reports from NID-verified members count toward
 * hiding a review at once; every report reaches our team. The member never sees who else reported.
 */
export function ReportButton({ subjectType, subjectId, label }: { subjectType: SubjectType; subjectId: string; label?: string }) {
  const t = useTranslations("trust.report");
  const { status } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[subjectType][0]);
  const [note, setNote] = useState("");
  const send = useMutation({ mutationFn: () => reports.file({ subjectType, subjectId, reasonCode: reason, note: note.trim() || undefined }) });
  const problem = send.error ? problemOf(send.error) : null;
  const id = `report-${subjectType}-${subjectId}`;

  if (send.isSuccess || problem?.code === "REPORT_DUPLICATE")
    return (
      <p className="text-sm text-muted" role="status">
        {t("thanks")}
      </p>
    );
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-muted underline hover:text-ink" data-testid={`report-${subjectType}`}>
        {label ?? t("open")}
      </button>
    );
  if (status !== "signed_in")
    return (
      <p className="text-sm">
        {t("signIn")}{" "}
        <Link href="/sign-in" className="font-semibold text-brand underline">
          {t("signInLink")}
        </Link>
      </p>
    );
  return (
    <form
      className="mt-2 space-y-3 border-2 border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        send.mutate();
      }}
      aria-labelledby={`${id}-title`}
    >
      <p id={`${id}-title`} className="font-bold">
        {t(`title.${subjectType}`)}
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-reason`} className="text-sm font-semibold text-muted">
          {t("reason")}
        </label>
        <select id={`${id}-reason`} value={reason} onChange={(e) => setReason(e.target.value as ReportReason)} className="min-h-12 field px-3">
          {REPORT_REASONS[subjectType].map((r) => (
            <option key={r} value={r}>
              {t(`reasons.${r}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-note`} className="text-sm font-semibold text-muted">
          {t("note")}
        </label>
        <textarea id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} className="glass-card px-3 py-2" />
      </div>
      {problem ? <Notice tone="error">{problem.code === "REPORT_SELF" ? t("self") : problem.code === "REPORT_RATE_LIMITED" ? t("limit") : t("failed")}</Notice> : null}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={send.isPending} className="inline-flex min-h-11 items-center bg-brand px-4 font-bold text-white disabled:opacity-50" data-testid="send-report">
          {t("send")}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center border-2 border-line px-4 font-semibold">
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
