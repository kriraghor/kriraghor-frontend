"use client";

import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { stepUp } from "@/lib/admin/stepUp";
import { finance, formatTaka, type Refund } from "@/lib/admin/finance";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka } from "../useAdminMe";
import type { DeskMe } from "./FinanceDesk";
import { Chip, DataTable, Field, inputCls, MoreButton, TONE } from "./shared";

const STATUSES = ["pending_master", "approved", "processing", "succeeded", "failed", "manual_required", "rejected"] as const;

/** Refunds, starting with the escalation queue; masters approve or reject with an authenticator code. */
export function RefundsTab({ me }: { me: DeskMe }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const qc = useQueryClient();
  const [status, setStatus] = useState<Refund["status"] | "">("pending_master");
  const [deciding, setDeciding] = useState<{ refund: Refund; action: "approve" | "reject" } | null>(null);
  const [note, setNote] = useState("");

  const q = useInfiniteQuery({
    queryKey: ["finance-refunds", status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => finance.refunds({ status: status || undefined, cursor: pageParam }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="mt-6">
      <Field label={t("status")}>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={`${inputCls} w-64`}>
          <option value="">{t("all")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`refundStatus.${s}`)}
            </option>
          ))}
        </select>
      </Field>
      <DataTable head={[t("payment"), t("amount"), t("reason"), t("status"), t("source"), t("when"), ""]} loading={q.isPending} error={q.isError} empty={!items.length} testId="finance-refunds">
        {items.map((r) => (
          <tr key={r.id}>
            <td className="px-3 py-2">
              <span className="font-mono">{r.payment.code}</span>
              <span className="block text-xs text-muted">{r.payment.title}</span>
            </td>
            <td className="px-3 py-2 tabular-nums">{formatTaka(r.amount, locale)}</td>
            <td className="px-3 py-2">
              {t.has(`reasons.${r.reasonCode}`) ? t(`reasons.${r.reasonCode}`) : r.reasonCode}
              {r.reasonText ? <span className="block text-xs text-muted">{r.reasonText}</span> : null}
            </td>
            <td className="px-3 py-2">
              <Chip tone={TONE[r.status] ?? "muted"}>{t(`refundStatus.${r.status}`)}</Chip>
              {r.lastError ? <span className="block text-xs text-danger">{r.lastError}</span> : null}
            </td>
            <td className="px-3 py-2">{t(`sources.${r.source}`)}</td>
            <td className="px-3 py-2 whitespace-nowrap">{formatDhaka(r.createdAt, locale)}</td>
            <td className="px-3 py-2 whitespace-nowrap">
              {r.status === "pending_master" && me.isMaster ? (
                <span className="flex gap-2">
                  <button type="button" className="min-h-9 border-2 border-brand px-3 font-semibold" onClick={() => setDeciding({ refund: r, action: "approve" })}>
                    {t("approve")}
                  </button>
                  <button type="button" className="min-h-9 border-2 border-line px-3 font-semibold" onClick={() => setDeciding({ refund: r, action: "reject" })}>
                    {t("reject")}
                  </button>
                </span>
              ) : null}
            </td>
          </tr>
        ))}
      </DataTable>
      <MoreButton show={Boolean(q.hasNextPage)} busy={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} />

      {deciding ? (
        <CodeDialog
          title={t(deciding.action === "approve" ? "approveTitle" : "rejectTitle", { amount: formatTaka(deciding.refund.amount, locale) })}
          help={t("decideHelp")}
          onClose={() => {
            setDeciding(null);
            setNote("");
          }}
          onConfirm={async (code) => {
            const token = await stepUp(code, "refund.large");
            await finance.decideRefund(deciding.refund.id, deciding.action, note || undefined, token);
            setDeciding(null);
            setNote("");
            await qc.invalidateQueries({ queryKey: ["finance-refunds"] });
          }}
        >
          <label htmlFor="refund-note" className="mt-4 block text-sm font-semibold text-muted">
            {deciding.action === "reject" ? t("noteRequired") : t("note")}
          </label>
          <input id="refund-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={`${inputCls} mt-1 w-full`} />
        </CodeDialog>
      ) : null}
    </div>
  );
}
