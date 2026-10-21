"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Check, X } from "@phosphor-icons/react";
import { DataTable, FilterBar, Field, type Column } from "@kriraghor/ui/kit";
import { stepUp } from "@/lib/admin/stepUp";
import { finance, formatTaka, type Refund } from "@/lib/admin/finance";
import { useCursorList } from "@/lib/use-cursor-list";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../../StatusBadge";
import { CodeDialog } from "../CodeDialog";
import { formatDhaka } from "../useAdminMe";
import type { DeskMe } from "./FinanceDesk";

type Row = Awaited<ReturnType<typeof finance.refunds>>["items"][number];

const STATUSES = ["pending_master", "approved", "processing", "succeeded", "failed", "manual_required", "rejected"] as const;

/** Refunds, starting with the escalation queue; masters approve or reject with an authenticator code. */
export function RefundsTab({ me }: { me: DeskMe }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const qc = useQueryClient();
  const { values, set, clear } = useUrlFilters({ status: { default: "pending_master", allowed: ["", ...STATUSES] } });
  const status = values.status as Refund["status"] | "";
  const [deciding, setDeciding] = useState<{ refund: Row; action: "approve" | "reject" } | null>(null);
  const [note, setNote] = useState("");
  const list = useCursorList<Row>(["finance-refunds", status], (cursor) => finance.refunds({ status: status || undefined, cursor }));

  const columns: Column<Row>[] = [
    {
      id: "payment",
      header: t("payment"),
      primary: true,
      sort: (r) => r.payment.code,
      cell: (r) => (
        <>
          <span className="font-mono">{r.payment.code}</span>
          <span className="block text-xs text-muted">{r.payment.title}</span>
        </>
      ),
    },
    { id: "amount", header: t("amount"), align: "end", sort: (r) => r.amount, cell: (r) => formatTaka(r.amount, locale) },
    {
      id: "reason",
      header: t("reason"),
      cell: (r) => (
        <>
          {t.has(`reasons.${r.reasonCode}`) ? t(`reasons.${r.reasonCode}`) : r.reasonCode}
          {r.reasonText ? <span className="block text-xs text-muted">{r.reasonText}</span> : null}
        </>
      ),
    },
    {
      id: "status",
      header: t("status"),
      sort: (r) => r.status,
      cell: (r) => (
        <>
          <StatusBadge status={r.status}>{t(`refundStatus.${r.status}`)}</StatusBadge>
          {r.lastError ? <span className="block text-xs text-danger">{r.lastError}</span> : null}
        </>
      ),
    },
    { id: "source", header: t("source"), hideBelow: "xl", cell: (r) => t(`sources.${r.source}`) },
    { id: "when", header: t("when"), sort: (r) => r.createdAt, cell: (r) => <span className="whitespace-nowrap">{formatDhaka(r.createdAt, locale)}</span> },
  ];

  return (
    <div className="mt-6 flex flex-col gap-4">
      <FilterBar
        selects={[
          {
            id: "status",
            label: t("status"),
            value: status,
            onChange: (v) => set({ status: v }),
            anyLabel: t("all"),
            options: STATUSES.map((s) => ({ value: s, label: t(`refundStatus.${s}`) })),
          },
        ]}
        onClear={status !== "pending_master" ? clear : undefined}
      />
      <DataTable
        label={t("tabs.refunds")}
        testId="finance-refunds"
        columns={columns}
        rows={list.rows}
        rowId={(r) => r.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.retry}
        empty={{ title: t("empty") }}
        hasMore={list.hasMore}
        onMore={list.more}
        busy={list.busy}
        rowActions={(r) =>
          r.status === "pending_master" && me.isMaster
            ? [
                { label: t("approve"), icon: <Check />, onSelect: () => setDeciding({ refund: r, action: "approve" }) },
                { label: t("reject"), icon: <X />, danger: true, onSelect: () => setDeciding({ refund: r, action: "reject" }) },
              ]
            : []
        }
      />

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
          <Field
            id="refund-note"
            className="mt-4"
            label={deciding.action === "reject" ? t("noteRequired") : t("note")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />
        </CodeDialog>
      ) : null}
    </div>
  );
}
